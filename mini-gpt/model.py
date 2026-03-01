"""
Mini GPT Lab — Pure NumPy Transformer Model
=============================================

A complete GPT-style transformer implemented from scratch using only NumPy.
No PyTorch, no TensorFlow — every operation is explicit.

Architecture:
  Token Embedding + Positional Encoding
  → N × Transformer Block:
      → RMSNorm → Multi-Head Causal Self-Attention → Residual
      → RMSNorm → Feed-Forward Network (MLP) → Residual
  → RMSNorm → Linear Output Head → Softmax → Next Token Prediction

This mirrors the architecture used in GPT-2, LLaMA, and similar models,
scaled down to ~10K parameters for educational purposes.

Key concepts implemented:
  1. Token embeddings (learned lookup table)
  2. Sinusoidal positional encodings
  3. Multi-head causal self-attention with masking
  4. RMSNorm (modern alternative to LayerNorm)
  5. Feed-forward network with GELU activation
  6. Residual connections
  7. Cross-entropy loss
  8. Full backpropagation through all layers
"""

import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass


# ============================================================================
# Configuration
# ============================================================================

@dataclass
class GPTConfig:
    """
    Hyperparameters for the Mini GPT model.
    
    These are intentionally tiny — a real GPT-2 Small has:
      d_model=768, n_heads=12, n_layers=12, context_length=1024
    
    Our model is ~1000x smaller, designed to train on CPU in seconds.
    """
    vocab_size: int = 64           # Number of unique tokens
    d_model: int = 64              # Embedding dimension (hidden size)
    n_heads: int = 4               # Number of attention heads
    n_layers: int = 2              # Number of transformer blocks
    d_ff: int = 128                # Feed-forward inner dimension (typically 4 × d_model)
    context_length: int = 32       # Maximum sequence length
    dropout_rate: float = 0.0      # Dropout (0 for tiny models — not enough data to overfit meaningfully)
    learning_rate: float = 1e-3    # Adam learning rate


# ============================================================================
# Activation Functions
# ============================================================================

def gelu(x: np.ndarray) -> np.ndarray:
    """
    Gaussian Error Linear Unit (GELU) activation.
    
    GELU(x) = x · Φ(x), where Φ is the CDF of the standard normal.
    
    Unlike ReLU which is a hard threshold at 0, GELU is smooth and
    allows small negative values through. This is the activation used
    in GPT-2, BERT, and most modern transformers.
    
    Approximation: GELU(x) ≈ 0.5x(1 + tanh(√(2/π)(x + 0.044715x³)))
    """
    return 0.5 * x * (1.0 + np.tanh(np.sqrt(2.0 / np.pi) * (x + 0.044715 * x**3)))


def gelu_derivative(x: np.ndarray) -> np.ndarray:
    """
    Derivative of GELU for backpropagation.
    
    d/dx GELU(x) — computed numerically for simplicity.
    In production, automatic differentiation handles this.
    """
    cdf = 0.5 * (1.0 + np.tanh(np.sqrt(2.0 / np.pi) * (x + 0.044715 * x**3)))
    pdf = np.exp(-0.5 * x**2) / np.sqrt(2.0 * np.pi)
    return cdf + x * pdf


def softmax(x: np.ndarray, axis: int = -1) -> np.ndarray:
    """
    Numerically stable softmax.
    
    softmax(x_i) = exp(x_i) / Σ exp(x_j)
    
    Subtracting the max prevents overflow in exp().
    This converts raw logits into a probability distribution.
    
    Used in:
      - Attention weights (which tokens to focus on)
      - Output predictions (which token comes next)
    """
    x_max = np.max(x, axis=axis, keepdims=True)
    exp_x = np.exp(x - x_max)
    return exp_x / np.sum(exp_x, axis=axis, keepdims=True)


# ============================================================================
# RMSNorm — Root Mean Square Layer Normalization
# ============================================================================

class RMSNorm:
    """
    Root Mean Square Layer Normalization.
    
    Used in LLaMA, Mistral, and other modern transformers.
    
    RMSNorm(x) = (x / RMS(x)) · γ
    where RMS(x) = √(mean(x²) + ε)
    
    Compared to standard LayerNorm:
      - LayerNorm: (x - mean(x)) / std(x) · γ + β
      - RMSNorm:   x / RMS(x) · γ
    
    RMSNorm is simpler (no mean subtraction, no β bias) and empirically
    works just as well while being ~10-15% faster to compute.
    
    The learnable scale parameter γ (gamma) allows the model to
    control the magnitude of different features.
    """

    def __init__(self, d_model: int, eps: float = 1e-8):
        self.eps = eps
        self.d_model = d_model
        # γ (gamma): learnable scale, initialized to ones
        self.gamma = np.ones(d_model)
        # Cache for backpropagation
        self._cache: Dict = {}

    def forward(self, x: np.ndarray) -> np.ndarray:
        """
        Forward pass.
        
        Input shape: (batch, seq_len, d_model)
        Output shape: same
        """
        # Compute RMS: √(mean(x²) + ε)
        rms = np.sqrt(np.mean(x**2, axis=-1, keepdims=True) + self.eps)
        # Normalize
        x_norm = x / rms
        # Scale by learned γ
        output = self.gamma * x_norm
        
        # Cache for backward pass
        self._cache = {"x": x, "rms": rms, "x_norm": x_norm}
        return output

    def backward(self, grad_output: np.ndarray) -> np.ndarray:
        """
        Backward pass — compute gradients for γ and input.
        """
        x = self._cache["x"]
        rms = self._cache["rms"]
        x_norm = self._cache["x_norm"]

        # Gradient w.r.t. gamma: sum over batch and sequence dimensions
        self.grad_gamma = np.sum(grad_output * x_norm, axis=(0, 1))

        # Gradient w.r.t. input
        d = self.d_model
        grad_x_norm = grad_output * self.gamma
        grad_rms = -np.sum(grad_x_norm * x / (rms**2), axis=-1, keepdims=True)
        grad_x = grad_x_norm / rms + grad_rms * x / (d * rms)
        
        return grad_x


# ============================================================================
# Multi-Head Causal Self-Attention
# ============================================================================

class MultiHeadAttention:
    """
    Multi-Head Causal Self-Attention.
    
    This is THE core mechanism of the transformer.
    
    For each token position, attention answers: "Which other tokens
    should I pay attention to, and how much?"
    
    Process:
      1. Project input into Q, K, V for each head
      2. Compute attention scores: Q·K^T / √d_k
      3. Apply causal mask (prevent looking at future tokens)
      4. Apply softmax to get attention weights
      5. Multiply weights by V to get weighted values
      6. Concatenate heads and project output
    
    Multi-head means we do this h times in parallel with different
    learned projections. Each head can specialize in different patterns:
      - Head 1 might learn syntactic relationships
      - Head 2 might learn semantic similarity
      - Head 3 might learn positional proximity
      - etc.
    """

    def __init__(self, d_model: int, n_heads: int, context_length: int):
        assert d_model % n_heads == 0, "d_model must be divisible by n_heads"
        
        self.d_model = d_model
        self.n_heads = n_heads
        self.d_k = d_model // n_heads  # Dimension per head
        self.context_length = context_length
        
        # Initialize weight matrices with Xavier/Glorot initialization
        # This keeps variance stable across layers at initialization
        scale = np.sqrt(2.0 / (d_model + d_model))
        
        # Q, K, V projection matrices — one per head, but stored as single large matrices
        self.W_q = np.random.randn(d_model, d_model) * scale    # Query projection
        self.W_k = np.random.randn(d_model, d_model) * scale    # Key projection
        self.W_v = np.random.randn(d_model, d_model) * scale    # Value projection
        self.W_o = np.random.randn(d_model, d_model) * scale    # Output projection
        
        # Biases (optional, some models omit these)
        self.b_q = np.zeros(d_model)
        self.b_k = np.zeros(d_model)
        self.b_v = np.zeros(d_model)
        self.b_o = np.zeros(d_model)
        
        # Causal mask — upper triangular matrix of -inf
        # This prevents token i from attending to tokens j > i
        self.causal_mask = np.triu(
            np.full((context_length, context_length), -np.inf), k=1
        )
        
        # Cache for backpropagation
        self._cache: Dict = {}
        
        # Gradient accumulators
        self.grad_W_q = np.zeros_like(self.W_q)
        self.grad_W_k = np.zeros_like(self.W_k)
        self.grad_W_v = np.zeros_like(self.W_v)
        self.grad_W_o = np.zeros_like(self.W_o)
        self.grad_b_q = np.zeros_like(self.b_q)
        self.grad_b_k = np.zeros_like(self.b_k)
        self.grad_b_v = np.zeros_like(self.b_v)
        self.grad_b_o = np.zeros_like(self.b_o)

    def forward(self, x: np.ndarray) -> np.ndarray:
        """
        Forward pass through multi-head attention.
        
        Input:  (batch, seq_len, d_model)
        Output: (batch, seq_len, d_model)
        
        Also stores attention weights for visualization.
        """
        batch_size, seq_len, _ = x.shape
        
        # Step 1: Project input to Q, K, V
        # Each is (batch, seq_len, d_model)
        Q = x @ self.W_q + self.b_q
        K = x @ self.W_k + self.b_k
        V = x @ self.W_v + self.b_v
        
        # Step 2: Reshape for multi-head: (batch, n_heads, seq_len, d_k)
        Q = Q.reshape(batch_size, seq_len, self.n_heads, self.d_k).transpose(0, 2, 1, 3)
        K = K.reshape(batch_size, seq_len, self.n_heads, self.d_k).transpose(0, 2, 1, 3)
        V = V.reshape(batch_size, seq_len, self.n_heads, self.d_k).transpose(0, 2, 1, 3)
        
        # Step 3: Compute attention scores
        # (batch, n_heads, seq_len, d_k) @ (batch, n_heads, d_k, seq_len)
        # → (batch, n_heads, seq_len, seq_len)
        scores = Q @ K.transpose(0, 1, 3, 2) / np.sqrt(self.d_k)
        
        # Step 4: Apply causal mask (future tokens get -inf → 0 after softmax)
        scores = scores + self.causal_mask[:seq_len, :seq_len]
        
        # Step 5: Softmax → attention weights (probabilities)
        attn_weights = softmax(scores, axis=-1)
        
        # Step 6: Weighted sum of values
        # (batch, n_heads, seq_len, seq_len) @ (batch, n_heads, seq_len, d_k)
        # → (batch, n_heads, seq_len, d_k)
        attn_output = attn_weights @ V
        
        # Step 7: Concatenate heads
        # (batch, n_heads, seq_len, d_k) → (batch, seq_len, d_model)
        attn_output = attn_output.transpose(0, 2, 1, 3).reshape(batch_size, seq_len, self.d_model)
        
        # Step 8: Output projection
        output = attn_output @ self.W_o + self.b_o
        
        # Cache everything for backpropagation
        self._cache = {
            "x": x, "Q": Q, "K": K, "V": V,
            "scores": scores, "attn_weights": attn_weights,
            "attn_output": attn_output,
        }
        
        return output

    def get_attention_weights(self) -> Optional[np.ndarray]:
        """
        Return attention weights for visualization.
        
        Shape: (batch, n_heads, seq_len, seq_len)
        
        attn_weights[b][h][i][j] = how much token i attends to token j
        in head h of batch example b.
        """
        return self._cache.get("attn_weights")

    def backward(self, grad_output: np.ndarray) -> np.ndarray:
        """
        Backward pass through multi-head attention.
        
        This is the most complex backward pass in the transformer.
        Gradients flow backward through:
          output projection → head concatenation → value weighting →
          softmax → score computation → Q,K,V projections → input
        """
        x = self._cache["x"]
        Q = self._cache["Q"]
        K = self._cache["K"]
        V = self._cache["V"]
        attn_weights = self._cache["attn_weights"]
        attn_out_concat = self._cache["attn_output"]
        
        batch_size, seq_len, _ = x.shape
        
        # Gradient through output projection
        # output = attn_output @ W_o + b_o
        self.grad_W_o = attn_out_concat.reshape(-1, self.d_model).T @ grad_output.reshape(-1, self.d_model)
        self.grad_b_o = grad_output.sum(axis=(0, 1))
        grad_attn_concat = grad_output @ self.W_o.T
        
        # Reshape back to multi-head format
        grad_attn = grad_attn_concat.reshape(batch_size, seq_len, self.n_heads, self.d_k).transpose(0, 2, 1, 3)
        
        # Gradient through value weighting: attn_output = attn_weights @ V
        grad_attn_weights = grad_attn @ V.transpose(0, 1, 3, 2)
        grad_V = attn_weights.transpose(0, 1, 3, 2) @ grad_attn
        
        # Gradient through softmax
        # For softmax: d_softmax/d_input = softmax * (delta_ij - softmax)
        grad_scores = attn_weights * (grad_attn_weights - np.sum(grad_attn_weights * attn_weights, axis=-1, keepdims=True))
        
        # Scale gradient
        grad_scores = grad_scores / np.sqrt(self.d_k)
        
        # Gradient through Q @ K^T
        grad_Q = grad_scores @ K
        grad_K = grad_scores.transpose(0, 1, 3, 2) @ Q
        
        # Reshape Q, K, V gradients back to (batch, seq_len, d_model)
        grad_Q = grad_Q.transpose(0, 2, 1, 3).reshape(batch_size, seq_len, self.d_model)
        grad_K = grad_K.transpose(0, 2, 1, 3).reshape(batch_size, seq_len, self.d_model)
        grad_V = grad_V.transpose(0, 2, 1, 3).reshape(batch_size, seq_len, self.d_model)
        
        # Gradient through Q, K, V projections
        x_flat = x.reshape(-1, self.d_model)
        self.grad_W_q = x_flat.T @ grad_Q.reshape(-1, self.d_model)
        self.grad_W_k = x_flat.T @ grad_K.reshape(-1, self.d_model)
        self.grad_W_v = x_flat.T @ grad_V.reshape(-1, self.d_model)
        self.grad_b_q = grad_Q.sum(axis=(0, 1))
        self.grad_b_k = grad_K.sum(axis=(0, 1))
        self.grad_b_v = grad_V.sum(axis=(0, 1))
        
        # Gradient through input
        grad_x = grad_Q @ self.W_q.T + grad_K @ self.W_k.T + grad_V @ self.W_v.T
        
        return grad_x


# ============================================================================
# Feed-Forward Network (MLP)
# ============================================================================

class FeedForward:
    """
    Position-wise Feed-Forward Network.
    
    FFN(x) = W₂ · GELU(W₁ · x + b₁) + b₂
    
    This is applied independently to each position (each token).
    It's essentially a two-layer MLP that:
      1. Projects up to a higher dimension (d_model → d_ff)
      2. Applies non-linearity (GELU)
      3. Projects back down (d_ff → d_model)
    
    The MLP is believed to act as a "memory" or "knowledge store" —
    attention routes information between tokens, while the MLP
    processes and transforms information at each position.
    
    In large models, the MLP accounts for ~2/3 of total parameters.
    """

    def __init__(self, d_model: int, d_ff: int):
        # Xavier initialization
        scale_1 = np.sqrt(2.0 / (d_model + d_ff))
        scale_2 = np.sqrt(2.0 / (d_ff + d_model))
        
        self.W1 = np.random.randn(d_model, d_ff) * scale_1    # Up projection
        self.b1 = np.zeros(d_ff)
        self.W2 = np.random.randn(d_ff, d_model) * scale_2    # Down projection
        self.b2 = np.zeros(d_model)
        
        self._cache: Dict = {}
        
        # Gradient accumulators
        self.grad_W1 = np.zeros_like(self.W1)
        self.grad_b1 = np.zeros_like(self.b1)
        self.grad_W2 = np.zeros_like(self.W2)
        self.grad_b2 = np.zeros_like(self.b2)

    def forward(self, x: np.ndarray) -> np.ndarray:
        """
        Forward pass.
        
        Input:  (batch, seq_len, d_model)
        Output: (batch, seq_len, d_model)
        """
        # Up projection + activation
        hidden_pre = x @ self.W1 + self.b1    # (batch, seq_len, d_ff)
        hidden = gelu(hidden_pre)              # Non-linear activation
        
        # Down projection
        output = hidden @ self.W2 + self.b2   # (batch, seq_len, d_model)
        
        self._cache = {"x": x, "hidden_pre": hidden_pre, "hidden": hidden}
        return output

    def backward(self, grad_output: np.ndarray) -> np.ndarray:
        """
        Backward pass through the MLP.
        
        Chain rule through: output → W2 → GELU → W1 → input
        """
        x = self._cache["x"]
        hidden_pre = self._cache["hidden_pre"]
        hidden = self._cache["hidden"]
        
        batch_size, seq_len, _ = x.shape
        
        # Gradient through down projection: output = hidden @ W2 + b2
        self.grad_W2 = hidden.reshape(-1, hidden.shape[-1]).T @ grad_output.reshape(-1, grad_output.shape[-1])
        self.grad_b2 = grad_output.sum(axis=(0, 1))
        grad_hidden = grad_output @ self.W2.T
        
        # Gradient through GELU activation
        grad_pre = grad_hidden * gelu_derivative(hidden_pre)
        
        # Gradient through up projection: hidden_pre = x @ W1 + b1
        self.grad_W1 = x.reshape(-1, x.shape[-1]).T @ grad_pre.reshape(-1, grad_pre.shape[-1])
        self.grad_b1 = grad_pre.sum(axis=(0, 1))
        grad_x = grad_pre @ self.W1.T
        
        return grad_x


# ============================================================================
# Transformer Block
# ============================================================================

class TransformerBlock:
    """
    A single transformer block.
    
    Pre-norm architecture (used in GPT-2, LLaMA):
      x → RMSNorm → Attention → + residual → RMSNorm → MLP → + residual
    
    The pre-norm variant applies normalization BEFORE each sub-layer,
    which leads to more stable training compared to post-norm
    (which normalizes AFTER the sub-layer).
    
    The residual connections (x + SubLayer(Norm(x))) are critical:
      - They allow gradients to flow directly through the network
      - They enable training of very deep networks (100+ layers)
      - They let each layer learn a "delta" or refinement
    """

    def __init__(self, d_model: int, n_heads: int, d_ff: int, context_length: int):
        self.norm1 = RMSNorm(d_model)
        self.attn = MultiHeadAttention(d_model, n_heads, context_length)
        self.norm2 = RMSNorm(d_model)
        self.ffn = FeedForward(d_model, d_ff)
        self._cache: Dict = {}

    def forward(self, x: np.ndarray) -> np.ndarray:
        """
        Forward pass through one transformer block.
        
        Input:  (batch, seq_len, d_model)
        Output: (batch, seq_len, d_model)
        """
        # Sub-layer 1: RMSNorm → Multi-Head Attention → Residual
        normed1 = self.norm1.forward(x)
        attn_out = self.attn.forward(normed1)
        x = x + attn_out  # Residual connection
        
        self._cache["after_attn"] = x.copy()
        
        # Sub-layer 2: RMSNorm → Feed-Forward → Residual
        normed2 = self.norm2.forward(x)
        ffn_out = self.ffn.forward(normed2)
        x = x + ffn_out  # Residual connection
        
        return x

    def backward(self, grad_output: np.ndarray) -> np.ndarray:
        """
        Backward pass through transformer block.
        
        Follows the computation in reverse:
          grad ← FFN backward ← Norm2 backward ← + residual ←
          Attention backward ← Norm1 backward ← + residual
        """
        # Backward through residual: grad passes through directly
        grad_residual2 = grad_output
        
        # Backward through FFN
        grad_ffn = self.ffn.backward(grad_output)
        # Backward through norm2
        grad_norm2 = self.norm2.backward(grad_ffn)
        # Add residual gradient
        grad = grad_residual2 + grad_norm2
        
        # Backward through residual: grad passes through directly
        grad_residual1 = grad
        
        # Backward through attention
        grad_attn = self.attn.backward(grad)
        # Backward through norm1
        grad_norm1 = self.norm1.backward(grad_attn)
        # Add residual gradient
        grad = grad_residual1 + grad_norm1
        
        return grad

    def get_attention_weights(self) -> Optional[np.ndarray]:
        """Get attention weights from this block's attention layer."""
        return self.attn.get_attention_weights()


# ============================================================================
# Positional Encoding
# ============================================================================

def sinusoidal_positional_encoding(max_len: int, d_model: int) -> np.ndarray:
    """
    Compute sinusoidal positional encodings.
    
    PE(pos, 2i)   = sin(pos / 10000^(2i/d_model))
    PE(pos, 2i+1) = cos(pos / 10000^(2i/d_model))
    
    Properties:
      - Each position gets a unique encoding
      - The encoding is deterministic (not learned)
      - Nearby positions have similar encodings
      - The model can learn to attend to relative positions
    
    Why sinusoidal?
      - PE(pos+k) can be expressed as a linear function of PE(pos)
      - This allows the model to learn relative position attention
      - No parameters needed (unlike learned positional embeddings)
    
    Returns:
        (max_len, d_model) array of positional encodings
    """
    pe = np.zeros((max_len, d_model))
    position = np.arange(max_len)[:, np.newaxis]     # (max_len, 1)
    div_term = np.exp(
        np.arange(0, d_model, 2) * -(np.log(10000.0) / d_model)
    )  # (d_model/2,)
    
    pe[:, 0::2] = np.sin(position * div_term)  # Even indices
    pe[:, 1::2] = np.cos(position * div_term)  # Odd indices
    
    return pe


# ============================================================================
# Mini GPT Model
# ============================================================================

class MiniGPT:
    """
    A minimal GPT-style language model.
    
    Architecture:
      1. Token embedding: vocab_size → d_model
      2. Positional encoding: sinusoidal
      3. N transformer blocks (attention + MLP)
      4. Final RMSNorm
      5. Output head: d_model → vocab_size (weight-tied with embedding)
    
    Total parameters (with default config):
      - Token embedding: 64 × 64 = 4,096
      - Per block: ~2 × 64² + 2 × 64 × 128 ≈ 24,576
      - 2 blocks: ~49,152
      - Output head: tied with embedding
      - Total: ~53,248 parameters
    
    Compare: GPT-2 Small = 117M parameters (~2,200× larger)
    """

    def __init__(self, config: GPTConfig):
        self.config = config
        
        # Token embedding matrix: maps token IDs to dense vectors
        # Initialized with small random values (Xavier)
        scale = np.sqrt(1.0 / config.d_model)
        self.token_embedding = np.random.randn(config.vocab_size, config.d_model) * scale
        
        # Positional encoding (fixed, not learned)
        self.pos_encoding = sinusoidal_positional_encoding(config.context_length, config.d_model)
        
        # Transformer blocks
        self.blocks = [
            TransformerBlock(config.d_model, config.n_heads, config.d_ff, config.context_length)
            for _ in range(config.n_layers)
        ]
        
        # Final normalization
        self.final_norm = RMSNorm(config.d_model)
        
        # No separate output head — we tie weights with the token embedding
        # This means: logits = hidden_state @ token_embedding.T
        # Weight tying reduces parameters and improves training
        
        # Cache
        self._cache: Dict = {}
        
        # Gradient for token embedding
        self.grad_token_embedding = np.zeros_like(self.token_embedding)
        
        # Training state
        self.training_step = 0
        self.loss_history: List[float] = []

    def count_parameters(self) -> int:
        """Count total trainable parameters."""
        total = self.token_embedding.size  # Token embedding
        total += self.final_norm.gamma.size  # Final norm
        
        for block in self.blocks:
            # Attention
            total += block.attn.W_q.size + block.attn.b_q.size
            total += block.attn.W_k.size + block.attn.b_k.size
            total += block.attn.W_v.size + block.attn.b_v.size
            total += block.attn.W_o.size + block.attn.b_o.size
            # FFN
            total += block.ffn.W1.size + block.ffn.b1.size
            total += block.ffn.W2.size + block.ffn.b2.size
            # Norms
            total += block.norm1.gamma.size
            total += block.norm2.gamma.size
        
        return total

    def forward(self, token_ids: np.ndarray) -> np.ndarray:
        """
        Forward pass: token IDs → logits over vocabulary.
        
        Args:
            token_ids: (batch, seq_len) integer token IDs
            
        Returns:
            logits: (batch, seq_len, vocab_size) raw prediction scores
        """
        batch_size, seq_len = token_ids.shape
        
        # Step 1: Token embedding lookup
        # Each token ID selects a row from the embedding matrix
        x = self.token_embedding[token_ids]  # (batch, seq_len, d_model)
        
        # Step 2: Add positional encoding
        x = x + self.pos_encoding[:seq_len]  # Broadcasting over batch
        
        self._cache["embedded"] = x.copy()
        self._cache["token_ids"] = token_ids
        
        # Step 3: Pass through transformer blocks
        for block in self.blocks:
            x = block.forward(x)
        
        # Step 4: Final normalization
        x = self.final_norm.forward(x)
        
        self._cache["final_hidden"] = x.copy()
        
        # Step 5: Project to vocabulary (weight-tied with embedding)
        # logits = x @ E^T, where E is the token embedding matrix
        logits = x @ self.token_embedding.T  # (batch, seq_len, vocab_size)
        
        return logits

    def compute_loss(self, logits: np.ndarray, targets: np.ndarray) -> Tuple[float, np.ndarray]:
        """
        Compute cross-entropy loss and its gradient.
        
        Cross-entropy: L = -Σ log P(correct token)
        
        This measures how well the model's predicted distribution
        matches the actual next token. Lower = better.
        
        Args:
            logits: (batch, seq_len, vocab_size) raw scores
            targets: (batch, seq_len) correct token IDs
            
        Returns:
            (loss_value, grad_logits)
        """
        batch_size, seq_len, vocab_size = logits.shape
        
        # Softmax to get probabilities
        probs = softmax(logits, axis=-1)  # (batch, seq_len, vocab_size)
        
        # Gather probabilities of correct tokens
        # For each position, get P(correct_token)
        correct_probs = probs[
            np.arange(batch_size)[:, None],
            np.arange(seq_len)[None, :],
            targets
        ]
        
        # Cross-entropy loss: -log(P(correct))
        # Clip to prevent log(0)
        loss = -np.mean(np.log(np.clip(correct_probs, 1e-10, 1.0)))
        
        # Gradient of cross-entropy w.r.t. logits:
        # ∂L/∂logits = probs - one_hot(targets)
        # This elegant result comes from combining softmax and cross-entropy
        grad_logits = probs.copy()
        grad_logits[
            np.arange(batch_size)[:, None],
            np.arange(seq_len)[None, :],
            targets
        ] -= 1.0
        grad_logits /= (batch_size * seq_len)
        
        return loss, grad_logits

    def backward(self, grad_logits: np.ndarray) -> None:
        """
        Full backward pass through the model.
        
        Propagates gradients from the loss back through:
          logits → output projection → final norm → transformer blocks →
          embedding lookup
        
        This computes ∂L/∂θ for every parameter θ in the model.
        """
        final_hidden = self._cache["final_hidden"]
        token_ids = self._cache["token_ids"]
        embedded = self._cache["embedded"]
        
        # Gradient through output projection (weight-tied)
        # logits = final_hidden @ embedding.T
        # grad_embedding += final_hidden.T @ grad_logits  (from output side)
        # grad_final_hidden = grad_logits @ embedding
        grad_hidden = grad_logits @ self.token_embedding
        self.grad_token_embedding = final_hidden.reshape(-1, self.config.d_model).T @ grad_logits.reshape(-1, self.config.vocab_size)
        self.grad_token_embedding = self.grad_token_embedding.T  # (vocab_size, d_model)
        
        # Gradient through final norm
        grad_hidden = self.final_norm.backward(grad_hidden)
        
        # Gradient through transformer blocks (in reverse order)
        for block in reversed(self.blocks):
            grad_hidden = block.backward(grad_hidden)
        
        # Gradient through embedding lookup
        # Accumulate gradients for each token ID
        batch_size, seq_len = token_ids.shape
        for b in range(batch_size):
            for s in range(seq_len):
                self.grad_token_embedding[token_ids[b, s]] += grad_hidden[b, s]

    def update_parameters(self, lr: float) -> None:
        """
        Update all parameters using gradient descent.
        
        θ = θ - lr · ∂L/∂θ
        
        Uses simple SGD. Production models use Adam, but SGD
        is clearer for understanding the optimization process.
        """
        # Clip gradients to prevent explosion
        max_norm = 1.0
        
        def clip_grad(g: np.ndarray) -> np.ndarray:
            norm = np.linalg.norm(g)
            if norm > max_norm:
                return g * (max_norm / norm)
            return g
        
        # Update token embedding
        self.token_embedding -= lr * clip_grad(self.grad_token_embedding)
        
        # Update final norm
        self.final_norm.gamma -= lr * clip_grad(self.final_norm.grad_gamma)
        
        # Update each transformer block
        for block in self.blocks:
            # Attention weights
            block.attn.W_q -= lr * clip_grad(block.attn.grad_W_q)
            block.attn.W_k -= lr * clip_grad(block.attn.grad_W_k)
            block.attn.W_v -= lr * clip_grad(block.attn.grad_W_v)
            block.attn.W_o -= lr * clip_grad(block.attn.grad_W_o)
            block.attn.b_q -= lr * clip_grad(block.attn.grad_b_q)
            block.attn.b_k -= lr * clip_grad(block.attn.grad_b_k)
            block.attn.b_v -= lr * clip_grad(block.attn.grad_b_v)
            block.attn.b_o -= lr * clip_grad(block.attn.grad_b_o)
            
            # FFN weights
            block.ffn.W1 -= lr * clip_grad(block.ffn.grad_W1)
            block.ffn.b1 -= lr * clip_grad(block.ffn.grad_b1)
            block.ffn.W2 -= lr * clip_grad(block.ffn.grad_W2)
            block.ffn.b2 -= lr * clip_grad(block.ffn.grad_b2)
            
            # Norm weights
            block.norm1.gamma -= lr * clip_grad(block.norm1.grad_gamma)
            block.norm2.gamma -= lr * clip_grad(block.norm2.grad_gamma)
        
        self.training_step += 1

    def get_all_attention_weights(self) -> List[np.ndarray]:
        """Get attention weights from all blocks for visualization."""
        weights = []
        for block in self.blocks:
            w = block.get_attention_weights()
            if w is not None:
                weights.append(w)
        return weights

    def get_token_embeddings(self) -> np.ndarray:
        """Get the current token embedding matrix."""
        return self.token_embedding.copy()

    def get_model_state(self) -> Dict:
        """Serialize model state for saving."""
        state = {
            "config": {
                "vocab_size": self.config.vocab_size,
                "d_model": self.config.d_model,
                "n_heads": self.config.n_heads,
                "n_layers": self.config.n_layers,
                "d_ff": self.config.d_ff,
                "context_length": self.config.context_length,
            },
            "token_embedding": self.token_embedding.tolist(),
            "training_step": self.training_step,
            "loss_history": self.loss_history,
        }
        return state
