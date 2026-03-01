# Atomic Karpathy GPT - README

This module provides a pure Python, dependency-free transformer (GPT) for educational sandbox use. It is based on Andrej Karpathy's atomic GPT implementation, refactored for modularity and API access.

## Features
- Minimal transformer model (no NumPy, no external ML dependencies)
- Character-level tokenizer
- Autograd engine
- Training and inference via FastAPI endpoints
- Strict isolation from production AI pipeline

## Usage

### 1. Install dependencies
```
pip install fastapi pydantic uvicorn
```

### 2. Run the server
```
uvicorn server:app --reload
```

### 3. Train the model
POST `/train`
```
{
  "num_steps": 1000,
  "learning_rate": 0.01
}
```

### 4. Generate samples
POST `/generate`
```
{
  "temperature": 0.5,
  "num_samples": 20
}
```

## API Endpoints
- `/train`: Trains the model and returns final loss, vocab size, doc count, param count.
- `/generate`: Generates new samples (names) from the trained model.

## Educational Value
This module is designed for transparency and learning. Every step is visible and modifiable. It is strictly isolated from the main AI system and not used for production queries.

## Credits
- Original algorithm: Andrej Karpathy (@karpathy)
- Refactored for API: Study AI project
