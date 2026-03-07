// lib/groq-key-manager.ts

/**
 * GroqKeyManager handles rotation through multiple Groq API keys.
 * It reads the environment variable GROQ_API_KEYS (comma‑separated).
 * If not set, it falls back to the single GROQ_API_KEY.
 * The manager keeps an in‑memory index and provides the current key.
 * When a 429 response is detected, rotateKey() advances the index.
 */

class GroqKeyManager {
    private keys: string[] = [];
    private index: number = 0;

    constructor() {
        const multi = process.env.GROQ_API_KEYS;
        if (multi) {
            this.keys = multi.split(',').map(k => k.trim()).filter(Boolean);
        }
        // Ensure at least one key exists (fallback to single key)
        const single = process.env.GROQ_API_KEY;
        if (this.keys.length === 0 && single) {
            this.keys = [single];
        }
        if (this.keys.length === 0) {
            throw new Error('No Groq API keys configured');
        }
    }

    /** Return the current API key */
    getCurrentKey(): string {
        return this.keys[this.index];
    }

    /** Rotate to the next key and return it */
    rotateKey(): string {
        this.index = (this.index + 1) % this.keys.length;
        console.warn(`[GroqKeyManager] Rotating to key ${this.index + 1}/${this.keys.length}`);
        return this.getCurrentKey();
    }

    /** Get number of configured keys */
    get keyCount(): number {
        return this.keys.length;
    }

    /** Get current key index */
    get currentIndex(): number {
        return this.index;
    }
}

// Export a singleton for easy import
export const groqKeyManager = new GroqKeyManager();
