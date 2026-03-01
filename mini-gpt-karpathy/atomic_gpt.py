"""
Atomic Karpathy GPT - Modular API Version
Pure Python, dependency-free transformer for educational sandbox use.
"""

import os
import math
import random
from typing import List
random.seed(42)

# Dataset loader
NAMES_URL = 'https://raw.githubusercontent.com/karpathy/makemore/988aa59/names.txt'
INPUT_FILE = 'input.txt'

def load_docs():
    if not os.path.exists(INPUT_FILE):
        import urllib.request
        urllib.request.urlretrieve(NAMES_URL, INPUT_FILE)
    docs = [line.strip() for line in open(INPUT_FILE) if line.strip()]
    random.shuffle(docs)
    return docs

def get_vocab(docs: List[str]):
    uchars = sorted(set(''.join(docs)))
    BOS = len(uchars)
    vocab_size = len(uchars) + 1
    return uchars, BOS, vocab_size

# Autograd Value class
class Value:
    __slots__ = ('data', 'grad', '_children', '_local_grads')
    def __init__(self, data, children=(), local_grads=()):
        self.data = data
        self.grad = 0
        self._children = children
        self._local_grads = local_grads
    def __add__(self, other):
        other = other if isinstance(other, Value) else Value(other)
        return Value(self.data + other.data, (self, other), (1, 1))
    def __mul__(self, other):
        other = other if isinstance(other, Value) else Value(other)
        return Value(self.data * other.data, (self, other), (other.data, self.data))
    def __pow__(self, other): return Value(self.data**other, (self,), (other * self.data**(other-1),))
    def log(self): return Value(math.log(self.data), (self,), (1/self.data,))
    def exp(self): return Value(math.exp(self.data), (self,), (math.exp(self.data),))
    def relu(self): return Value(max(0, self.data), (self,), (float(self.data > 0),))
    def __neg__(self): return self * -1
    def __radd__(self, other): return self + other
    def __sub__(self, other): return self + (-other)
    def __rsub__(self, other): return other + (-self)
    def __rmul__(self, other): return self * other
    def __truediv__(self, other): return self * other**-1
    def __rtruediv__(self, other): return other * self**-1
    def backward(self):
        topo = []
        visited = set()
        def build_topo(v):
            if v not in visited:
                visited.add(v)
                for child in v._children:
                    build_topo(child)
                topo.append(v)
        build_topo(self)
        self.grad = 1
        for v in reversed(topo):
            for child, local_grad in zip(v._children, v._local_grads):
                child.grad += local_grad * v.grad

# Model class
class AtomicGPT:
    def __init__(self, n_layer=1, n_embd=16, block_size=16, n_head=4):
        self.docs = load_docs()
        self.uchars, self.BOS, self.vocab_size = get_vocab(self.docs)
        self.n_layer = n_layer
        self.n_embd = n_embd
        self.block_size = block_size
        self.n_head = n_head
        self.head_dim = n_embd // n_head
        self.state_dict = self._init_params()
        self.params = [p for mat in self.state_dict.values() for row in mat for p in row]
        self.m = [0.0] * len(self.params)
        self.v = [0.0] * len(self.params)
    def _init_params(self):
        matrix = lambda nout, nin, std=0.08: [[Value(random.gauss(0, std)) for _ in range(nin)] for _ in range(nout)]
        sd = {'wte': matrix(self.vocab_size, self.n_embd), 'wpe': matrix(self.block_size, self.n_embd), 'lm_head': matrix(self.vocab_size, self.n_embd)}
        for i in range(self.n_layer):
            sd[f'layer{i}.attn_wq'] = matrix(self.n_embd, self.n_embd)
            sd[f'layer{i}.attn_wk'] = matrix(self.n_embd, self.n_embd)
            sd[f'layer{i}.attn_wv'] = matrix(self.n_embd, self.n_embd)
            sd[f'layer{i}.attn_wo'] = matrix(self.n_embd, self.n_embd)
            sd[f'layer{i}.mlp_fc1'] = matrix(4 * self.n_embd, self.n_embd)
            sd[f'layer{i}.mlp_fc2'] = matrix(self.n_embd, 4 * self.n_embd)
        return sd
    def linear(self, x, w):
        return [sum(wi * xi for wi, xi in zip(wo, x)) for wo in w]
    def softmax(self, logits):
        max_val = max(val.data for val in logits)
        exps = [(val - max_val).exp() for val in logits]
        total = sum(exps)
        return [e / total for e in exps]
    def rmsnorm(self, x):
        ms = sum(xi * xi for xi in x) / len(x)
        scale = (ms + 1e-5) ** -0.5
        return [xi * scale for xi in x]
    def gpt(self, token_id, pos_id, keys, values):
        tok_emb = self.state_dict['wte'][token_id]
        pos_emb = self.state_dict['wpe'][pos_id]
        x = [t + p for t, p in zip(tok_emb, pos_emb)]
        x = self.rmsnorm(x)
        for li in range(self.n_layer):
            x_residual = x
            x = self.rmsnorm(x)
            q = self.linear(x, self.state_dict[f'layer{li}.attn_wq'])
            k = self.linear(x, self.state_dict[f'layer{li}.attn_wk'])
            v = self.linear(x, self.state_dict[f'layer{li}.attn_wv'])
            keys[li].append(k)
            values[li].append(v)
            x_attn = []
            for h in range(self.n_head):
                hs = h * self.head_dim
                q_h = q[hs:hs+self.head_dim]
                k_h = [ki[hs:hs+self.head_dim] for ki in keys[li]]
                v_h = [vi[hs:hs+self.head_dim] for vi in values[li]]
                attn_logits = [sum(q_h[j] * k_h[t][j] for j in range(self.head_dim)) / self.head_dim**0.5 for t in range(len(k_h))]
                attn_weights = self.softmax(attn_logits)
                head_out = [sum(attn_weights[t] * v_h[t][j] for t in range(len(v_h))) for j in range(self.head_dim)]
                x_attn.extend(head_out)
            x = self.linear(x_attn, self.state_dict[f'layer{li}.attn_wo'])
            x = [a + b for a, b in zip(x, x_residual)]
            x_residual = x
            x = self.rmsnorm(x)
            x = self.linear(x, self.state_dict[f'layer{li}.mlp_fc1'])
            x = [xi.relu() for xi in x]
            x = self.linear(x, self.state_dict[f'layer{li}.mlp_fc2'])
            x = [a + b for a, b in zip(x, x_residual)]
        logits = self.linear(x, self.state_dict['lm_head'])
        return logits
    def train(self, num_steps=1000, learning_rate=0.01, beta1=0.85, beta2=0.99, eps_adam=1e-8):
        for step in range(num_steps):
            doc = self.docs[step % len(self.docs)]
            tokens = [self.BOS] + [self.uchars.index(ch) for ch in doc] + [self.BOS]
            n = min(self.block_size, len(tokens) - 1)
            keys, values = [[] for _ in range(self.n_layer)], [[] for _ in range(self.n_layer)]
            losses = []
            for pos_id in range(n):
                token_id, target_id = tokens[pos_id], tokens[pos_id + 1]
                logits = self.gpt(token_id, pos_id, keys, values)
                probs = self.softmax(logits)
                loss_t = -probs[target_id].log()
                losses.append(loss_t)
            loss = (1 / n) * sum(losses)
            loss.backward()
            lr_t = learning_rate * (1 - step / num_steps)
            for i, p in enumerate(self.params):
                self.m[i] = beta1 * self.m[i] + (1 - beta1) * p.grad
                self.v[i] = beta2 * self.v[i] + (1 - beta2) * p.grad ** 2
                m_hat = self.m[i] / (1 - beta1 ** (step + 1))
                v_hat = self.v[i] / (1 - beta2 ** (step + 1))
                p.data -= lr_t * m_hat / (v_hat ** 0.5 + eps_adam)
                p.grad = 0
            if step % 100 == 0 or step == num_steps - 1:
                print(f"step {step+1:4d} / {num_steps:4d} | loss {loss.data:.4f}")
        return loss.data
    def generate(self, temperature=0.5, num_samples=20):
        samples = []
        for sample_idx in range(num_samples):
            keys, values = [[] for _ in range(self.n_layer)], [[] for _ in range(self.n_layer)]
            token_id = self.BOS
            sample = []
            for pos_id in range(self.block_size):
                logits = self.gpt(token_id, pos_id, keys, values)
                probs = self.softmax([l / temperature for l in logits])
                token_id = random.choices(range(self.vocab_size), weights=[p.data for p in probs])[0]
                if token_id == self.BOS:
                    break
                sample.append(self.uchars[token_id])
            samples.append(''.join(sample))
        return samples
