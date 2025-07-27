import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface Document {
  id: string;
  title: string;
  content: string;
  file_type: "pdf" | "text";
  created_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  tokens: number;
  created_at: string;
}

export interface VectorEmbedding {
  id: string;
  chunk_id: string;
  embedding: number[];
  created_at: string;
}

export interface ChatMessage {
  id: string;
  user_message: string;
  assistant_response: string;
  created_at: string;
}
