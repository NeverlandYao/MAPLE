.PHONY: help install backend frontend-chatbot frontend-dashboard dev lint check init-experiment-db

help:
	@echo "MAPLE developer commands"
	@echo "  make install            Install backend dependencies"
	@echo "  make backend            Run backend only"
	@echo "  make frontend-chatbot   Run chatbot frontend only"
	@echo "  make frontend-dashboard Run dashboard frontend only"
	@echo "  make dev                Run all services"
	@echo "  make check              Quick backend syntax check"
	@echo "  make init-experiment-db Initialize experimental DB schema"

install:
	cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt

backend:
	cd backend && . .venv/bin/activate && python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

frontend-chatbot:
	cd frontend/chatbot && python3 -m http.server 3001

frontend-dashboard:
	cd frontend/dashboard && python3 -m http.server 3002

dev:
	./start_maple.sh

check:
	PYTHONPYCACHEPREFIX=/tmp/maple-pyc python3 -m py_compile \
		backend/main.py \
		backend/app/config.py \
		backend/app/paths.py \
		backend/app/api/chat.py \
		backend/app/api/analyze.py \
		backend/app/database/db.py

init-experiment-db:
	cd backend && . .venv/bin/activate && cd .. && python3 scripts/init_experiment_db.py
