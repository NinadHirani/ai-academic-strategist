"""
Mini GPT Lab — FastAPI Server
===============================

Provides HTTP endpoints for the sandbox UI to:
  - Train the model
  - Generate text
  - Retrieve attention weights
  - Get token embeddings
  - View training loss history

This server is COMPLETELY ISOLATED from the production AI pipeline.
It runs as a separate process and has no connection to Groq, Supabase,
or the RAG system.

Run: uvicorn server:app --port 8100 --reload
"""

import os
import sys
import json
import time
import numpy as np
from typing import Optional, Dict, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from model import MiniGPT, GPTConfig
from tokenizer import CharTokenizer
from dataset import get_dataset, create_training_pairs, get_batches, DATASETS
from generate import generate, generate_with_details

# ============================================================================
# Server State
# ============================================================================

# Global model and tokenizer (in-memory, ephemeral)
_state: Dict = {
    "model": None,
    "tokenizer": None,
    "training_log": [],
    "is_training": False,
    "dataset_name": None,
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize with a default model on startup."""
    print("[Mini GPT Server] Starting up...")
    print("[Mini GPT Server] This is an EDUCATIONAL sandbox — NOT connected to production AI.")
    
    # Try to load a saved model
    model_path = os.path.join(os.path.dirname(__file__), "saved_model.json")
    tokenizer_path = os.path.join(os.path.dirname(__file__), "saved_tokenizer.json")
    
    if os.path.exists(model_path) and os.path.exists(tokenizer_path):
        try:
            with open(model_path, "r") as f:
                state = json.load(f)
            config = GPTConfig(**state["config"])
            model = MiniGPT(config)
            model.token_embedding = np.array(state["token_embedding"])
            model.training_step = state["training_step"]
            model.loss_history = state["loss_history"]
            
            tokenizer = CharTokenizer()
            tokenizer.load(tokenizer_path)
            
            _state["model"] = model
            _state["tokenizer"] = tokenizer
            print("[Mini GPT Server] Loaded saved model.")
        except Exception as e:
            print(f"[Mini GPT Server] Failed to load saved model: {e}")
    
    yield
    
    print("[Mini GPT Server] Shutting down.")


app = FastAPI(
    title="Mini GPT Lab API",
    description="Educational transformer sandbox — NOT a production AI service.",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow CORS from the Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Request/Response Models
# ============================================================================

class TrainRequest(BaseModel):
    dataset: str = Field(default="shakespeare", description="Dataset name")
    n_steps: int = Field(default=300, ge=10, le=5000, description="Training steps")
    batch_size: int = Field(default=16, ge=1, le=128)
    learning_rate: float = Field(default=1e-3, gt=0, le=1.0)
    context_length: int = Field(default=32, ge=8, le=128)
    d_model: int = Field(default=64, ge=16, le=256)
    n_heads: int = Field(default=4, ge=1, le=16)
    n_layers: int = Field(default=2, ge=1, le=8)
    d_ff: int = Field(default=128, ge=32, le=512)


class GenerateRequest(BaseModel):
    prompt: str = Field(default="", description="Starting text")
    max_tokens: int = Field(default=100, ge=1, le=500)
    temperature: float = Field(default=0.8, ge=0.0, le=2.0)
    top_k: Optional[int] = Field(default=None, ge=1, le=100)


# ============================================================================
# Endpoints
# ============================================================================

@app.get("/")
def root():
    """Health check and status."""
    has_model = _state["model"] is not None
    return {
        "service": "Mini GPT Lab (Educational Sandbox)",
        "status": "running",
        "has_model": has_model,
        "is_training": _state["is_training"],
        "training_steps": _state["model"].training_step if has_model else 0,
        "note": "This is an ISOLATED educational module. NOT connected to production AI.",
    }


@app.get("/datasets")
def list_datasets():
    """List available toy datasets."""
    return {
        "datasets": [
            {
                "name": name,
                "length": len(text),
                "preview": text[:150] + "...",
            }
            for name, text in DATASETS.items()
        ]
    }


@app.post("/train")
def train_model(req: TrainRequest):
    """
    Train a new model from scratch.
    
    This is synchronous and blocks until training is complete.
    For a tiny model, this takes seconds on CPU.
    """
    if _state["is_training"]:
        raise HTTPException(status_code=409, detail="Training already in progress")
    
    _state["is_training"] = True
    training_log = []
    
    try:
        # Load dataset
        text = get_dataset(req.dataset)
        
        # Tokenize
        tokenizer = CharTokenizer()
        tokenizer.fit(text)
        token_ids = tokenizer.encode(text)
        
        # Create training pairs
        inputs, targets = create_training_pairs(token_ids, req.context_length)
        
        if len(inputs) == 0:
            raise HTTPException(
                status_code=400,
                detail=f"Dataset too short for context_length={req.context_length}"
            )
        
        # Initialize model
        config = GPTConfig(
            vocab_size=tokenizer.vocab_size,
            d_model=req.d_model,
            n_heads=req.n_heads,
            n_layers=req.n_layers,
            d_ff=req.d_ff,
            context_length=req.context_length,
            learning_rate=req.learning_rate,
        )
        model = MiniGPT(config)
        
        start_time = time.time()
        log_every = max(1, req.n_steps // 50)  # ~50 log points
        
        for step in range(1, req.n_steps + 1):
            batches = get_batches(inputs, targets, req.batch_size, shuffle=True)
            batch_inputs, batch_targets = batches[0]
            
            logits = model.forward(batch_inputs)
            loss, grad_logits = model.compute_loss(logits, batch_targets)
            model.backward(grad_logits)
            model.update_parameters(req.learning_rate)
            model.loss_history.append(float(loss))
            
            if step % log_every == 0 or step == 1 or step == req.n_steps:
                elapsed = time.time() - start_time
                training_log.append({
                    "step": step,
                    "loss": round(float(loss), 4),
                    "elapsed": round(elapsed, 2),
                })
        
        total_time = time.time() - start_time
        
        # Save to state
        _state["model"] = model
        _state["tokenizer"] = tokenizer
        _state["training_log"] = training_log
        _state["dataset_name"] = req.dataset
        
        # Save to disk
        try:
            model_dir = os.path.dirname(os.path.abspath(__file__))
            model_state = model.get_model_state()
            with open(os.path.join(model_dir, "saved_model.json"), "w") as f:
                json.dump(model_state, f)
            tokenizer.save(os.path.join(model_dir, "saved_tokenizer.json"))
        except Exception:
            pass  # Non-critical
        
        return {
            "success": True,
            "total_steps": req.n_steps,
            "final_loss": round(model.loss_history[-1], 4),
            "training_time_seconds": round(total_time, 2),
            "parameters": model.count_parameters(),
            "vocab_size": tokenizer.vocab_size,
            "training_log": training_log,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        _state["is_training"] = False


@app.post("/generate")
def generate_text(req: GenerateRequest):
    """Generate text from the trained model."""
    if _state["model"] is None or _state["tokenizer"] is None:
        raise HTTPException(status_code=400, detail="No model trained yet. Train first.")
    
    try:
        result = generate_with_details(
            _state["model"],
            _state["tokenizer"],
            prompt=req.prompt,
            max_tokens=req.max_tokens,
            temperature=req.temperature,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/attention")
def get_attention_weights():
    """
    Get attention weights from the last forward pass.
    
    Returns attention patterns for each layer and head.
    Useful for visualizing what tokens attend to what.
    """
    if _state["model"] is None:
        raise HTTPException(status_code=400, detail="No model trained yet.")
    
    model = _state["model"]
    weights = model.get_all_attention_weights()
    
    if not weights:
        raise HTTPException(status_code=400, detail="No attention weights cached. Run generation first.")
    
    # Convert to serializable format
    result = []
    for layer_idx, layer_weights in enumerate(weights):
        # layer_weights shape: (batch, n_heads, seq_len, seq_len)
        # Take first batch example
        for head_idx in range(layer_weights.shape[1]):
            attn_matrix = layer_weights[0, head_idx].tolist()
            result.append({
                "layer": layer_idx,
                "head": head_idx,
                "attention_matrix": attn_matrix,
                "shape": list(layer_weights[0, head_idx].shape),
            })
    
    return {
        "n_layers": len(weights),
        "n_heads": model.config.n_heads,
        "attention_heads": result,
    }


@app.get("/embeddings")
def get_embeddings():
    """
    Get token embeddings for visualization.
    
    Returns the embedding vectors which can be projected to 2D
    using PCA or t-SNE for visualization.
    """
    if _state["model"] is None or _state["tokenizer"] is None:
        raise HTTPException(status_code=400, detail="No model trained yet.")
    
    model = _state["model"]
    tokenizer = _state["tokenizer"]
    embeddings = model.get_token_embeddings()
    
    # Simple PCA to 2D for visualization
    # Center the data
    mean = embeddings.mean(axis=0)
    centered = embeddings - mean
    
    # Compute covariance and eigenvectors
    cov = np.cov(centered.T)
    eigenvalues, eigenvectors = np.linalg.eigh(cov)
    
    # Project to top 2 principal components
    top2 = eigenvectors[:, -2:][:, ::-1]  # Largest 2
    projected = centered @ top2
    
    # Build response
    tokens = []
    for token_str, token_id in tokenizer.get_vocab().items():
        if token_str in (CharTokenizer.PAD_TOKEN, CharTokenizer.UNK_TOKEN):
            display = token_str
        elif token_str == " ":
            display = "⎵"
        elif token_str == "\n":
            display = "↵"
        else:
            display = token_str
        
        tokens.append({
            "token": display,
            "token_id": token_id,
            "x": float(projected[token_id, 0]),
            "y": float(projected[token_id, 1]),
            "embedding_norm": float(np.linalg.norm(embeddings[token_id])),
        })
    
    return {
        "vocab_size": tokenizer.vocab_size,
        "d_model": model.config.d_model,
        "tokens": tokens,
        "explained_variance": [float(eigenvalues[-1]), float(eigenvalues[-2])],
    }


@app.get("/loss-history")
def get_loss_history():
    """Get complete training loss history."""
    if _state["model"] is None:
        raise HTTPException(status_code=400, detail="No model trained yet.")
    
    return {
        "total_steps": _state["model"].training_step,
        "losses": _state["model"].loss_history,
        "training_log": _state["training_log"],
    }


@app.get("/model-info")
def get_model_info():
    """Get detailed model architecture information."""
    if _state["model"] is None:
        return {
            "loaded": False,
            "message": "No model trained yet. Use /train to create one.",
        }
    
    model = _state["model"]
    config = model.config
    
    return {
        "loaded": True,
        "parameters": model.count_parameters(),
        "config": {
            "vocab_size": config.vocab_size,
            "d_model": config.d_model,
            "n_heads": config.n_heads,
            "n_layers": config.n_layers,
            "d_ff": config.d_ff,
            "context_length": config.context_length,
        },
        "training_steps": model.training_step,
        "final_loss": model.loss_history[-1] if model.loss_history else None,
        "architecture": {
            "type": "GPT (decoder-only transformer)",
            "embedding": "Token embedding + sinusoidal positional encoding",
            "attention": f"Multi-head causal self-attention ({config.n_heads} heads)",
            "normalization": "RMSNorm (pre-norm)",
            "activation": "GELU",
            "output": "Weight-tied with token embedding",
        },
        "isolation_notice": "This model is COMPLETELY ISOLATED from the production AI pipeline.",
    }


if __name__ == "__main__":
    import uvicorn
    
    print("\n" + "=" * 60)
    print("🧪 MINI GPT LAB — Educational Transformer Sandbox")
    print("=" * 60)
    print("This server is ISOLATED from the production AI system.")
    print("Production uses: Groq/Ollama + Supabase + pgvector + RAG")
    print("This sandbox uses: Pure NumPy transformer on toy data")
    print("=" * 60 + "\n")
    
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8100,
        reload=True,
        log_level="info",
    )
