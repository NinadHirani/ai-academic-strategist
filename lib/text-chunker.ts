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

export function splitIntoChunks(
  text: string,
  documentId: string,
  documentName: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const { chunkSize = 1000, chunkOverlap = 200 } = options;

  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleanedText) return [];

  const chunks: TextChunk[] = [];
  const words = cleanedText.split(/\s+/);
  let currentChunk: string[] = [];
  let currentLength = 0;
  let chunkIndex = 0;

  for (const word of words) {
    const wordLength = word.length + 1;

    if (currentLength + wordLength > chunkSize && currentChunk.length > 0) {
      chunks.push({
        id: `${documentId}-chunk-${chunkIndex}`,
        content: currentChunk.join(' ').trim(),
        metadata: { documentId, documentName, index: chunkIndex, totalChunks: 0 },
      });

      const overlapWords = currentChunk.slice(-Math.floor(chunkOverlap / 5));
      currentChunk = [...overlapWords, word];
      currentLength = overlapWords.join(' ').length + 1 + word.length;
      chunkIndex++;
    } else {
      currentChunk.push(word);
      currentLength += wordLength;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push({
      id: `${documentId}-chunk-${chunkIndex}`,
      content: currentChunk.join(' ').trim(),
      metadata: { documentId, documentName, index: chunkIndex, totalChunks: 0 },
    });
  }

  const totalChunks = chunks.length;
  return chunks.map((chunk) => ({
    ...chunk,
    metadata: { ...chunk.metadata, totalChunks },
  }));
}

export function splitByParagraphs(
  text: string,
  documentId: string,
  documentName: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const { chunkSize = 1000, chunkOverlap = 100 } = options;

  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    if (paragraph.length > chunkSize) {
      if (currentChunk.trim()) {
        chunks.push({
          id: `${documentId}-chunk-${chunkIndex}`,
          content: currentChunk.trim(),
          metadata: { documentId, documentName, index: chunkIndex, totalChunks: 0 },
        });
        chunkIndex++;
        currentChunk = '';
      }

      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      let sentenceChunk = '';

      for (const sentence of sentences) {
        if ((sentenceChunk + sentence).length > chunkSize) {
          if (sentenceChunk.trim()) {
            chunks.push({
              id: `${documentId}-chunk-${chunkIndex}`,
              content: sentenceChunk.trim(),
              metadata: { documentId, documentName, index: chunkIndex, totalChunks: 0 },
            });
            chunkIndex++;
          }
          sentenceChunk = sentence;
        } else {
          sentenceChunk += ' ' + sentence;
        }
      }

      if (sentenceChunk.trim()) currentChunk = sentenceChunk;
    } else if ((currentChunk + '\n\n' + paragraph).length > chunkSize) {
      chunks.push({
        id: `${documentId}-chunk-${chunkIndex}`,
        content: currentChunk.trim(),
        metadata: { documentId, documentName, index: chunkIndex, totalChunks: 0 },
      });
      chunkIndex++;

      if (chunkOverlap > 0 && chunks.length > 0) {
        const prevContent = chunks[chunks.length - 1].content;
        const overlapText = prevContent.slice(-chunkOverlap);
        currentChunk = overlapText + '\n\n' + paragraph;
      } else {
        currentChunk = paragraph;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      id: `${documentId}-chunk-${chunkIndex}`,
      content: currentChunk.trim(),
      metadata: { documentId, documentName, index: chunkIndex, totalChunks: 0 },
    });
  }

  const totalChunks = chunks.length;
  return chunks.map((chunk) => ({
    ...chunk,
    metadata: { ...chunk.metadata, totalChunks },
  }));
}

