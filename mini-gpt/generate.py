"""
Mini GPT Lab — Text Generation
================================

Generates text from a trained Mini GPT model using autoregressive sampling.

The generation process:
  1. Start with a prompt (seed text)
  2. Encode prompt to token IDs
  3. Feed tokens through the model → get logits for next token
  4. Sample from the distribution (with temperature)
  5. Append sampled token
  6. Repeat from step 3

Temperature controls randomness:
  - temp → 0: Always pick the most likely token (greedy, deterministic)
  - temp = 1:  Sample from the model's learned distribution
  - temp > 1:  More random/creative (flatter distribution)
"""

import numpy as np
from typing import List, Optional
from model import MiniGPT, softmax
from tokenizer import CharTokenizer


def generate(
    model: MiniGPT,
    tokenizer: CharTokenizer,
    prompt: str = "",
    max_tokens: int = 100,
    temperature: float = 0.8,
    top_k: Optional[int] = None,
) -> str:
    """
    Generate text autoregressively from the model.
    
    Args:
        model: Trained MiniGPT model
        tokenizer: Fitted tokenizer
        prompt: Starting text (can be empty)
        max_tokens: Maximum tokens to generate
        temperature: Sampling temperature (0 = greedy, > 0 = stochastic)
        top_k: If set, only sample from top-k most likely tokens
        
    Returns:
        Generated text string
    """
    # Encode prompt
    if prompt:
        token_ids = tokenizer.encode(prompt)
    else:
        # Start with a random token
        token_ids = [np.random.randint(2, tokenizer.vocab_size)]
    
    generated_ids = list(token_ids)
    context_length = model.config.context_length
    
    for _ in range(max_tokens):
        # Use only the last context_length tokens (sliding window)
        context = generated_ids[-context_length:]
        
        # Forward pass
        input_array = np.array([context])  # (1, seq_len)
        logits = model.forward(input_array)  # (1, seq_len, vocab_size)
        
        # Get logits for the last position (next token prediction)
        next_logits = logits[0, -1, :]  # (vocab_size,)
        
        # Apply temperature
        if temperature > 0:
            next_logits = next_logits / temperature
        
        # Optional top-k filtering
        if top_k is not None and top_k > 0:
            # Zero out everything except the top-k logits
            top_indices = np.argsort(next_logits)[-top_k:]
            mask = np.full_like(next_logits, -np.inf)
            mask[top_indices] = next_logits[top_indices]
            next_logits = mask
        
        # Convert to probabilities
        probs = softmax(next_logits)
        
        # Sample or take argmax
        if temperature > 0:
            next_token = np.random.choice(len(probs), p=probs)
        else:
            next_token = np.argmax(probs)
        
        generated_ids.append(int(next_token))
    
    return tokenizer.decode(generated_ids)


def generate_with_details(
    model: MiniGPT,
    tokenizer: CharTokenizer,
    prompt: str = "",
    max_tokens: int = 50,
    temperature: float = 0.8,
) -> dict:
    """
    Generate text with detailed step-by-step information.
    
    Returns a dictionary with the generated text and per-step details
    including probability distributions and chosen tokens.
    Useful for the UI visualization.
    """
    if prompt:
        token_ids = tokenizer.encode(prompt)
    else:
        token_ids = [np.random.randint(2, tokenizer.vocab_size)]
    
    generated_ids = list(token_ids)
    context_length = model.config.context_length
    steps = []
    
    for step in range(max_tokens):
        context = generated_ids[-context_length:]
        input_array = np.array([context])
        logits = model.forward(input_array)
        next_logits = logits[0, -1, :]
        
        if temperature > 0:
            scaled_logits = next_logits / temperature
        else:
            scaled_logits = next_logits
        
        probs = softmax(scaled_logits)
        
        if temperature > 0:
            next_token = np.random.choice(len(probs), p=probs)
        else:
            next_token = np.argmax(probs)
        
        # Capture top-5 predictions for this step
        top5_indices = np.argsort(probs)[-5:][::-1]
        top5 = [
            {
                "token": tokenizer.decode([int(idx)]),
                "token_id": int(idx),
                "probability": float(probs[idx]),
            }
            for idx in top5_indices
        ]
        
        steps.append({
            "step": step,
            "chosen_token": tokenizer.decode([int(next_token)]),
            "chosen_token_id": int(next_token),
            "chosen_probability": float(probs[next_token]),
            "top5_predictions": top5,
        })
        
        generated_ids.append(int(next_token))
    
    return {
        "prompt": prompt,
        "generated_text": tokenizer.decode(generated_ids),
        "total_tokens": len(generated_ids),
        "steps": steps,
    }


if __name__ == "__main__":
    import json
    import os
    
    # Check for saved model
    model_path = os.path.join(os.path.dirname(__file__), "saved_model.json")
    tokenizer_path = os.path.join(os.path.dirname(__file__), "saved_tokenizer.json")
    
    if os.path.exists(model_path) and os.path.exists(tokenizer_path):
        print("Loading saved model...")
        with open(model_path, "r") as f:
            state = json.load(f)
        
        from model import GPTConfig
        config = GPTConfig(**state["config"])
        model = MiniGPT(config)
        model.token_embedding = np.array(state["token_embedding"])
        model.training_step = state["training_step"]
        model.loss_history = state["loss_history"]
        
        tokenizer = CharTokenizer()
        tokenizer.load(tokenizer_path)
    else:
        print("No saved model found. Training a quick model...")
        from train import quick_train
        model, tokenizer = quick_train(steps=200)
    
    print("\n" + "=" * 60)
    print("MINI GPT — TEXT GENERATION")
    print("=" * 60)
    
    # Generate samples at different temperatures
    for temp in [0.0, 0.5, 0.8, 1.0, 1.5]:
        print(f"\n--- Temperature: {temp} ---")
        text = generate(model, tokenizer, prompt="To ", max_tokens=100, temperature=temp)
        print(text[:200])
    
    print("\n" + "=" * 60)
    print("DETAILED GENERATION")
    print("=" * 60)
    details = generate_with_details(model, tokenizer, prompt="The ", max_tokens=20, temperature=0.8)
    for step in details["steps"][:5]:
        print(f"Step {step['step']}: '{step['chosen_token']}' (p={step['chosen_probability']:.3f})")
        for pred in step["top5_predictions"][:3]:
            print(f"  → '{pred['token']}' p={pred['probability']:.3f}")
