import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import load_backend_env
from app.database.db import init_db
from app.paths import (
    CHATBOT_FRONTEND_DIR,
    DASHBOARD_FRONTEND_DIR,
    STATIC_CHATBOT_DIR,
    STATIC_DASHBOARD_DIR,
)

load_backend_env()
from app.api import analyze, chat


def resolve_static_dir(primary: str, fallback: str) -> str:
    primary_path = Path(primary)
    return str(primary_path) if (primary_path / "index.html").exists() else fallback


def create_app() -> FastAPI:
    app = FastAPI(
        title="MAPLE API",
        description="Backend for MAPLE AI Literacy Assessment System",
    )

    init_db()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
    app.include_router(analyze.router, prefix="/api/analyze", tags=["analyze"])

    os.makedirs(STATIC_CHATBOT_DIR, exist_ok=True)
    os.makedirs(STATIC_DASHBOARD_DIR, exist_ok=True)
    chatbot_dir = resolve_static_dir(str(STATIC_CHATBOT_DIR), str(CHATBOT_FRONTEND_DIR))
    dashboard_dir = resolve_static_dir(str(STATIC_DASHBOARD_DIR), str(DASHBOARD_FRONTEND_DIR))

    app.mount("/chatbot", StaticFiles(directory=chatbot_dir, html=True), name="chatbot")
    app.mount("/dashboard", StaticFiles(directory=dashboard_dir, html=True), name="dashboard")

    @app.get("/")
    async def root():
        static_index = STATIC_CHATBOT_DIR / "index.html"
        if static_index.exists():
            return FileResponse(str(static_index))
        return FileResponse(str(CHATBOT_FRONTEND_DIR / "index.html"))

    @app.get("/health")
    async def health_check():
        return {"status": "ok"}

    @app.get("/api/status")
    async def api_status():
        from app.llm import get_provider_status
        providers = get_provider_status()
        active = next((p for p in providers if not p["degraded"]), providers[0] if providers else None)
        return {
            "status": "ok",
            "active_provider": active["name"] if active else "none",
            "active_model": active["model"] if active else "none",
            "providers": providers,
        }

    return app


app = create_app()
