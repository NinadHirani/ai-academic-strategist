"""
FastAPI server for Atomic Karpathy GPT
Endpoints:
- /train: Train the model
- /generate: Generate samples
"""
from fastapi import FastAPI
from pydantic import BaseModel
from atomic_gpt import AtomicGPT

app = FastAPI()
gpt_model = None

class TrainRequest(BaseModel):
    num_steps: int = 1000
    learning_rate: float = 0.01
    beta1: float = 0.85
    beta2: float = 0.99
    eps_adam: float = 1e-8

class TrainResponse(BaseModel):
    final_loss: float
    vocab_size: int
    num_docs: int
    num_params: int

class GenerateRequest(BaseModel):
    temperature: float = 0.5
    num_samples: int = 20

class GenerateResponse(BaseModel):
    samples: list[str]

@app.post("/train", response_model=TrainResponse)
def train_model(req: TrainRequest):
    global gpt_model
    gpt_model = AtomicGPT()
    final_loss = gpt_model.train(
        num_steps=req.num_steps,
        learning_rate=req.learning_rate,
        beta1=req.beta1,
        beta2=req.beta2,
        eps_adam=req.eps_adam,
    )
    return TrainResponse(
        final_loss=final_loss,
        vocab_size=gpt_model.vocab_size,
        num_docs=len(gpt_model.docs),
        num_params=len(gpt_model.params),
    )

@app.post("/generate", response_model=GenerateResponse)
def generate_samples(req: GenerateRequest):
    global gpt_model
    if gpt_model is None:
        gpt_model = AtomicGPT()
        gpt_model.train(num_steps=1000)
    samples = gpt_model.generate(
        temperature=req.temperature,
        num_samples=req.num_samples,
    )
    return GenerateResponse(samples=samples)
