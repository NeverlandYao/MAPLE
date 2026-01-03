from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import time
import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

router = APIRouter()

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    session_id: str
    messages: List[Message]
    
class ChatResponse(BaseModel):
    response: str
    timestamp: float

# Initialize OpenAI client compatible with ModelScope
client = OpenAI(
    api_key=os.getenv("MS_API_KEY"),
    base_url=os.getenv("MS_BASE_URL")
)

import json
from pathlib import Path

# ... (Previous imports)

# Setup data directory
DATA_DIR = Path("data/logs")
DATA_DIR.mkdir(parents=True, exist_ok=True)

def save_conversation_log(session_id: str, messages: List[dict]):
    """Saves conversation logs to a JSON file."""
    log_file = DATA_DIR / f"{session_id}.json"
    with open(log_file, "w", encoding="utf-8") as f:
        json.dump(messages, f, ensure_ascii=False, indent=2)

@router.post("/", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        # Prepare messages for the API
        messages_payload = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
        # Call ModelScope API
        completion = client.chat.completions.create(
            model=os.getenv("MS_MODEL", "deepseek-ai/DeepSeek-R1-distill-Qwen-7B"), 
            messages=messages_payload,
            temperature=0.6,
            stream=False, # Keep it false for now as frontend expects full response
            extra_body={"enable_thinking": False} # Must be False for non-streaming calls
        )
        
        # DeepSeek R1 often includes reasoning in <think> tags.
        # We should parse this out if we want to visualize it separately, 
        # but for now let's just return the content.
        ai_response = completion.choices[0].message.content
        
        # --- LOGGING START ---
        # Append AI response to the log payload and save
        messages_payload.append({"role": "assistant", "content": ai_response})
        save_conversation_log(request.session_id, messages_payload)
        # --- LOGGING END ---

        return ChatResponse(
            response=ai_response,
            timestamp=time.time()
        )
    except Exception as e:
        print(f"Error calling ModelScope API: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions", response_model=List[dict])
async def list_sessions():
    """Lists all available chat sessions."""
    sessions = []
    try:
        if not DATA_DIR.exists():
            return []
        
        # Sort files by modification time (newest first)
        files = sorted(DATA_DIR.glob("*.json"), key=os.path.getmtime, reverse=True)
        
        for file in files:
            try:
                with open(file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    
                # Extract basic info
                session_id = file.stem
                timestamp = os.path.getmtime(file)
                
                # Get last user message as preview, or first message
                preview = "Empty conversation"
                if data:
                    # Find last user message
                    user_msgs = [m['content'] for m in data if m.get('role') == 'user']
                    if user_msgs:
                        preview = user_msgs[-1][:50] + "..." if len(user_msgs[-1]) > 50 else user_msgs[-1]
                    else:
                         preview = data[0].get('content', '')[:50]
                
                sessions.append({
                    "session_id": session_id,
                    "timestamp": timestamp,
                    "preview": preview,
                    "message_count": len(data)
                })
            except Exception as e:
                print(f"Error reading session file {file}: {e}")
                continue
                
        return sessions
    except Exception as e:
        print(f"Error listing sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))
