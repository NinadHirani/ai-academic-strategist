"""
Mini GPT Lab — Character-Level Tokenizer
=========================================

A simple character-level tokenizer for our educational transformer.

Character-level tokenization maps each unique character to an integer ID.
This is the simplest tokenizer possible — production LLMs use subword
tokenizers (BPE, SentencePiece) that balance vocabulary size with
sequence length.

Why character-level for education:
  - No external tokenizer library needed
  - Easy to understand the mapping
  - Shows the tokenization concept clearly
  - Works with any text without preprocessing
"""

from typing import List, Dict, Optional
import json


class CharTokenizer:
    """
    Character-level tokenizer.
    
    Maps each unique character in the training corpus to an integer.
    Includes special tokens for padding and unknown characters.
    
    Example:
        tokenizer = CharTokenizer()
        tokenizer.fit("hello world")
        tokens = tokenizer.encode("hello")  # [2, 3, 4, 4, 5]
        text = tokenizer.decode(tokens)     # "hello"
    """

    # Special tokens
    PAD_TOKEN = "<PAD>"
    UNK_TOKEN = "<UNK>"

    def __init__(self):
        self.char_to_id: Dict[str, int] = {}
        self.id_to_char: Dict[int, str] = {}
        self.vocab_size: int = 0
        self._fitted = False

    def fit(self, text: str) -> "CharTokenizer":
        """
        Build vocabulary from a text corpus.
        
        Each unique character gets a unique integer ID.
        Special tokens (PAD=0, UNK=1) are reserved at the start.
        
        Args:
            text: The full training corpus as a string
            
        Returns:
            self (for chaining)
        """
        # Start with special tokens
        self.char_to_id = {
            self.PAD_TOKEN: 0,
            self.UNK_TOKEN: 1,
        }

        # Assign IDs to each unique character, sorted for reproducibility
        unique_chars = sorted(set(text))
        for idx, char in enumerate(unique_chars, start=2):
            self.char_to_id[char] = idx

        # Build reverse mapping
        self.id_to_char = {v: k for k, v in self.char_to_id.items()}
        self.vocab_size = len(self.char_to_id)
        self._fitted = True

        return self

    def encode(self, text: str) -> List[int]:
        """
        Convert a string to a list of token IDs.
        
        Characters not in vocabulary are mapped to UNK_TOKEN.
        
        Args:
            text: Input string to tokenize
            
        Returns:
            List of integer token IDs
        """
        if not self._fitted:
            raise RuntimeError("Tokenizer not fitted. Call .fit(text) first.")

        unk_id = self.char_to_id[self.UNK_TOKEN]
        return [self.char_to_id.get(ch, unk_id) for ch in text]

    def decode(self, token_ids: List[int]) -> str:
        """
        Convert a list of token IDs back to a string.
        
        Args:
            token_ids: List of integer token IDs
            
        Returns:
            Decoded string
        """
        if not self._fitted:
            raise RuntimeError("Tokenizer not fitted. Call .fit(text) first.")

        chars = []
        for tid in token_ids:
            char = self.id_to_char.get(tid, "")
            # Skip special tokens in output
            if char not in (self.PAD_TOKEN, self.UNK_TOKEN):
                chars.append(char)
        return "".join(chars)

    def get_vocab(self) -> Dict[str, int]:
        """Return the full vocabulary mapping."""
        return dict(self.char_to_id)

    def save(self, path: str) -> None:
        """Save tokenizer vocabulary to a JSON file."""
        data = {
            "char_to_id": self.char_to_id,
            "vocab_size": self.vocab_size,
        }
        with open(path, "w") as f:
            json.dump(data, f, indent=2)

    def load(self, path: str) -> "CharTokenizer":
        """Load tokenizer vocabulary from a JSON file."""
        with open(path, "r") as f:
            data = json.load(f)
        self.char_to_id = data["char_to_id"]
        self.id_to_char = {int(v): k for k, v in self.char_to_id.items()}
        self.vocab_size = data["vocab_size"]
        self._fitted = True
        return self
