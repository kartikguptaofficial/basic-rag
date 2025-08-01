import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { processPDFAndGenerateEmbeddings, upload } from "@/lib/pdf-utils";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import path from "path";
import fs from "fs-extra";

// Initialize Google Generative AI for embeddings
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });

// Function to generate embeddings using direct Google AI client
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (const text of texts) {
    try {
      const result = await embeddingModel.embedContent(text);
      const embedding = result.embedding.values;
      embeddings.push(embedding);
      console.log(`Generated embedding with ${embedding.length} dimensions`);
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw new Error("Failed to generate embedding");
    }
  }

  return embeddings;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const textInput = formData.get("text") as string;
    const title = formData.get("title") as string;

    console.log({ file, textInput, title });

    if (!file && !textInput) {
      return NextResponse.json(
        { error: "No file or text provided" },
        { status: 400 }
      );
    }

    let content = "";
    let fileType: "pdf" | "text" = "text";
    let chunks: string[] = [];
    let embeddingsArray: number[][] = [];

    if (file) {
      console.log("File has been found!");
      console.log({ file });

      if (file.type === "application/pdf") {
        fileType = "pdf";

        // Save file to local directory
        const uploadDir = path.join(process.cwd(), "uploads");
        await fs.ensureDir(uploadDir);

        const fileName = `pdf-${Date.now()}-${Math.round(
          Math.random() * 1e9
        )}.pdf`;
        const filePath = path.join(uploadDir, fileName);

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await fs.writeFile(filePath, buffer);

        // Process PDF and generate embeddings using LangChain
        const result = await processPDFAndGenerateEmbeddings(filePath);
        chunks = result.chunks;
        embeddingsArray = result.embeddings;
        content = chunks.join("\n\n");

        // Clean up the temporary file
        await fs.remove(filePath);
      } else {
        fileType = "text";
        content = await file.text();

        // Process text chunks and embeddings
        const textSplitter = new CharacterTextSplitter({
          chunkSize: 1000,
          chunkOverlap: 200,
          separator: "\n",
        });

        const splitDocs = await textSplitter.splitDocuments([
          new Document({ pageContent: content }),
        ]);

        chunks = splitDocs.map((doc) => doc.pageContent);
        console.log(
          `Generating embeddings for ${chunks.length} text chunks...`
        );
        embeddingsArray = await generateEmbeddings(chunks);
      }
    } else {
      content = textInput;
      fileType = "text";

      // Process text chunks and embeddings
      const textSplitter = new CharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
        separator: "\n",
      });

      const splitDocs = await textSplitter.splitDocuments([
        new Document({ pageContent: content }),
      ]);

      chunks = splitDocs.map((doc) => doc.pageContent);
      console.log(`Generating embeddings for ${chunks.length} text chunks...`);
      embeddingsArray = await generateEmbeddings(chunks);
    }

    console.log({
      contentLength: content.length,
      chunksCount: chunks.length,
      embeddingsCount: embeddingsArray.length,
      firstEmbeddingLength: embeddingsArray[0]?.length || 0,
    });

    // Store document
    const { data: document, error: docError } = await supabaseAdmin
      .from("documents")
      .insert({
        title: title || file?.name || "Text Input",
        content,
        file_type: fileType,
      })
      .select()
      .single();

    if (docError) {
      console.error("Document storage error:", docError);
      throw new Error("Failed to store document");
    }

    console.log("Document stored with ID:", document.id);

    // Store chunks and embeddings
    for (let i = 0; i < chunks.length; i++) {
      const { data: chunk, error: chunkError } = await supabaseAdmin
        .from("document_chunks")
        .insert({
          document_id: document.id,
          chunk_index: i,
          content: chunks[i],
          tokens: chunks[i].split(" ").length, // Simple token estimation
        })
        .select()
        .single();

      if (chunkError) {
        console.error("Chunk storage error:", chunkError);
        throw new Error("Failed to store chunk");
      }

      console.log(`Stored chunk ${i + 1}/${chunks.length} with ID:`, chunk.id);

      // Store embedding
      const { error: embeddingError } = await supabaseAdmin
        .from("vector_embeddings")
        .insert({
          chunk_id: chunk.id,
          embedding: embeddingsArray[i],
        });

      if (embeddingError) {
        console.error("Embedding storage error:", embeddingError);
        throw new Error("Failed to store embedding");
      }

      console.log(
        `Stored embedding ${i + 1}/${embeddingsArray.length} for chunk:`,
        chunk.id
      );
    }

    return NextResponse.json({
      success: true,
      documentId: document.id,
      chunksStored: chunks.length,
      embeddingsStored: embeddingsArray.length,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 }
    );
  }
}
