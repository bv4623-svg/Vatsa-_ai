{
  "models": [
    {
      "id": "openai/gpt-4.1-mini",
      "provider": "openrouter",
      "capabilities": ["simple_qa", "reasoning", "coding"],
      "context_window": 128000,
      "cost_per_1k_input": 0.00015,
      "cost_per_1k_output": 0.0006,
      "latency_score": 9,
      "weight": 1.0
    },
    {
      "id": "openai/gpt-4o",
      "provider": "openrouter",
      "capabilities": ["reasoning", "coding", "vision", "search"],
      "context_window": 128000,
      "cost_per_1k_input": 0.005,
      "cost_per_1k_output": 0.015,
      "latency_score": 8,
      "weight": 0.9
    },
    {
      "id": "google/gemini-2.5-pro",
      "provider": "openrouter",
      "capabilities": ["reasoning", "coding", "long_context", "vision", "search"],
      "context_window": 1000000,
      "cost_per_1k_input": 0.0025,
      "cost_per_1k_output": 0.01,
      "latency_score": 6,
      "weight": 0.8
    },
    {
      "id": "deepseek/deepseek-v3",
      "provider": "openrouter",
      "capabilities": ["reasoning", "coding"],
      "context_window": 128000,
      "cost_per_1k_input": 0.0005,
      "cost_per_1k_output": 0.001,
      "latency_score": 9,
      "weight": 0.7
    },
    {
      "id": "google/gemini-2.5-flash",
      "provider": "openrouter",
      "capabilities": ["simple_qa"],
      "context_window": 1000000,
      "cost_per_1k_input": 0.0001,
      "cost_per_1k_output": 0.0004,
      "latency_score": 10,
      "weight": 0.5
    }
  ],
  "weights": {
    "capability": 0.6,
    "cost": 0.15,
    "latency": 0.15,
    "health": 0.1
  },
  "circuit_breaker_threshold": 3,
  "circuit_breaker_timeout": 60,
  "parallel_race": false
}