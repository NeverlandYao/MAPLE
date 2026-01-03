from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.api import chat, analyze
import os

app = FastAPI(title="MAPLE API", description="Backend for MAPLE AI Literacy Assessment System")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(analyze.router, prefix="/api/analyze", tags=["analyze"])

# Mount Static Files
# Ensure directories exist to prevent errors
os.makedirs("static/chatbot", exist_ok=True)
os.makedirs("static/dashboard", exist_ok=True)

app.mount("/chatbot", StaticFiles(directory="static/chatbot", html=True), name="chatbot")
app.mount("/dashboard", StaticFiles(directory="static/dashboard", html=True), name="dashboard")

# Serve index at root (redirect to chatbot or serve directly)
@app.get("/")
async def root():
    return FileResponse("static/chatbot/index.html")

@app.get("/health")
async def health_check():
    return {"status": "ok"}
