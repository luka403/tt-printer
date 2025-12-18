from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import os
import uuid
from dotenv import load_dotenv
import torch
from diffusers import StableDiffusionPipeline, DiffusionPipeline
from PIL import Image
import io
import base64

load_dotenv()

app = FastAPI(title="Image Generation API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
API_KEY = os.getenv("API_KEY", "tt-printer-secret-key-2025")
MODEL_ID = os.getenv("IMAGE_MODEL", "runwayml/stable-diffusion-v1-5")
OUTPUT_DIR = os.getenv("IMAGE_OUTPUT_DIR", "./generated_images")
DEVICE = "cpu"  # Force CPU mode
USE_CPU_OPTIMIZATION = True

# Create output directory
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Global model instance (lazy loaded)
_pipeline = None

def get_pipeline():
    """Lazy load the image generation pipeline (supports SD and Flux)"""
    global _pipeline
    if _pipeline is None:
        print(f"Loading model: {MODEL_ID}")
        print("This may take a few minutes on first load...")
        
        try:
            # Check if it's Flux model (contains 'flux' in name)
            is_flux = 'flux' in MODEL_ID.lower()
            
            if is_flux:
                # Use DiffusionPipeline for Flux
                print("Detected Flux model, using DiffusionPipeline...")
                _pipeline = DiffusionPipeline.from_pretrained(
                    MODEL_ID,
                    torch_dtype=torch.float32,
                )
                _pipeline = _pipeline.to(DEVICE)
                
                # Flux optimizations
                if hasattr(_pipeline, 'enable_attention_slicing'):
                    _pipeline.enable_attention_slicing()
            else:
                # Use StableDiffusionPipeline for SD models
                if USE_CPU_OPTIMIZATION:
                    _pipeline = StableDiffusionPipeline.from_pretrained(
                        MODEL_ID,
                        torch_dtype=torch.float32,
                        safety_checker=None,
                        requires_safety_checker=False
                    )
                    _pipeline = _pipeline.to(DEVICE)
                    
                    if hasattr(_pipeline, 'enable_attention_slicing'):
                        _pipeline.enable_attention_slicing()
                    # Note: enable_sequential_cpu_offload requires accelerator
                else:
                    _pipeline = StableDiffusionPipeline.from_pretrained(MODEL_ID)
                    _pipeline = _pipeline.to(DEVICE)
            
            print("Model loaded successfully!")
        except Exception as e:
            print(f"Error loading model: {e}")
            raise
    
    return _pipeline

# Request/Response models
class ImageGenerationRequest(BaseModel):
    prompt: str
    style: str = "simple_cartoon"
    negative_prompt: Optional[str] = None
    num_inference_steps: int = 20  # Reduced for CPU speed
    width: int = 512
    height: int = 512
    seed: Optional[int] = None

class ImageGenerationResponse(BaseModel):
    image_path: str
    image_url: str
    prompt: str
    seed: int

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
    return {
        "status": "ok",
        "model": MODEL_ID,
        "device": DEVICE,
        "model_loaded": _pipeline is not None
    }

# Generate image endpoint
@app.post("/generate-image", response_model=ImageGenerationResponse)
async def generate_image(
    request: ImageGenerationRequest,
    api_key: str = Depends(verify_api_key)
):
    try:
        # Enhance prompt with style
        enhanced_prompt = enhance_prompt_with_style(request.prompt, request.style)
        
        # Default negative prompt for better quality
        DEFAULT_NEGATIVE_PROMPT = os.getenv("DEFAULT_NEGATIVE_PROMPT", "blurry, low quality, distorted, ugly, bad anatomy, watermark")
        negative_prompt = request.negative_prompt or DEFAULT_NEGATIVE_PROMPT
        
        print(f"Generating image with prompt: {enhanced_prompt[:100]}...")
        print(f"Style: {request.style}, Steps: {request.num_inference_steps}")
        
        # Get pipeline
        pipeline = get_pipeline()
        
        # Generate image
        generator = None
        if request.seed is not None:
            generator = torch.Generator(device=DEVICE).manual_seed(request.seed)
        
        image = pipeline(
            prompt=enhanced_prompt,
            negative_prompt=negative_prompt,
            num_inference_steps=request.num_inference_steps,
            width=request.width,
            height=request.height,
            generator=generator
        ).images[0]
        
        # Save image
        image_id = str(uuid.uuid4())
        image_filename = f"{image_id}.png"
        image_path = os.path.join(OUTPUT_DIR, image_filename)
        image.save(image_path)
        
        # Get seed used
        used_seed = request.seed if request.seed is not None else generator.initial_seed() if generator else 0
        
        print(f"Image generated and saved: {image_path}")
        
        return ImageGenerationResponse(
            image_path=image_path,
            image_url=f"/images/{image_filename}",
            prompt=enhanced_prompt,
            seed=used_seed
        )
        
    except Exception as e:
        print(f"Error generating image: {e}")
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")

# Serve generated images
@app.get("/images/{filename}")
async def get_image(filename: str):
    image_path = os.path.join(OUTPUT_DIR, filename)
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(image_path)

def enhance_prompt_with_style(prompt: str, style: str) -> str:
    """Enhance the prompt with style-specific keywords"""
    # Style enhancements can be customized via environment variables
    # Format: STYLE_SIMPLE_CARTOON="your custom prompt"
    style_enhancements = {
        "simple_cartoon": os.getenv("STYLE_SIMPLE_CARTOON", "simple cartoon style, clean lines, vibrant colors, 2D animation style"),
        "anime": os.getenv("STYLE_ANIME", "anime style, detailed, vibrant colors, high quality"),
        "western_cartoon": os.getenv("STYLE_WESTERN_CARTOON", "western cartoon style, Disney Pixar style, 3D rendered"),
        "comic_book": os.getenv("STYLE_COMIC_BOOK", "comic book style, bold lines, dynamic composition"),
        "default": os.getenv("STYLE_DEFAULT", "simple cartoon style, clean lines, vibrant colors")
    }
    
    style_text = style_enhancements.get(style, style_enhancements["default"])
    return f"{style_text}, {prompt}"

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("IMAGE_API_PORT", 8001))
    print(f"🚀 Starting Image Generation API on port {port}")
    print(f"🔑 API Key: {API_KEY}")
    print(f"📦 Model: {MODEL_ID}")
    print(f"💻 Device: {DEVICE}")
    print(f"📁 Output Directory: {OUTPUT_DIR}")
    uvicorn.run(app, host="0.0.0.0", port=port)

