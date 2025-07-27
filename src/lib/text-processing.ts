export function splitTextIntoChunks(
  text: string,
  chunkSize: number = 200
): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim().length > 0) {
      chunks.push(chunk.trim());
    }
  }

  return chunks;
}

export function countTokens(text: string): number {
  // Simple token estimation (words * 1.3 for subword tokens)
  return Math.ceil(text.split(/\s+/).length * 1.3);
}

export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[^\w\s.,!?;:()\-"']/g, "")
    .trim();
}
