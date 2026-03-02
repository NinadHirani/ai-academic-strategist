/**
 * File-Based Vector Store Persistence
 * Saves vector store data to disk so it survives server restarts / hot reloads.
 * Used as a fallback when Supabase is not configured.
 */

import * as fs from "fs";
import * as path from "path";

const PERSISTENCE_DIR = path.join(process.cwd(), ".vector-store-cache");
const CHUNKS_FILE = path.join(PERSISTENCE_DIR, "chunks.json");
const LOCK_FILE = path.join(PERSISTENCE_DIR, ".lock");

interface PersistedChunk {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    documentId: string;
    documentName: string;
    chunkIndex: number;
    createdAt: string;
    userId?: string;
  };
}

interface PersistenceData {
  version: 1;
  savedAt: string;
  chunks: PersistedChunk[];
}

/**
 * Ensure the persistence directory exists
 */
function ensureDir(): void {
  if (!fs.existsSync(PERSISTENCE_DIR)) {
    fs.mkdirSync(PERSISTENCE_DIR, { recursive: true });
    // Add .gitignore inside the cache folder
    fs.writeFileSync(
      path.join(PERSISTENCE_DIR, ".gitignore"),
      "*\n",
      "utf-8"
    );
  }
}

/**
 * Save chunks to disk
 */
export function saveChunksToDisk(
  chunks: Map<string, PersistedChunk>
): boolean {
  try {
    ensureDir();
    const data: PersistenceData = {
      version: 1,
      savedAt: new Date().toISOString(),
      chunks: Array.from(chunks.values()).map((c) => ({
        ...c,
        metadata: {
          ...c.metadata,
          createdAt:
            typeof c.metadata.createdAt === "string"
              ? c.metadata.createdAt
              : new Date().toISOString(),
        },
      })),
    };
    fs.writeFileSync(CHUNKS_FILE, JSON.stringify(data), "utf-8");
    console.log(
      `[Persistence] Saved ${data.chunks.length} chunks to disk`
    );
    return true;
  } catch (error) {
    console.error("[Persistence] Save error:", error);
    return false;
  }
}

/**
 * Load chunks from disk
 */
export function loadChunksFromDisk(): PersistedChunk[] {
  try {
    if (!fs.existsSync(CHUNKS_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(CHUNKS_FILE, "utf-8");
    const data: PersistenceData = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.chunks)) {
      return [];
    }
    console.log(
      `[Persistence] Loaded ${data.chunks.length} chunks from disk (saved ${data.savedAt})`
    );
    return data.chunks;
  } catch (error) {
    console.error("[Persistence] Load error:", error);
    return [];
  }
}

/**
 * Clear persisted data
 */
export function clearPersistedData(): void {
  try {
    if (fs.existsSync(CHUNKS_FILE)) {
      fs.unlinkSync(CHUNKS_FILE);
    }
  } catch (error) {
    console.error("[Persistence] Clear error:", error);
  }
}

/**
 * Check if persisted data exists
 */
export function hasPersistedData(): boolean {
  return fs.existsSync(CHUNKS_FILE);
}
