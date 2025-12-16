from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import chat, analyze

app = FastAPI(title="MAPLE API", description="Backend for MAPLE AI Literacy Assessment System")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development, allow all origins. In production, specify frontend URL.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(analyze.router, prefix="/api/analyze", tags=["analyze"])

@app.get("/")
async def root():
    return {"message": "Welcome to MAPLE API"}
