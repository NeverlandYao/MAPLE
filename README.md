# MAPLE

MAPLE (Multi-Agent Pedagogical Literacy Engine) is an AI literacy assessment system that evaluates students' interaction with AI through a chat interface.

## Features

- **Chatbot Interface**: A Gemini-like chat interface for students to interact with AI.
- **Dynamic Expert Routing**: Analyzes user intent and switches between different expert agents (Technologist, Pedagogue, Ethicist).
- **Evidence-Based Scoring**: Evaluates AI literacy based on observed behaviors (Hit/Miss) using GLAT methodology.
- **Dashboard**: A visualization dashboard to view student assessment scores and radar charts.

## Project Structure

- `frontend/chatbot`: The student-facing chat interface.
- `frontend/dashboard`: The teacher-facing assessment dashboard.
- `backend`: The FastAPI backend handling chat, analysis, and persistence.
- `backend/app/api`: API routers (`chat`, `analyze`).
- `backend/app/database`: PostgreSQL persistence layer.
- `backend/app/database/experiments_schema.sql`: experimental schema for research workflows.
- `backend/data/logs`: legacy directory (no longer used for persistence).
- `scripts`: Project scripts (single-command local startup).
- `start_maple.sh`: Backward-compatible root startup entrypoint.
- `Makefile`: Common developer commands.

## Getting Started

Run everything with one command from the project root:

```bash
./start_maple.sh
```

This starts:
- Backend: `http://localhost:8000`
- Chatbot: `http://localhost:3001`
- Dashboard: `http://localhost:3002`

Press `Ctrl+C` to stop all services.

## Environment Setup

1. Copy template:
```bash
cp backend/.env.example backend/.env
```
2. Fill in real values in `backend/.env`, especially:
- `MS_API_KEY`
- `DATABASE_URL`

MAPLE now uses cloud PostgreSQL only for session, dispatcher, and judge persistence.
You can optionally configure Google as an automatic LLM fallback via `GOOGLE_*` env vars.

## Developer Commands

```bash
make install
make dev
make check
make init-experiment-db
```

Optional API smoke test:
```bash
python3 scripts/test_model_api.py
```
