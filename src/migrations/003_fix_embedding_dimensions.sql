-- Migration 003: Fix vector dimensions to match actual Google AI embedding dimensions (768)
-- The Google AI client generates 768-dimensional embeddings, not 1536

-- Drop the existing vector_embeddings table and recreate with correct dimension
DROP TABLE IF EXISTS public.vector_embeddings CASCADE;

-- Recreate the vector_embeddings table with the actual dimension (768)
CREATE TABLE public.vector_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID REFERENCES public.document_chunks(id) ON DELETE CASCADE,
  embedding VECTOR(768), -- Updated to match actual Google AI embedding dimension
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.vector_embeddings ENABLE ROW LEVEL SECURITY;

-- Create policy for public access
CREATE POLICY "Allow all access to vector_embeddings" ON public.vector_embeddings FOR ALL USING (true);

-- Create index for vector similarity search
CREATE INDEX ON public.vector_embeddings USING ivfflat (embedding vector_cosine_ops);

-- Drop the existing match_documents function if it exists
DROP FUNCTION IF EXISTS match_documents(vector, float, int);

-- Create improved match_documents function with correct vector dimensions
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE sql
AS $$
  SELECT
    dc.id,
    dc.content,
    1 - (ve.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  JOIN vector_embeddings ve ON dc.id = ve.chunk_id
  WHERE 1 - (ve.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- Add a comment to document the migration
COMMENT ON FUNCTION match_documents(vector, float, int) IS 'Vector similarity search function for RAG system using cosine similarity with 768-dimensional embeddings'; 