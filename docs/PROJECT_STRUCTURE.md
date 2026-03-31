# MAPLE Project Structure

## Overview

- `backend/`
  - `main.py`: FastAPI app factory and route mounting.
  - `app/config.py`: Environment loading.
  - `app/api/`: API routers.
  - `app/database/`: DB models + DB read/write functions.
- `frontend/`
  - `chatbot/`: student UI.
  - `dashboard/`: teacher UI.
- `scripts/start_maple.sh`: starts all local services.
- `start_maple.sh`: root wrapper to keep one-command startup stable.
- `Makefile`: common developer workflows.

## Design Notes

- Keep API/business logic separated from storage details.
- Keep UI assets independent from backend runtime code.
- Prefer environment-based configuration via `backend/.env`.
