# 🧪 Mini GPT Lab — Transformer Sandbox

> **Educational & Research Demonstration Module**
> This module is completely isolated from the production AI pipeline.

## Overview

This is a **pure Python implementation of a GPT-style transformer** built from scratch — no PyTorch, no TensorFlow, no external ML libraries. Every operation (matrix multiply, softmax, layer norm, backpropagation) is implemented using only NumPy.

### Purpose

- **Demonstrate** how transformers work internally
- **Visualize** attention patterns, embeddings, and training dynamics
- **Teach** the mathematics behind self-attention, RMSNorm, and MLPs
- **Research** — understand LLM internals at a granular level

### What This Is NOT

- ❌ Not a replacement for the production LLM (Groq/Ollama)
- ❌ Not used for RAG, document answering, or study queries
- ❌ Not scaled for academic Q&A
- ❌ Not connected to the production inference pipeline

## Architecture

```
Production Pipeline (UNCHANGED):
  User → RAG → Retrieval → Context Injection → Groq/Ollama → Response

Sandbox Pipeline (ISOLATED):
  Toy Dataset → Tokenizer → Mini GPT → Training Loop → Visualization
```

## How Transformers Work

### 1. Token Embeddings

Text is first converted into tokens (subwords or characters). Each token is mapped to a dense vector in a learned embedding space:

```
"hello" → token_id: 42 → embedding: [0.12, -0.34, 0.56, ...]
```

The embedding matrix `E ∈ ℝ^(vocab_size × d_model)` is learned during training.

### 2. Positional Encoding

Since transformers have no inherent notion of order, we add positional information. We use sinusoidal positional encodings:

```
PE(pos, 2i)   = sin(pos / 10000^(2i/d_model))
PE(pos, 2i+1) = cos(pos / 10000^(2i/d_model))
```

This gives each position a unique signature that the model can learn to use.

### 3. Self-Attention Mechanism

The core of the transformer. For each token, attention computes:

```
Attention(Q, K, V) = softmax(Q·K^T / √d_k) · V
```

Where:
- **Q** (Query): "What am I looking for?"
- **K** (Key): "What do I contain?"
- **V** (Value): "What information do I provide?"

The dot product `Q·K^T` measures **similarity** between tokens. Division by `√d_k` prevents gradients from vanishing in softmax. The softmax converts raw scores into a probability distribution — each token "attends" to others proportionally.

#### Multi-Head Attention

Instead of one attention function, we run `h` parallel attention heads:

```
MultiHead(Q, K, V) = Concat(head_1, ..., head_h) · W_O
where head_i = Attention(Q·W_Qi, K·W_Ki, V·W_Vi)
```

Each head can learn different relationship patterns (syntax, semantics, proximity, etc.).

### 4. Causal Masking

For autoregressive generation, we mask future positions so token `t` can only attend to tokens `≤ t`:

```
mask[i][j] = -∞  if j > i
mask[i][j] = 0   if j ≤ i
```

This ensures the model can't "cheat" by looking ahead during training.

### 5. RMSNorm (Root Mean Square Layer Normalization)

A simpler, faster alternative to LayerNorm used in modern transformers (LLaMA, etc.):

```
RMSNorm(x) = x / RMS(x) · γ
where RMS(x) = √(mean(x²) + ε)
```

Unlike LayerNorm, RMSNorm does NOT subtract the mean — it only rescales by the RMS. This is computationally cheaper and works just as well in practice.

### 6. Feed-Forward Network (MLP)

After attention, each token passes through an MLP:

```
FFN(x) = W_2 · GELU(W_1 · x + b_1) + b_2
```

Where:
- `W_1 ∈ ℝ^(d_model × d_ff)` projects to a higher dimension
- GELU is a smooth activation (unlike ReLU)
- `W_2 ∈ ℝ^(d_ff × d_model)` projects back down

The MLP acts as a "memory bank" — it stores learned patterns and facts.

### 7. Residual Connections

Each sub-layer (attention, MLP) has a residual connection:

```
output = x + SubLayer(Norm(x))
```

This helps gradients flow directly through the network during backpropagation, preventing the vanishing gradient problem in deep networks.

### 8. Training: Cross-Entropy Loss & Backpropagation

The model predicts a probability distribution over the vocabulary for each position. We minimize cross-entropy loss:

```
L = -Σ log(P(correct_token))
```

Gradients propagate backward through:
1. Output projection → vocabulary logits
2. Transformer blocks (MLP → Attention → Norms)
3. Embedding layers

Each parameter is updated via gradient descent:
```
θ = θ - lr · ∂L/∂θ
```

## Difference: Training From Scratch vs. Using Pretrained LLMs

| Aspect | From Scratch (This Module) | Pretrained LLMs (Production) |
|--------|---------------------------|------------------------------|
| **Data** | Tiny toy dataset (KB) | Trillions of tokens (TB) |
| **Parameters** | ~10K | 7B–70B+ |
| **Training** | Minutes on CPU | Weeks on GPU clusters |
| **Capability** | Pattern memorization | General intelligence |
| **Purpose** | Education & research | Production inference |
| **Hardware** | Any laptop | Data center GPUs |

This module proves theoretical understanding. The production system uses Groq/Ollama to access models trained by research labs on massive compute.

## Files

| File | Description |
|------|-------------|
| `model.py` | Core transformer: Attention, MLP, RMSNorm, GPT |
| `tokenizer.py` | Character-level tokenizer |
| `train.py` | Training loop with loss tracking |
| `generate.py` | Text generation with temperature sampling |
| `dataset.py` | Toy dataset loader |
| `server.py` | FastAPI server for UI integration |
| `requirements.txt` | Python dependencies (numpy only for core) |

## Running

```bash
cd mini-gpt
pip install -r requirements.txt
python train.py          # Train the model
python generate.py       # Generate sample text
python server.py         # Start API server for UI
```
