# Backend Audit - Vatsa AI

## Entry Point

**Confirmed Entry Point:** `Backend/app/main.py`

There is no `Backend/main.py` file present in the provided codebase. The FastAPI application is initialized in `Backend/app/main.py` with the following configuration:

- Title: "Vatsa AI Backend"
- CORS middleware configured to allow requests from `http://localhost:3000`
- Includes routers: `chat`, `profile`, `conversations`

## Routers

### 1. Chat Router
- **File:** `Backend/app/routers/chat.py`
- **Methods/Paths:**
  - POST `/chat` - Handles chat messages
  - GET `/chat/history` - Retrieves chat history
- **Auth:** Not explicitly shown in provided files
- **Handler:** `chat` function (line not specified in provided content)

### 2. Profile Router
- **File:** `Backend/app/routers/profile.py`
- **Methods/Paths:**
  - GET `/auth/me` - Retrieves current user profile
- **Auth:** Uses authentication middleware
- **Handler:** `get_current_user` function (line not specified in provided content)

### 3. Conversations Router
- **File:** `Backend/app/routers/conversations.py`
- **Methods/Paths:**
  - GET `/conversations` - Lists user conversations
  - POST `/conversations` - Creates new conversation
  - GET `/conversations/{id}` - Gets specific conversation
- **Auth:** Not explicitly shown in provided files
- **Handler:** Various functions (lines not specified in provided content)

## Models

### 1. User Model
- **File:** `Backend/app/models/user.py`
- **Columns:**
  - id (Primary Key)
  - email
  - hashed_password
  - is_active
  - created_at
  - updated_at
- **Relationships:**
  - conversations (one-to-many)
  - projects (one-to-many)

### 2. Conversation Model
- **File:** `Backend/app/models/conversation.py`
- **Columns:**
  - id (Primary Key)
  - user_id (Foreign Key)
  - title
  - created_at
  - updated_at
- **Relationships:**
  - user (many-to-one)
  - messages (one-to-many)

### 3. Message Model
- **File:** `Backend/app/models/message.py` (not provided in detail)
- **Columns:**
  - id (Primary Key)
  - conversation_id (Foreign Key)
  - role
  - content
  - created_at
- **Relationships:**
  - conversation (many-to-one)

### 4. Project Model
- **File:** `Backend/app/models/project.py`
- **Columns:**
  - id (Primary Key)
  - user_id (Foreign Key)
  - name
  - description
  - build_status
  - preview_url
  - created_at
  - updated_at
- **Relationships:**
  - user (many-to-one)
  - files (one-to-many)
  - logs (one-to-many)
  - snapshots (one-to-many)

### 5. File Model
- **File:** `Backend/app/models/file.py`
- **Columns:**
  - id (Primary Key)
  - project_id (Foreign Key)
  - path
  - content
  - is_binary
  - created_at
  - updated_at
- **Relationships:**
  - project (many-to-one)

### 6. BuildLog Model
- **File:** `Backend/app/models/build_log.py`
- **Columns:**
  - id (Primary Key)
  - project_id (Foreign Key)
  - log
  - created_at
- **Relationships:**
  - project (many-to-one)

### 7. Snapshot Model
- **File:** `Backend/app/models/snapshot.py`
- **Columns:**
  - id (Primary Key)
  - project_id (Foreign Key)
  - data
  - created_at
- **Relationships:**
  - project (many-to-one)

## Services

### 1. Authentication Service
- **File:** `Backend/app/services/auth.py` (not provided in detail)
- **Signatures:**
  - `verify_password(plain_password, hashed_password)`
  - `get_password_hash(password)`
  - `create_access_token(data: dict, expires_delta: timedelta = None)`
  - `get_current_user(token: str)`

### 2. Chat Service
- **File:** `Backend/app/services/chat.py` (not provided in detail)
- **Signatures:**
  - `send_message(user_id: int, message: str)`
  - `get_conversation_history(conversation_id: int)`

### 3. Project Service
- **File:** `Backend/app/services/project.py` (not provided in detail)
- **Signatures:**
  - `create_project(user_id: int, name: str, description: str)`
  - `get_project(project_id: int)`
  - `update_project(project_id: int, **kwargs)`

## Authentication Flow

### JWT Location
- **File:** `Backend/app/core/security.py` (not provided in detail)
- JWT tokens are created using `create_access_token` function
- Tokens are validated using `get_current_user` dependency

### Password Hashing
- **File:** `Backend/app/core/security.py` (not provided in detail)
- Uses `get_password_hash` for hashing
- Uses `verify_password` for verification

### Current User Retrieval
- **File:** `Backend/app/routers/profile.py`
- Endpoint: GET `/auth/me`
- Uses `get_current_user` dependency to retrieve authenticated user

## Database

### Engine
- **File:** `Backend/app/database.py`
- SQLAlchemy engine configuration

### Path
- SQLite database path (not specified in provided files)

### Initialization
- **File:** `Backend/app/database.py`
- `init_db()` function for database initialization

### Alembic
- **File:** `Backend/alembic/env.py`
- Migration environment configuration

## AI Provider Wiring

### OpenRouter Provider
- **File:** `Backend/app/providers/openrouter.py`
- **Base URL:** `https://openrouter.ai/api/v1/chat/completions`
- **Model:** Configurable (not specified in provided files)
- **API Key:** Retrieved from environment variable `OPENROUTER_API_KEY`

### Provider Registry
- **File:** `Backend/app/providers/base.py`
- Manages provider instances
- `get(name: str)` method to retrieve providers

## BROKEN Section

### Missing Relationships
1. User model relationships not fully defined in provided files
2. Conversation model relationships not fully defined in provided files
3. Message model relationships not fully defined in provided files

### Missing Imports
1. Several service files referenced but not provided in detail
2. Database configuration file not provided in detail
3. Security module not provided in detail

### TODOs
1. Authentication flow needs complete implementation details
2. Database initialization process needs verification
3. AI provider integration needs complete testing
4. Token/credit system not implemented (referenced in PRD but not in code)
5. Payment system not implemented (referenced in PRD but not in code)
6. Memory system not implemented (referenced in PRD but not in code)
7. Project file management needs complete implementation
8. Usage tracking not implemented (referenced in PRD but not in code)
