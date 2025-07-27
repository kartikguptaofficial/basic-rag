import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Google Generative AI for embeddings and LLM
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
const llmModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Function to generate embedding using direct Google AI client
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const result = await embeddingModel.embedContent(text);
    const embedding = result.embedding.values;
    console.log(
      `Generated query embedding with ${embedding.length} dimensions`
    );
    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error("Failed to generate embedding");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "No message provided" },
        { status: 400 }
      );
    }

    console.log("Processing message:", message);

    // Generate embedding for user query
    const queryEmbedding = await generateEmbedding(message);
    console.log("Query embedding length:", queryEmbedding.length);

    // First, let's check if we have any embeddings in the database
    const { data: embeddingCount, error: countError } = await supabaseAdmin
      .from("vector_embeddings")
      .select("id", { count: "exact" });

    if (countError) {
      console.error("Error checking embeddings:", countError);
      throw new Error("Failed to check database");
    }

    console.log("Total embeddings in database:", embeddingCount?.length || 0);

    if (!embeddingCount || embeddingCount.length === 0) {
      return NextResponse.json({
        response:
          "I don't have any documents to search through. Please upload some documents first.",
        sources_used: 0,
        context_length: 0,
      });
    }

    // Try vector similarity search using RPC
    let similarChunks = null;
    let searchError = null;

    try {
      const { data, error } = await supabaseAdmin.rpc("match_documents", {
        query_embedding: queryEmbedding,
        match_threshold: 0.5, // Lower threshold for better matches
        match_count: 5,
      });

      similarChunks = data;
      searchError = error;
    } catch (rpcError) {
      console.error("RPC call failed:", rpcError);
      searchError = rpcError;
    }

    console.log("Similar chunks result:", { similarChunks, searchError });

    if (searchError || !similarChunks || similarChunks.length === 0) {
      console.error("Vector search error:", searchError);

      // Fallback: get recent chunks if vector search fails
      const { data: fallbackChunks, error: fallbackError } = await supabaseAdmin
        .from("document_chunks")
        .select("id, content")
        .order("created_at", { ascending: false })
        .limit(3);

      if (fallbackError) {
        console.error("Fallback search error:", fallbackError);
        throw new Error("Failed to search for documents");
      }

      console.log("Using fallback chunks:", fallbackChunks);

      // Build context from fallback chunks
      const context =
        fallbackChunks?.map((chunk: any) => chunk.content).join("\n\n") || "";

      // Create prompt for Gemini
      const prompt = `
Based on the following context information, please answer the user's question. If the context doesn't contain relevant information, please say so.

Context:
${context}

User Question: ${message}

Please provide a helpful and accurate response based on the context provided. If the context is empty or doesn't contain relevant information, please indicate that you don't have enough information to answer the question.
`;

      // Generate response using Gemini
      const result = await llmModel.generateContent(prompt);
      const assistantResponse = result.response.text();

      // Store chat message
      await supabaseAdmin.from("chat_messages").insert({
        user_message: message,
        assistant_response: assistantResponse,
      });

      return NextResponse.json({
        response: assistantResponse,
        sources_used: fallbackChunks?.length || 0,
        context_length: context.length,
      });
    }

    // Build context from similar chunks
    const context =
      similarChunks?.map((chunk: any) => chunk.content).join("\n\n") || "";

    console.log("Context length:", context.length);

    // Create prompt for Gemini
    const prompt = `
Based on the following context information, please answer the user's question. If the context doesn't contain relevant information, please say so.

Context:
${context}

User Question: ${message}

Please provide a helpful and accurate response based on the context provided. If the context is empty or doesn't contain relevant information, please indicate that you don't have enough information to answer the question.
`;

    // Generate response using Gemini
    const result = await llmModel.generateContent(prompt);
    const assistantResponse = result.response.text();

    // Store chat message
    await supabaseAdmin.from("chat_messages").insert({
      user_message: message,
      assistant_response: assistantResponse,
    });

    return NextResponse.json({
      response: assistantResponse,
      sources_used: similarChunks?.length || 0,
      context_length: context.length,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}
