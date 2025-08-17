import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { CharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Document } from "@langchain/core/documents";
import multer from "multer";
import path from "path";
import fs from "fs-extra";

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads");
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

export const upload = multer({ storage });

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

export async function processPDFAndGenerateEmbeddings(
  input: string | Buffer
): Promise<{
  chunks: string[];
  embeddings: number[][];
}> {
  try {
    let docs;

    if (typeof input === "string") {
      // Load the PDF using file path (for local development)
      const loader = new PDFLoader(input);
      docs = await loader.load();
    } else {
      // Load the PDF using buffer (for Vercel deployment)
      // Convert Buffer to Blob and use it with PDFLoader
      const blob = new Blob([input], { type: "application/pdf" });
      const loader = new PDFLoader(blob);
      docs = await loader.load();
    }

    // Extract text from all pages
    const fullText = docs.map((doc) => doc.pageContent).join("\n");

    // Split text into chunks using LangChain
    const textSplitter = new CharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separator: "\n",
    });

    const splitDocs = await textSplitter.splitDocuments([
      new Document({ pageContent: fullText }),
    ]);

    const chunks = splitDocs.map((doc) => doc.pageContent);

    // Generate embeddings for each chunk using direct Google AI client
    console.log(`Generating embeddings for ${chunks.length} chunks...`);
    const embeddingsArray = await generateEmbeddings(chunks);

    // Log the first embedding dimension for debugging
    if (embeddingsArray.length > 0) {
      console.log(`First embedding dimension: ${embeddingsArray[0].length}`);
    }

    return {
      chunks,
      embeddings: embeddingsArray,
    };
  } catch (error) {
    console.error("Error processing PDF:", error);
    throw new Error("Failed to process PDF and generate embeddings");
  }
}
