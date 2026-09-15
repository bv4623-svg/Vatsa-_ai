from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import chat, profile, conversations
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="Vatsa AI Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(chat.router)
app.include_router(profile.router)
app.include_router(profile.auth_router)   # /auth/me
app.include_router(conversations.router)
