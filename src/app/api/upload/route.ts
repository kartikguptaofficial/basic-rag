import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { processPDFAndGenerateEmbeddings } from "@/lib/pdf-utils";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";

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
  let uploadedFilePath: string | null = null;

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

        try {
          // 1. Upload file to Supabase Storage
          const fileName = `pdf-${Date.now()}-${Math.round(
            Math.random() * 1e9
          )}.pdf`;
          const { data: uploadData, error: uploadError } =
            await supabaseAdmin.storage
              .from("documents")
              .upload(fileName, file, {
                contentType: "application/pdf",
                cacheControl: "3600",
                upsert: false,
              });

          if (uploadError) {
            console.error("Storage upload error:", uploadError);
            throw new Error("Failed to upload file to storage");
          }

          uploadedFilePath = fileName;
          console.log("File uploaded to storage:", fileName);

          // 2. Download file from storage to process
          const { data: downloadData, error: downloadError } =
            await supabaseAdmin.storage.from("documents").download(fileName);

          if (downloadError) {
            console.error("Storage download error:", downloadError);
            throw new Error("Failed to download file from storage");
          }

          // 3. Convert to Buffer and process
          const arrayBuffer = await downloadData.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // 4. Process PDF and generate embeddings
          const result = await processPDFAndGenerateEmbeddings(buffer);
          chunks = result.chunks;
          embeddingsArray = result.embeddings;
          content = chunks.join("\n\n");
        } catch (error) {
          // Clean up storage if processing fails
          if (uploadedFilePath) {
            await supabaseAdmin.storage
              .from("documents")
              .remove([uploadedFilePath]);
          }
          throw error;
        }
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

    // 5. Clean up: Delete file from storage after successful processing
    if (uploadedFilePath) {
      try {
        const { error: deleteError } = await supabaseAdmin.storage
          .from("documents")
          .remove([uploadedFilePath]);

        if (deleteError) {
          console.warn(
            "Warning: Failed to delete file from storage:",
            deleteError
          );
        } else {
          console.log("File cleaned up from storage:", uploadedFilePath);
        }
      } catch (cleanupError) {
        console.warn("Warning: Error during storage cleanup:", cleanupError);
      }
    }

    return NextResponse.json({
      success: true,
      documentId: document.id,
      chunksStored: chunks.length,
      embeddingsStored: embeddingsArray.length,
    });
  } catch (error) {
    console.error("Upload error:", error);

    // Clean up storage if there was an error
    if (uploadedFilePath) {
      try {
        await supabaseAdmin.storage
          .from("documents")
          .remove([uploadedFilePath]);
        console.log("Cleaned up storage after error:", uploadedFilePath);
      } catch (cleanupError) {
        console.warn(
          "Warning: Failed to cleanup storage after error:",
          cleanupError
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 }
    );
  }
}
