# Backend Audit - Vatsa AI

## Entry Point

**Confirmed Entry Point:** `Backend/main.py`

There are TWO main.py files:
1. `Backend/main.py` - This is the actual entry point that runs
2. `Backend/app/main.py` - This is a secondary FastAPI app definition

**Proof:**
- `Backend/main.py` contains `if __name__ == "__main__": uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)` which is the standard way to run a FastAPI application
- `Backend/app/main.py` only defines the app object but has no `if __name__ == "__main__"` block
- `Backend/main.py` imports from `app.routers` (auth, chat, conversations, memory, payment, tokens, upload) while `Backend/app/main.py` imports from `app.routers` (chat, profile, conversations)
- `Backend/main.py` has a lifespan context manager that calls `init_db()`
- `Backend/main.py` includes more routers (auth, memory, payment, tokens, upload) than `Backend/app/main.py`

## Routers

### 1. Auth Router
- **File:** `Backend/app/routers/auth.py`
- **Methods/Paths:**
  - POST `/auth/register` (line 42) - User registration
  - POST `/api/auth/register` (line 42) - User registration (API prefix)
  - POST `/api/auth/signup` (line 42) - User signup (API prefix)
  - POST `/auth/login` (line 62) - User login
  - POST `/api/auth/login` (line 62) - User login (API prefix)
  - POST `/auth/token` (line 82) - OAuth2 token login
  - GET `/auth/me` (line 92) - Get current user profile
  - GET `/api/auth/me` (line 92) - Get current user profile (API prefix)
  - GET `/api/profile` (line 92) - Get user profile (API prefix)
  - GET `/auth/onboarding` (line 108) - Get onboarding status
  - GET `/api/auth/onboarding` (line 108) - Get onboarding status (API prefix)
  - POST `/auth/onboarding` (line 116) - Complete onboarding
  - POST `/api/auth/onboarding` (line 116) - Complete onboarding (API prefix)
  - POST `/auth/otp/send` (line 131) - Send OTP
  - POST `/auth/otp/resend` (line 131) - Resend OTP
  - POST `/auth/otp/verify` (line 139) - Verify OTP
  - GET `/api/auth/check-username` (line 155) - Check username availability
  - GET `/api/auth/check-email` (line 161) - Check email availability
- **Auth:** Uses `get_current_user` dependency for protected endpoints
- **Handler:** Multiple functions as listed above

### 2. Chat Router
- **File:** `Backend/app/routers/chat.py`
- **Methods/Paths:**
  - POST `/api/chat` (line 37) - Handles chat messages
- **Auth:** Uses `get_current_user_optional` dependency (line 40)
- **Handler:** `chat_endpoint` function (line 37)

### 3. Profile Router
- **File:** `Backend/app/routers/profile.py`
- **Methods/Paths:**
  - GET `/api/profile` (line 14) - Gets user profile
  - GET `/auth/me` (line 18) - Gets current user
- **Auth:** No authentication dependency (returns hardcoded user)
- **Handler:** `get_profile` function (line 14), `get_me` function (line 18)

### 4. Conversations Router
- **File:** `Backend/app/routers/conversations.py`
- **Methods/Paths:**
  - GET `/api/conversations` (line 24) - Lists conversations
  - POST `/api/conversations` (line 38) - Creates conversation
  - GET `/api/conversations/{conv_id}` (line 56) - Gets specific conversation
  - PATCH `/api/conversations/{conv_id}` (line 68) - Updates conversation
  - DELETE `/api/conversations/{conv_id}` (line 86) - Deletes conversation
  - DELETE `/api/conversations` (line 96) - Deletes all conversations
  - POST `/api/conversations/{conv_id}/pin` (line 107) - Pins conversation
  - DELETE `/api/conversations/{conv_id}/pin` (line 114) - Unpins conversation
  - POST `/api/conversations/{conv_id}/favorite` (line 121) - Favorites conversation
  - DELETE `/api/conversations/{conv_id}/favorite` (line 128) - Unfavorites conversation
  - POST `/api/conversations/{conv_id}/archive` (line 135) - Archives conversation
  - POST `/api/conversations/{conv_id}/duplicate` (line 142) - Duplicates conversation
- **Auth:** Uses `get_current_user` dependency (line 26, 39, 57, 69, 87, 97, 108, 115, 122, 129, 136, 143)
- **Handler:** Multiple functions as listed above

## Models

### 1. User Model
- **File:** `Backend/app/models/user.py`
- **Columns:**
  - id (Integer, Primary Key)
  - email (String, unique, index)
  - username (String, unique, index, nullable)
  - full_name (String, nullable)
  - hashed_password (String, nullable)
  - google_id (String, unique, nullable)
  - is_verified (Boolean, default=False)
  - is_active (Boolean, default=True)
  - birth_month (Integer, nullable)
  - birth_year (Integer, nullable)
  - profile_completed (Boolean, default=False)
  - tier (String, default="free")
  - settings (JSON, default={})
  - created_at (DateTime, server_default=func.now())
  - updated_at (DateTime, onupdate=func.now())
  - last_login (DateTime, nullable)
- **Relationships:**
  - conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
  - memories = relationship("Memory", back_populates="user", cascade="all, delete-orphan")
  - token_account = relationship("TokenAccount", back_populates="user", uselist=False, cascade="all, delete-orphan")
  - token_transactions = relationship("TokenTransaction", back_populates="user", cascade="all, delete-orphan")
  - subscriptions = relationship("Subscription", back_populates="user", cascade="all, delete-orphan")

### 2. Conversation Model
- **File:** `Backend/app/models/conversation.py`
- **Columns:**
  - id (String, Primary Key)
  - user_id (Integer, ForeignKey("users.id"), index)
  - title (String, default="New Conversation")
  - model (String, nullable)
  - focus_mode (String, nullable)
  - web_search_enabled (Boolean, default=False)
  - pinned (Boolean, default=False)
  - archived (Boolean, default=False)
  - favorite (Boolean, default=False)
  - workspace (String, default="chat", index)
  - messages (JSON, default=[])
  - created_at (DateTime, server_default=func.now())
  - updated_at (DateTime, onupdate=func.now())
- **Relationships:**
  - user = relationship("User", back_populates="conversations")

### 3. Message Model
- **File:** DOES NOT EXIST
- **Status:** The Message class is NOT defined anywhere in the codebase
- **Note:** The Conversation model stores messages as a JSON field rather than using a separate Message model

### 4. Project Model
- **File:** `Backend/app/models/project.py`
- **Columns:**
  - id (Integer, Primary Key)
  - user_id (Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable, index)
  - chat_id (Integer, ForeignKey("chats.id", ondelete="CASCADE"), index)
  - conversation_id (String, index, nullable)
  - title (String(255), default="Untitled Project")
  - workspace (String(50), default="code")
  - framework (String(50), default="react")
  - status (String(20), default="idle", index)
  - preview_url (String(500), nullable)
  - is_deleted (Boolean, default=False, index)
  - created_at (DateTime, server_default=func.now())
  - updated_at (DateTime, server_default=func.now(), onupdate=func.now())
- **Relationships:**
  - files = relationship("File", back_populates="project", cascade="all, delete-orphan", passive_deletes=True)
  - build_logs = relationship("BuildLog", back_populates="project", cascade="all, delete-orphan", passive_deletes=True)
  - snapshots = relationship("Snapshot", back_populates="project", cascade="all, delete-orphan", passive_deletes=True)
  - memories = relationship("UserMemory", back_populates="project", cascade="all, delete-orphan")

### 5. File Model
- **File:** `Backend/app/models/file.py`
- **Columns:**
  - id (Integer, Primary Key)
  - project_id (Integer, ForeignKey("projects.id", ondelete="CASCADE"), index)
  - path (String(500), index)
  - filename (String(255), index, nullable)
  - content (Text, nullable)
  - is_binary (Boolean, default=False)
  - created_at (DateTime, server_default=func.now())
  - updated_at (DateTime, server_default=func.now(), onupdate=func.now())
- **Relationships:**
  - project = relationship("Project", back_populates="files")

### 6. BuildLog Model
- **File:** `Backend/app/models/build_log.py`
- **Columns:**
  - id (Integer, Primary Key)
  - project_id (Integer, ForeignKey("projects.id"), index)
  - log (Text)
  - level (String(20), default="info")
  - created_at (DateTime, server_default=func.now())
- **Relationships:**
  - project = relationship("Project", back_populates="build_logs")

### 7. Snapshot Model
- **File:** `Backend/app/models/snapshot.py`
- **Columns:**
  - id (Integer, Primary Key)
  - project_id (Integer, ForeignKey("projects.id"), index)
  - state (JSON)
  - created_at (DateTime, server_default=func.now())
- **Relationships:**
  - project = relationship("Project", back_populates="snapshots")

## Services

### 1. AI Service
- **File:** `Backend/app/services/ai_service.py`
- **Class:** `AIService`
- **Methods:**
  - `map_model(preferred: Optional[str]) -> str` (line 35)
  - `call_openrouter(messages, model, max_tokens, temperature) -> Dict[str, Any]` (line 40)
  - `generate_response(db, user, query, conversation_history, model_name, workspace, attachments) -> Dict[str, Any]` (line 73)
- **Functions:**
  - `detect_image_gen(query: str) -> Optional[str]` (line 27)
  - `generate_image(prompt: str) -> Dict[str, Any]` (line 31)

### 2. Authentication Service
- **File:** `Backend/app/services/auth.py` (referenced but not provided)
- **Signatures:**
  - `verify_password(plain_password, hashed_password)`
  - `get_password_hash(password)`
  - `create_access_token(data: dict, expires_delta: timedelta = None)`
  - `get_current_user(token: str)`

## Authentication Flow

### JWT Location
- **File:** `Backend/app/auth/jwt.py`
- **Functions:**
  - `get_password_hash(password: str) -> str` (line 12)
  - `verify_password(plain_password: str, hashed_password: str) -> bool` (line 16)
  - `create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str` (line 30)
  - `decode_access_token(token: str) -> Optional[Dict[str, Any]]` (line 38)
- **Constants:**
  - `SECRET_KEY` (line 10)
  - `ALGORITHM` (line 11)
  - `ACCESS_TOKEN_EXPIRE_MINUTES` (line 12)

### Password Hashing
- **File:** `Backend/app/auth/jwt.py`
- Uses `get_password_hash` for hashing (line 12)
- Uses `verify_password` for verification (line 16)
- Uses PBKDF2 with SHA256 and 100,000 iterations

### Current User Retrieval
- **File:** `Backend/app/auth/dependencies.py`
- `get_current_user` dependency (line 14)
- `get_current_user_optional` dependency (line 35)
- Uses `decode_access_token` from `app.auth.jwt` (line 10)

## Database

### Engine
- **File:** `Backend/app/database.py`
- SQLAlchemy engine configuration
- SQLite database with `check_same_thread=False`

### Path
- Default: `Backend/vatsa.db`
- Can be overridden with `DATABASE_URL` environment variable

### Initialization
- **File:** `Backend/app/database.py`
- `init_db()` function imports all models and calls `Base.metadata.create_all(bind=engine)`
- Called in `Backend/main.py` lifespan context manager

### Alembic
- **File:** `Backend/alembic/env.py`
- Migration environment configuration
- Imports models: user, conversation, chat, memory, subscription
- **Migrations:** No migration files found in `Backend/alembic/versions/` directory

## AI Provider Wiring

### OpenRouter Provider
- **File:** `Backend/app/providers/openrouter.py`
- **Base URL:** `https://openrouter.ai/api/v1` (line 107)
- **Hardcoded Model:** `openai/gpt-4.1-mini` (line 108)
- **API Key:** Retrieved from `settings.OPENROUTER_API_KEY` (line 106)
- **Provider Class:** `OpenRouterProvider` (line 113)
- **Health Monitor:** Uses `health_monitor` from `app.providers.client` (line 111)
- **Cache:** Uses `router_cache` from `app.cache.router_cache` (line 110)

### Provider Registry
- **File:** `Backend/app/providers/base.py`
- `ProviderRegistry` class with `register`, `get`, `list`, `clear` methods

## Configuration

### Settings
- **File:** `Backend/app/config/settings.py`
- **Class:** `Settings` (line 100)
- **Key Settings:**
  - `OPENROUTER_API_KEY` (line 104)
  - `OPENROUTER_BASE_URL` (line 112)
  - `DEFAULT_MODEL` (line 116)
  - `CACHE_TTL` (line 232)
  - `ROUTER_CACHE_SIZE` (line 236)
  - `DEBUG` (line 244)
- **Singleton:** `settings = Settings()` (line 250)

## Cache

### Router Cache
- **File:** `Backend/app/cache/router_cache.py`
- **Class:** `RouterCache` (line 6)
- **Methods:**
  - `__init__(maxsize: int = 1000, ttl: int = 3600)` (line 7)
  - `_key(prompt: str, context: Optional[str] = None) -> str` (line 10)
  - `get(key: str, default=None) -> Any` (line 14)
  - `set(key: str, value: Any) -> None` (line 22)
  - `clear() -> None` (line 30)
- **Instance:** `router_cache = RouterCache()` (line 33)

## Provider Client

### Health Monitor
- **File:** `Backend/app/providers/client.py`
- **Class:** `ModelHealthMonitor` (line 14)
- **Methods:**
  - `record_success(provider_name: str, response_time: float) -> None` (line 30)
  - `record_failure(provider_name: str, error: str) -> None` (line 38)
  - `is_healthy(provider_name: str) -> bool` (line 48)
  - `get_stats(provider_name: str) -> Optional[ProviderHealth]` (line 60)
- **Instance:** `health_monitor = ModelHealthMonitor()` (line 70)
- **Function:** `get_provider_manager()` (line 76)

## Relationship Verification

### Verified Relationships:
1. User.conversations → Conversation.user ✓ (both exist)
2. User.memories → Memory.user ✓ (Memory model referenced but not provided)
3. User.token_account → TokenAccount.user ✓ (TokenAccount model referenced but not provided)
4. User.token_transactions → TokenTransaction.user ✓ (TokenTransaction model referenced but not provided)
5. User.subscriptions → Subscription.user ✓ (Subscription model referenced but not provided)
6. Conversation.user → User.conversations ✓ (both exist)
7. Project.files → File.project ✓ (both exist)
8. Project.build_logs → BuildLog.project ✓ (both exist)
9. Project.snapshots → Snapshot.project ✓ (both exist)
10. Project.memories → UserMemory.project ✓ (UserMemory model referenced but not provided)
11. File.project → Project.files ✓ (both exist)
12. BuildLog.project → Project.build_logs ✓ (both exist)
13. Snapshot.project → Project.snapshots ✓ (both exist)

### Broken Relationships:
1. Project.chat_id → ForeignKey("chats.id") - **BROKEN**: No Chat model exists in the codebase
2. Project.memories → relationship("UserMemory") - **BROKEN**: No UserMemory model exists in the codebase

## BROKEN Section

### Missing Models
1. **Message Model** - Referenced in PRD but NOT defined anywhere in the codebase
2. **Chat Model** - Referenced in Project.chat_id ForeignKey("chats.id") but NOT defined
3. **UserMemory Model** - Referenced in Project.memories relationship but NOT defined
4. **TokenAccount Model** - Referenced in User.token_account relationship but NOT defined
5. **TokenTransaction Model** - Referenced in User.token_transactions relationship but NOT defined
6. **Subscription Model** - Referenced in User.subscriptions relationship but NOT defined
7. **Memory Model** - Referenced in User.memories relationship but NOT defined
8. **Usage Model** - Referenced in init_db() imports but NOT defined

### Missing Files
1. `Backend/app/services/auth.py` - Referenced in PRD but not provided
2. `Backend/app/core/security.py` - Referenced in PRD but not provided

### Missing Migrations
1. No migration files found in `Backend/alembic/versions/` directory
2. Alembic env.py imports models that don't exist (chat, memory, subscription)

### TODO/FIXME Search Results
No TODO/FIXME comments found in the provided files.

### Other Issues
1. `Backend/app/main.py` includes only 3 routers (chat, profile, conversations) while `Backend/main.py` includes 7 routers (auth, chat, conversations, memory, payment, tokens, upload)
2. Profile router returns hardcoded user data instead of using authentication
3. Chat router has fallback to guest user when authentication fails
4. Project model references non-existent "chats" table in ForeignKey
5. init_db() imports models that don't exist (memory, subscription, token, usage)
6. Auth router references TokenAccount and TokenTransaction models that don't exist
7. Auth router references User.to_dict() method which exists in User model
8. AI service references MemoryService and TokenService that don't exist
9. AI service references User.full_name and User.tier attributes which exist in User model
10. AI service references User.email attribute which exists in User model
11. Auth router references TokenAccount and TokenTransaction models that don't exist
12. Auth router references User.to_dict() method which exists in User model
13. AI service references MemoryService and TokenService that don't exist
14. AI service references User.full_name and User.tier attributes which exist in User model
15. AI service references User.email attribute which exists in User model
