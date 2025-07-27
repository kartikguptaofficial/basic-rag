-- Enable pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  file_type TEXT CHECK (file_type IN ('pdf', 'text')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create document chunks table
CREATE TABLE public.document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  tokens INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create vector embeddings table with flexible dimension
CREATE TABLE public.vector_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID REFERENCES public.document_chunks(id) ON DELETE CASCADE,
  embedding VECTOR(1536), -- Updated to match Gemini embedding-001 dimension
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create chat messages table
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_message TEXT NOT NULL,
  assistant_response TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vector_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since no auth required for this demo)
CREATE POLICY "Allow all access to documents" ON public.documents FOR ALL USING (true);
CREATE POLICY "Allow all access to document_chunks" ON public.document_chunks FOR ALL USING (true);
CREATE POLICY "Allow all access to vector_embeddings" ON public.vector_embeddings FOR ALL USING (true);
CREATE POLICY "Allow all access to chat_messages" ON public.chat_messages FOR ALL USING (true);

-- Create index for vector similarity search
CREATE INDEX ON public.vector_embeddings USING ivfflat (embedding vector_cosine_ops);

-- Create storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true);

-- Create storage policies
CREATE POLICY "Allow public upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Allow public read" ON storage.objects FOR SELECT USING (bucket_id = 'documents');

-- Create function for vector similarity search with flexible dimension
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector,
  match_threshold float DEFAULT 0.7,
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