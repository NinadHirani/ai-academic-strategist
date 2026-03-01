"""
Mini GPT Lab — Toy Dataset
============================

Provides small text datasets for training the educational transformer.

These datasets are intentionally tiny — the goal is to demonstrate
training dynamics and transformer mechanics, not to build a capable model.
The model should learn to reproduce patterns from these texts within
a few hundred training steps.
"""

from typing import Tuple, List
import numpy as np

# ============================================================================
# Built-in Toy Datasets
# ============================================================================

SHAKESPEARE_TINY = """
To be, or not to be, that is the question:
Whether 'tis nobler in the mind to suffer
The slings and arrows of outrageous fortune,
Or to take arms against a sea of troubles,
And by opposing end them. To die, to sleep;
No more; and by a sleep to say we end
The heart-ache and the thousand natural shocks
That flesh is heir to. 'Tis a consummation
Devoutly to be wish'd. To die, to sleep;
To sleep, perchance to dream. Ay, there's the rub;
For in that sleep of death what dreams may come
When we have shuffled off this mortal coil,
Must give us pause. There's the respect
That makes calamity of so long life.
""".strip()

SCIENCE_TINY = """
The transformer architecture revolutionized natural language processing.
At its core, the transformer uses self-attention to process sequences.
Each token attends to every other token, computing similarity scores.
The attention mechanism allows capturing long-range dependencies.
Multi-head attention runs parallel attention functions for diversity.
Layer normalization stabilizes training of deep neural networks.
The feed-forward network processes each position independently.
Residual connections help gradients flow through deep architectures.
Positional encodings give the model information about token order.
The softmax function converts raw scores into probability distributions.
Training uses cross-entropy loss to match predicted distributions.
Backpropagation computes gradients through the entire computation graph.
""".strip()

PATTERNS_TINY = """
abcabcabcabcabcabc
121212121212121212
aabbccaabbccaabbcc
hello world hello world hello world
the cat sat on the mat the cat sat on the mat
one two three one two three one two three
""".strip()

DATASETS = {
    "shakespeare": SHAKESPEARE_TINY,
    "science": SCIENCE_TINY,
    "patterns": PATTERNS_TINY,
}


def get_dataset(name: str = "shakespeare") -> str:
    """
    Get a toy dataset by name.
    
    Args:
        name: One of 'shakespeare', 'science', 'patterns'
        
    Returns:
        The dataset text
    """
    if name not in DATASETS:
        raise ValueError(f"Unknown dataset: {name}. Available: {list(DATASETS.keys())}")
    return DATASETS[name]


def create_training_pairs(
    token_ids: List[int],
    context_length: int,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Create input-target pairs for autoregressive training.
    
    For a sequence [a, b, c, d, e] with context_length=3:
        Input:  [a, b, c]  →  Target: [b, c, d]
        Input:  [b, c, d]  →  Target: [c, d, e]
    
    The target is always the input shifted by one position.
    This is the standard next-token prediction objective.
    
    Args:
        token_ids: Full sequence of token IDs
        context_length: Number of tokens per training example
        
    Returns:
        (inputs, targets) — both as numpy arrays of shape (num_examples, context_length)
    """
    inputs = []
    targets = []

    for i in range(len(token_ids) - context_length):
        inputs.append(token_ids[i : i + context_length])
        targets.append(token_ids[i + 1 : i + context_length + 1])

    return np.array(inputs), np.array(targets)


def get_batches(
    inputs: np.ndarray,
    targets: np.ndarray,
    batch_size: int,
    shuffle: bool = True,
) -> List[Tuple[np.ndarray, np.ndarray]]:
    """
    Split training data into mini-batches.
    
    Mini-batch gradient descent provides a balance between:
    - Full-batch GD (stable but slow)
    - Stochastic GD (fast but noisy)
    
    Args:
        inputs: Input sequences (num_examples, context_length)
        targets: Target sequences (num_examples, context_length)
        batch_size: Number of examples per batch
        shuffle: Whether to shuffle the data
        
    Returns:
        List of (input_batch, target_batch) tuples
    """
    n = len(inputs)
    indices = np.arange(n)
    
    if shuffle:
        np.random.shuffle(indices)
    
    batches = []
    for start in range(0, n, batch_size):
        end = min(start + batch_size, n)
        batch_idx = indices[start:end]
        batches.append((inputs[batch_idx], targets[batch_idx]))
    
    return batches
