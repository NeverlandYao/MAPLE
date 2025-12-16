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
- `backend`: The FastAPI backend handling chat and analysis.

## Getting Started

1.  Start the Backend:
    ```bash
    cd backend
    uvicorn main:app --reload
    ```
2.  Start the Chatbot:
    ```bash
    cd frontend/chatbot
    python3 -m http.server 3001
    ```
3.  Start the Dashboard:
    ```bash
    cd frontend/dashboard
    python3 -m http.server 3002
    ```
