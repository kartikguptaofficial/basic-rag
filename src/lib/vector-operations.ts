import { supabaseAdmin } from "./supabase";

export async function storeEmbedding(
  chunkId: string,
  embedding: number[]
): Promise<void> {
  const { error } = await supabaseAdmin.from("vector_embeddings").insert({
    chunk_id: chunkId,
    embedding: embedding,
  });

  if (error) {
    console.error("Error storing embedding:", error);
    throw new Error("Failed to store embedding");
  }
}

export async function findSimilarChunks(
  queryEmbedding: number[],
  limit: number = 5,
  threshold: number = 0.7
): Promise<any[]> {
  const { data, error } = await supabaseAdmin.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
  });

  if (error) {
    console.error("Error finding similar chunks:", error);
    throw new Error("Failed to find similar chunks");
  }

  return data || [];
}
