from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Ollama LLM API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
API_KEY = os.getenv("API_KEY", "tt-printer-secret-key-2025")  # Promeni ovo!
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "llama3.1:8b")

# Request/Response models
class Message(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    model: str = DEFAULT_MODEL
    messages: List[Message]
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    stream: bool = False

class ChatCompletionChoice(BaseModel):
    index: int
    message: Message
    finish_reason: str = "stop"

class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[ChatCompletionChoice]

# API Key dependency
async def verify_api_key(x_api_key: str = Header(None, alias="X-API-Key")):
    if not x_api_key or x_api_key != API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing API key. Use X-API-Key header."
        )
    return x_api_key

# Health check
@app.get("/health")
async def health():
    return {"status": "ok", "ollama_url": OLLAMA_BASE_URL}

# List available models
@app.get("/v1/models")
async def list_models(api_key: str = Depends(verify_api_key)):
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail="Ollama not reachable")
            
            models_data = response.json()
            models = []
            for model in models_data.get("models", []):
                models.append({
                    "id": model.get("name", ""),
                    "object": "model",
                    "created": model.get("modified_at", 0),
                    "owned_by": "ollama"
                })
            
            return {
                "object": "list",
                "data": models
            }
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Ollama connection error: {str(e)}")

# Chat completions endpoint (OpenAI compatible)
@app.post("/v1/chat/completions", response_model=ChatCompletionResponse)
async def chat_completions(
    request: ChatCompletionRequest,
    api_key: str = Depends(verify_api_key)
):
    try:
        # Convert messages to Ollama format
        ollama_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in request.messages
        ]
        
        # Prepare Ollama request (Ollama uses /api/chat endpoint)
        ollama_payload = {
            "model": request.model,
            "messages": ollama_messages,
            "stream": False,
            "options": {
                "temperature": request.temperature,
            }
        }
        
        if request.max_tokens:
            ollama_payload["options"]["num_predict"] = request.max_tokens
        
        # Call Ollama API
        async with httpx.AsyncClient(timeout=120.0) as client:
            # Ollama uses /api/chat endpoint (not /v1/chat/completions)
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json=ollama_payload
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Ollama error: {response.text}"
                )
            
            ollama_response = response.json()
            
            # Ollama returns: {"message": {"role": "assistant", "content": "..."}, ...}
            assistant_message = ollama_response.get("message", {})
            content = assistant_message.get("content", "")
            
            # Convert Ollama response to OpenAI format
            import time
            return ChatCompletionResponse(
                id=f"chatcmpl-{int(time.time())}",
                created=int(time.time()),
                model=request.model,
                choices=[
                    ChatCompletionChoice(
                        index=0,
                        message=Message(
                            role="assistant",
                            content=content
                        ),
                        finish_reason="stop"
                    )
                ]
            )
            
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Ollama connection error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    print(f"🚀 Starting Ollama LLM API on port {port}")
    print(f"🔑 API Key: {API_KEY}")
    print(f"📡 Ollama URL: {OLLAMA_BASE_URL}")
    print(f"🤖 Default Model: {DEFAULT_MODEL}")
    uvicorn.run(app, host="0.0.0.0", port=port)

