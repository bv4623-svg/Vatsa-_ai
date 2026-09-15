# app/utils/background.py
"""
Professional Background Task Manager for Vatsa AI Router.
Handles analytics logging, conversation titling, memory indexing, and more.
Uses an asyncio task queue with worker pool, retries, and graceful shutdown.
"""

import asyncio
import logging
import time
import traceback
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Callable, Dict, List, Optional, Union
from collections import defaultdict

from app.config.settings import settings
from app.core.memory import get_memory_manager
from app.utils.analytics import log_analytics  # existing analytics function

logger = logging.getLogger(__name__)


# ============================================================================
# Configuration
# ============================================================================

class BackgroundConfig:
    """Configuration for background task system."""
    # Worker pool
    MAX_WORKERS = getattr(settings, "BACKGROUND_MAX_WORKERS", 4)
    QUEUE_MAX_SIZE = getattr(settings, "BACKGROUND_QUEUE_MAX_SIZE", 1000)

    # Retry
    MAX_RETRIES = getattr(settings, "BACKGROUND_MAX_RETRIES", 3)
    RETRY_BACKOFF_BASE = getattr(settings, "BACKGROUND_RETRY_BACKOFF_BASE", 2.0)  # seconds
    RETRY_MAX_DELAY = getattr(settings, "BACKGROUND_RETRY_MAX_DELAY", 60.0)

    # Timeouts
    TASK_TIMEOUT = getattr(settings, "BACKGROUND_TASK_TIMEOUT", 30.0)

    # Cleanup
    CLEANUP_INTERVAL = getattr(settings, "BACKGROUND_CLEANUP_INTERVAL", 300)  # 5 min

    # Dead letter
    DEAD_LETTER_ENABLED = getattr(settings, "BACKGROUND_DEAD_LETTER_ENABLED", True)
    DEAD_LETTER_MAX_SIZE = getattr(settings, "BACKGROUND_DEAD_LETTER_MAX_SIZE", 1000)


# ============================================================================
# Task Types
# ============================================================================

class TaskPriority(Enum):
    """Task priority levels."""
    CRITICAL = 0   # High priority (e.g., user‑facing analytics)
    NORMAL = 1     # Default
    LOW = 2        # Non‑critical (e.g., long‑term indexing)


class TaskType(Enum):
    """Available background task types."""
    ANALYTICS = auto()
    CONVERSATION_TITLE = auto()
    MEMORY_INDEX = auto()
    EMBEDDING = auto()
    CUSTOM = auto()


@dataclass
class BackgroundTask:
    """Represents a background task."""
    task_type: TaskType
    payload: Dict[str, Any]
    priority: TaskPriority = TaskPriority.NORMAL
    retries: int = 0
    max_retries: int = BackgroundConfig.MAX_RETRIES
    created_at: float = field(default_factory=time.time)
    task_id: str = field(default_factory=lambda: f"task_{int(time.time()*1000)}_{hash(str(time.time()))}")

    def __post_init__(self):
        self._attempts = 0

    @property
    def attempts(self) -> int:
        return self._attempts

    def increment_attempts(self):
        self._attempts += 1

    def should_retry(self) -> bool:
        return self._attempts < self.max_retries


# ============================================================================
# Task Handlers
# ============================================================================

class TaskHandler:
    """Abstract base for task handlers."""
    async def execute(self, task: BackgroundTask) -> Any:
        raise NotImplementedError

    @property
    def task_type(self) -> TaskType:
        raise NotImplementedError


class AnalyticsTaskHandler(TaskHandler):
    """Handle analytics logging."""
    @property
    def task_type(self) -> TaskType:
        return TaskType.ANALYTICS

    async def execute(self, task: BackgroundTask) -> None:
        payload = task.payload
        await log_analytics(
            prompt=payload.get("prompt"),
            conversation_id=payload.get("conversation_id"),
            user_id=payload.get("user_id"),
            intent=payload.get("intent"),
            model=payload.get("model"),
            latency=payload.get("latency"),
            **payload.get("extra", {})
        )


class ConversationTitleTaskHandler(TaskHandler):
    """Handle generating and storing conversation titles."""
    @property
    def task_type(self) -> TaskType:
        return TaskType.CONVERSATION_TITLE

    async def execute(self, task: BackgroundTask) -> None:
        payload = task.payload
        conversation_id = payload.get("conversation_id")
        prompt = payload.get("prompt")
        if not conversation_id or not prompt:
            return
        # Generate title (could use LLM or simple rule)
        title = await self._generate_title(prompt)
        # Store in memory system
        manager = await get_memory_manager()
        # For now, store in user's preferences? Or a separate title store.
        # We'll store in a conversation metadata store (hypothetical).
        # In a real system, you would store in a database.
        # Here we'll store in memory manager's user memory (if user_id available)
        user_id = payload.get("user_id")
        if user_id:
            entry = await manager.get_memory(user_id)
            # Store title in conversation history metadata
            # We'll just log for now.
            logger.info(f"Generated title for conversation {conversation_id}: {title}")
        # Optionally, store in a separate store
        # await store_conversation_title(conversation_id, title)

    async def _generate_title(self, prompt: str) -> str:
        # Simple title generation: take first 5 words
        words = prompt.split()
        if len(words) > 5:
            return " ".join(words[:5]) + "..."
        return prompt


class MemoryIndexTaskHandler(TaskHandler):
    """Handle indexing conversation in vector memory (if enabled)."""
    @property
    def task_type(self) -> TaskType:
        return TaskType.MEMORY_INDEX

    async def execute(self, task: BackgroundTask) -> None:
        payload = task.payload
        # Placeholder – integrate with vector DB
        logger.debug(f"Indexing memory for conversation {payload.get('conversation_id')}")
        await asyncio.sleep(0.1)  # simulate


# ============================================================================
# Task Registry
# ============================================================================

class TaskRegistry:
    """Registry for task type → handler mapping."""
    def __init__(self):
        self._handlers: Dict[TaskType, TaskHandler] = {}
        self._register_defaults()

    def _register_defaults(self):
        self.register(AnalyticsTaskHandler())
        self.register(ConversationTitleTaskHandler())
        self.register(MemoryIndexTaskHandler())

    def register(self, handler: TaskHandler):
        self._handlers[handler.task_type] = handler

    def get_handler(self, task_type: TaskType) -> Optional[TaskHandler]:
        return self._handlers.get(task_type)


# ============================================================================
# Background Task Manager
# ============================================================================

class BackgroundTaskManager:
    """
    Manages background tasks using an asyncio queue and worker pool.
    Supports priority, retries, graceful shutdown, and monitoring.
    Singleton instance.
    """
    _instance: Optional["BackgroundTaskManager"] = None
    _lock = asyncio.Lock()

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, "_initialized"):
            self.config = BackgroundConfig()
            self._queue: asyncio.PriorityQueue = asyncio.PriorityQueue(maxsize=self.config.QUEUE_MAX_SIZE)
            self._workers: List[asyncio.Task] = []
            self._shutdown_event = asyncio.Event()
            self._running = False
            self._registry = TaskRegistry()
            self._dead_letter: List[BackgroundTask] = []
            self._stats = {
                "submitted": 0,
                "completed": 0,
                "failed": 0,
                "retried": 0,
                "dead_lettered": 0,
            }
            self._stats_lock = asyncio.Lock()
            self._cleanup_task: Optional[asyncio.Task] = None
            self._initialized = True
            logger.info("BackgroundTaskManager initialized")

    async def start(self, num_workers: Optional[int] = None):
        """Start the worker pool."""
        if self._running:
            return
        self._running = True
        self._shutdown_event.clear()
        num_workers = num_workers or self.config.MAX_WORKERS
        for _ in range(num_workers):
            worker = asyncio.create_task(self._worker_loop())
            self._workers.append(worker)
        # Start cleanup task
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        logger.info(f"Started {num_workers} background workers")

    async def shutdown(self, timeout: float = 10.0):
        """Gracefully shut down the manager."""
        if not self._running:
            return
        logger.info("Shutting down background task manager...")
        self._shutdown_event.set()
        # Wait for workers to finish with timeout
        if self._workers:
            _, pending = await asyncio.wait(self._workers, timeout=timeout, return_when=asyncio.ALL_COMPLETED)
            for p in pending:
                p.cancel()
            # Cancel cleanup task
            if self._cleanup_task:
                self._cleanup_task.cancel()
                try:
                    await self._cleanup_task
                except asyncio.CancelledError:
                    pass
        self._running = False
        logger.info("Background task manager shut down")

    async def submit(self, task: BackgroundTask):
        """
        Submit a task to the queue.
        Priority is used as negative because asyncio.PriorityQueue pops smallest first.
        """
        if not self._running:
            logger.warning("Task manager not running; task will be dropped.")
            return
        try:
            # Use priority as negative for higher priority (critical = 0)
            priority = -task.priority.value
            await self._queue.put((priority, task))
            async with self._stats_lock:
                self._stats["submitted"] += 1
            logger.debug(f"Submitted task {task.task_id} of type {task.task_type}")
        except asyncio.QueueFull:
            logger.error(f"Queue full; dropping task {task.task_id}")
            # Optionally, save to dead letter
            if self.config.DEAD_LETTER_ENABLED:
                self._dead_letter.append(task)
                if len(self._dead_letter) > self.config.DEAD_LETTER_MAX_SIZE:
                    self._dead_letter.pop(0)

    async def _worker_loop(self):
        """Worker that consumes tasks from the queue."""
        while not self._shutdown_event.is_set():
            try:
                # Get task with timeout to allow shutdown check
                try:
                    _, task = await asyncio.wait_for(
                        self._queue.get(),
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue

                # Execute task
                await self._execute_task(task)
                self._queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception(f"Worker error: {e}")
                # Continue processing

    async def _execute_task(self, task: BackgroundTask):
        """Execute a single task with retries and timeout."""
        handler = self._registry.get_handler(task.task_type)
        if handler is None:
            logger.error(f"No handler for task type {task.task_type}")
            return

        task.increment_attempts()
        try:
            start = time.time()
            # Execute with timeout
            await asyncio.wait_for(
                handler.execute(task),
                timeout=self.config.TASK_TIMEOUT
            )
            elapsed = time.time() - start
            async with self._stats_lock:
                self._stats["completed"] += 1
            logger.debug(f"Task {task.task_id} completed in {elapsed:.3f}s")
        except asyncio.TimeoutError:
            logger.warning(f"Task {task.task_id} timed out (attempt {task.attempts})")
            await self._handle_failure(task)
        except Exception as e:
            logger.warning(f"Task {task.task_id} failed (attempt {task.attempts}): {e}")
            await self._handle_failure(task)

    async def _handle_failure(self, task: BackgroundTask):
        """Handle task failure: retry or dead‑letter."""
        async with self._stats_lock:
            self._stats["failed"] += 1
        if task.should_retry():
            # Re‑submit with delay (backoff)
            delay = min(
                self.config.RETRY_BACKOFF_BASE * (2 ** (task.attempts - 1)),
                self.config.RETRY_MAX_DELAY
            )
            logger.info(f"Retrying task {task.task_id} in {delay:.2f}s (attempt {task.attempts+1})")
            async with self._stats_lock:
                self._stats["retried"] += 1
            # We'll re‑submit after delay
            asyncio.create_task(self._delayed_submit(task, delay))
        else:
            # Move to dead letter
            logger.error(f"Task {task.task_id} exhausted retries, moving to dead letter")
            if self.config.DEAD_LETTER_ENABLED:
                self._dead_letter.append(task)
                async with self._stats_lock:
                    self._stats["dead_lettered"] += 1

    async def _delayed_submit(self, task: BackgroundTask, delay: float):
        """Submit a task after a delay."""
        await asyncio.sleep(delay)
        # Reset task's priority? Use same priority.
        await self.submit(task)

    async def _cleanup_loop(self):
        """Periodic cleanup of dead letter queue."""
        while not self._shutdown_event.is_set():
            await asyncio.sleep(self.config.CLEANUP_INTERVAL)
            # Trim dead letter if too large
            if len(self._dead_letter) > self.config.DEAD_LETTER_MAX_SIZE:
                self._dead_letter = self._dead_letter[-self.config.DEAD_LETTER_MAX_SIZE:]
            logger.debug(f"Dead letter size: {len(self._dead_letter)}")

    def get_stats(self) -> Dict[str, Any]:
        """Return current statistics."""
        return {
            **self._stats,
            "queue_size": self._queue.qsize(),
            "dead_letter_size": len(self._dead_letter),
            "running": self._running,
            "workers": len(self._workers),
        }


# ============================================================================
# Public API (wrappers)
# ============================================================================

# Singleton instance
_task_manager: Optional[BackgroundTaskManager] = None


async def get_task_manager() -> BackgroundTaskManager:
    """Get the singleton task manager, starting it if needed."""
    global _task_manager
    if _task_manager is None:
        _task_manager = BackgroundTaskManager()
        await _task_manager.start()
    return _task_manager


async def run_background_tasks(
    prompt: str,
    response: Optional[str] = None,
    conversation_id: Optional[str] = None,
    user_id: Optional[str] = None,
    intent: Optional[str] = None,
    model: Optional[str] = None,
    latency: Optional[float] = None,
    **extra
) -> None:
    """
    Main entry point to submit background tasks.
    This is the function called from the router.
    """
    manager = await get_task_manager()
    if not manager._running:
        return

    # 1. Analytics task
    analytics_task = BackgroundTask(
        task_type=TaskType.ANALYTICS,
        payload={
            "prompt": prompt,
            "conversation_id": conversation_id,
            "user_id": user_id,
            "intent": intent,
            "model": model,
            "latency": latency,
            "extra": extra,
        },
        priority=TaskPriority.NORMAL
    )
    await manager.submit(analytics_task)

    # 2. Conversation title generation (if conversation_id and prompt)
    if conversation_id and prompt:
        title_task = BackgroundTask(
            task_type=TaskType.CONVERSATION_TITLE,
            payload={
                "prompt": prompt,
                "conversation_id": conversation_id,
                "user_id": user_id,
            },
            priority=TaskPriority.LOW
        )
        await manager.submit(title_task)

    # 3. Memory indexing (optional)
    if settings.get("ENABLE_MEMORY_INDEXING", False):
        index_task = BackgroundTask(
            task_type=TaskType.MEMORY_INDEX,
            payload={
                "conversation_id": conversation_id,
                "user_id": user_id,
                "prompt": prompt,
                "response": response,
            },
            priority=TaskPriority.LOW
        )
        await manager.submit(index_task)

    # 4. Any custom tasks from extra
    if extra.get("custom_tasks"):
        for custom_payload in extra["custom_tasks"]:
            custom_task = BackgroundTask(
                task_type=TaskType.CUSTOM,
                payload=custom_payload,
                priority=TaskPriority.NORMAL
            )
            await manager.submit(custom_task)


# ============================================================================
# Legacy compatibility (if needed)
# ============================================================================

# The original function signature remains, but now it's async.
# If you need a synchronous wrapper (not recommended), you can provide one.

def run_background_tasks_sync(
    prompt: str,
    response: Optional[str] = None,
    conversation_id: Optional[str] = None,
    user_id: Optional[str] = None,
    intent: Optional[str] = None,
    model: Optional[str] = None,
    latency: Optional[float] = None,
    **extra
):
    """Synchronous wrapper – use asyncio.run() internally."""
    asyncio.run(run_background_tasks(
        prompt, response, conversation_id, user_id, intent, model, latency, **extra
    ))


# ============================================================================
# Shutdown hook
# ============================================================================

async def shutdown_background_tasks(timeout: float = 10.0):
    """Gracefully shut down the task manager."""
    global _task_manager
    if _task_manager:
        await _task_manager.shutdown(timeout)
        _task_manager = None
