/**
 * Text Chunking Utilities
 * Splits text into smaller chunks for embedding generation
 */

export interface TextChunk {
  id: string;
  content: string;
  metadata: {
    documentId: string;
    documentName: string;
    index: number;
    totalChunks: number;
  };
}

export interface ChunkOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

/**
 * Split text into overlapping chunks
 */
export function splitIntoChunks(
  text: string,
  documentId: string,
  documentName: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const { chunkSize = 1000, chunkOverlap = 200 } = options;

  // Clean and normalize the text
  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleanedText) {
    return [];
  }

  const chunks: TextChunk[] = [];
  const words = cleanedText.split(/\s+/);
  let currentChunk: string[] = [];
  let currentLength = 0;
  let chunkIndex = 0;

  for (const word of words) {
    const wordLength = word.length + 1; // +1 for space

    if (currentLength + wordLength > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        id: `${documentId}-chunk-${chunkIndex}`,
        content: currentChunk.join(' ').trim(),
        metadata: {
          documentId,
          documentName,
          index: chunkIndex,
          totalChunks: 0, // Will be updated after all chunks are created
        },
      });

      // Start new chunk with overlap
      const overlapWords = currentChunk.slice(-Math.floor(chunkOverlap / 5));
      currentChunk = [...overlapWords, word];
      currentLength = overlapWords.join(' ').length + 1 + word.length;
      chunkIndex++;
    } else {
      currentChunk.push(word);
      currentLength += wordLength;
    }
  }

  // Add the last chunk
  if (currentChunk.length > 0) {
    chunks.push({
      id: `${documentId}-chunk-${chunkIndex}`,
      content: currentChunk.join(' ').trim(),
      metadata: {
        documentId,
        documentName,
        index: chunkIndex,
        totalChunks: 0,
      },
    });
  }

  // Update totalChunks for all chunks
  const totalChunks = chunks.length;
  return chunks.map((chunk) => ({
    ...chunk,
    metadata: { ...chunk.metadata, totalChunks },
  }));
}

/**
 * Split text by paragraphs first, then by size
 * Better for maintaining context in documents
 */
export function splitByParagraphs(
  text: string,
  documentId: string,
  documentName: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const { chunkSize = 1000, chunkOverlap = 100 } = options;

  // Split by paragraph boundaries
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    // If single paragraph is larger than chunk size, split it further
    if (paragraph.length > chunkSize) {
      // Save current chunk if not empty
      if (currentChunk.trim()) {
        chunks.push({
          id: `${documentId}-chunk-${chunkIndex}`,
          content: currentChunk.trim(),
          metadata: {
            documentId,
            documentName,
            index: chunkIndex,
            totalChunks: 0,
          },
        });
        chunkIndex++;
        currentChunk = '';
      }

      // Split large paragraph by sentences
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      let sentenceChunk = '';

      for (const sentence of sentences) {
        if ((sentenceChunk + sentence).length > chunkSize) {
          if (sentenceChunk.trim()) {
            chunks.push({
              id: `${documentId}-chunk-${chunkIndex}`,
              content: sentenceChunk.trim(),
              metadata: {
                documentId,
                documentName,
                index: chunkIndex,
                totalChunks: 0,
              },
            });
            chunkIndex++;
          }
          sentenceChunk = sentence;
        } else {
          sentenceChunk += ' ' + sentence;
        }
      }

      if (sentenceChunk.trim()) {
        currentChunk = sentenceChunk;
      }
    } else if ((currentChunk + '\n\n' + paragraph).length > chunkSize) {
      // Save current chunk and start new one
      chunks.push({
        id: `${documentId}-chunk-${chunkIndex}`,
        content: currentChunk.trim(),
        metadata: {
          documentId,
          documentName,
          index: chunkIndex,
          totalChunks: 0,
        },
      });
      chunkIndex++;

      // Keep overlap from previous chunk
      if (chunkOverlap > 0 && chunks.length > 0) {
        const prevContent = chunks[chunks.length - 1].content;
        const overlapText = prevContent.slice(-chunkOverlap);
        currentChunk = overlapText + '\n\n' + paragraph;
      } else {
        currentChunk = paragraph;
      }
    } else {
      // Add paragraph to current chunk
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push({
      id: `${documentId}-chunk-${chunkIndex}`,
      content: currentChunk.trim(),
      metadata: {
        documentId,
        documentName,
        index: chunkIndex,
        totalChunks: 0,
      },
    });
  }

  // Update totalChunks for all chunks
  const totalChunks = chunks.length;
  return chunks.map((chunk) => ({
    ...chunk,
    metadata: { ...chunk.metadata, totalChunks },
  }));
}

