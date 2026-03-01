"""
Mini GPT Lab — Training Loop
==============================

Trains the Mini GPT model on a toy dataset and tracks loss over time.

Training process:
  1. Load/create toy dataset
  2. Tokenize text
  3. Create input-target pairs (next token prediction)
  4. For each training step:
      a. Sample a mini-batch
      b. Forward pass → logits
      c. Compute cross-entropy loss
      d. Backward pass → gradients
      e. Update parameters
      f. Log loss

The loss should decrease from ~4.0 (random, ln(vocab_size)) toward
~1.0 or lower as the model memorizes the training data.
"""

import numpy as np
import json
import os
import time
from typing import Tuple, List, Dict, Optional

from model import MiniGPT, GPTConfig
from tokenizer import CharTokenizer
from dataset import get_dataset, create_training_pairs, get_batches


def train(
    dataset_name: str = "shakespeare",
    n_steps: int = 500,
    batch_size: int = 16,
    learning_rate: float = 1e-3,
    context_length: int = 32,
    d_model: int = 64,
    n_heads: int = 4,
    n_layers: int = 2,
    d_ff: int = 128,
    log_every: int = 10,
    callback=None,
) -> Tuple[MiniGPT, CharTokenizer, List[Dict]]:
    """
    Train a Mini GPT model from scratch.
    
    Args:
        dataset_name: Which toy dataset to use
        n_steps: Number of training steps
        batch_size: Examples per mini-batch
        learning_rate: SGD learning rate
        context_length: Sequence length
        d_model: Model hidden dimension
        n_heads: Number of attention heads
        n_layers: Number of transformer blocks
        d_ff: Feed-forward inner dimension
        log_every: Log loss every N steps
        callback: Optional function called each log step with training info
        
    Returns:
        (model, tokenizer, training_log)
    """
    print("=" * 60)
    print("MINI GPT LAB — TRAINING")
    print("=" * 60)
    
    # Load dataset
    text = get_dataset(dataset_name)
    print(f"\nDataset: {dataset_name}")
    print(f"Text length: {len(text)} characters")
    print(f"Preview: {text[:100]}...")
    
    # Tokenize
    tokenizer = CharTokenizer()
    tokenizer.fit(text)
    token_ids = tokenizer.encode(text)
    print(f"Vocabulary size: {tokenizer.vocab_size}")
    print(f"Token sequence length: {len(token_ids)}")
    
    # Create training pairs
    inputs, targets = create_training_pairs(token_ids, context_length)
    print(f"Training examples: {len(inputs)}")
    
    # Initialize model
    config = GPTConfig(
        vocab_size=tokenizer.vocab_size,
        d_model=d_model,
        n_heads=n_heads,
        n_layers=n_layers,
        d_ff=d_ff,
        context_length=context_length,
        learning_rate=learning_rate,
    )
    model = MiniGPT(config)
    print(f"\nModel parameters: {model.count_parameters():,}")
    print(f"Config: d_model={d_model}, n_heads={n_heads}, n_layers={n_layers}, d_ff={d_ff}")
    print(f"Context length: {context_length}")
    print(f"\nTraining for {n_steps} steps, batch_size={batch_size}, lr={learning_rate}")
    print("-" * 60)
    
    # Training loop
    training_log = []
    start_time = time.time()
    
    for step in range(1, n_steps + 1):
        # Get mini-batches
        batches = get_batches(inputs, targets, batch_size, shuffle=True)
        
        # Use first batch for this step (simple approach)
        batch_inputs, batch_targets = batches[0]
        
        # Forward pass
        logits = model.forward(batch_inputs)
        
        # Compute loss
        loss, grad_logits = model.compute_loss(logits, batch_targets)
        
        # Backward pass
        model.backward(grad_logits)
        
        # Update parameters
        model.update_parameters(learning_rate)
        
        # Record loss
        model.loss_history.append(float(loss))
        
        # Log
        if step % log_every == 0 or step == 1:
            elapsed = time.time() - start_time
            steps_per_sec = step / elapsed if elapsed > 0 else 0
            
            log_entry = {
                "step": step,
                "loss": float(loss),
                "elapsed_seconds": round(elapsed, 2),
                "steps_per_second": round(steps_per_sec, 1),
            }
            training_log.append(log_entry)
            
            print(f"Step {step:4d}/{n_steps} | Loss: {loss:.4f} | "
                  f"{steps_per_sec:.1f} steps/s | {elapsed:.1f}s elapsed")
            
            if callback:
                callback(log_entry)
    
    total_time = time.time() - start_time
    final_loss = model.loss_history[-1] if model.loss_history else float("nan")
    
    print("-" * 60)
    print(f"Training complete in {total_time:.1f}s")
    print(f"Final loss: {final_loss:.4f}")
    print(f"Total parameters: {model.count_parameters():,}")
    
    return model, tokenizer, training_log


def quick_train(steps: int = 200) -> Tuple[MiniGPT, CharTokenizer]:
    """Quick training for testing. Returns (model, tokenizer)."""
    model, tokenizer, _ = train(n_steps=steps, log_every=50)
    return model, tokenizer


def save_model(model: MiniGPT, tokenizer: CharTokenizer, directory: str = None):
    """Save model and tokenizer to disk."""
    if directory is None:
        directory = os.path.dirname(os.path.abspath(__file__))
    
    model_path = os.path.join(directory, "saved_model.json")
    tokenizer_path = os.path.join(directory, "saved_tokenizer.json")
    
    # Save model state
    state = model.get_model_state()
    with open(model_path, "w") as f:
        json.dump(state, f)
    
    # Save tokenizer
    tokenizer.save(tokenizer_path)
    
    print(f"Model saved to {model_path}")
    print(f"Tokenizer saved to {tokenizer_path}")


if __name__ == "__main__":
    model, tokenizer, log = train(
        dataset_name="shakespeare",
        n_steps=500,
        batch_size=16,
        learning_rate=1e-3,
        context_length=32,
        d_model=64,
        n_heads=4,
        n_layers=2,
        d_ff=128,
        log_every=10,
    )
    
    # Save the trained model
    save_model(model, tokenizer)
    
    # Quick generation test
    from generate import generate
    print("\n" + "=" * 60)
    print("SAMPLE GENERATION")
    print("=" * 60)
    for temp in [0.5, 0.8, 1.0]:
        print(f"\nTemperature {temp}:")
        text = generate(model, tokenizer, prompt="To ", max_tokens=100, temperature=temp)
        print(text[:150])
