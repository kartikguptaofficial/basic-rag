# RAG (Retrieval-Augmented Generation) Application

A Next.js application that implements a RAG system using Google Gemini for embeddings and LLM, with Supabase for vector storage and PostgreSQL with pgvector for similarity search.

## Features

- **Document Upload**: Upload PDF files or enter text directly
- **Text Processing**: Automatic chunking and embedding generation using LangChain
- **Vector Storage**: Store embeddings in Supabase with pgvector
- **Chat Interface**: Ask questions and get answers based on your documents
- **Similarity Search**: Find relevant document chunks using vector similarity

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **AI/ML**: Google Gemini (embeddings and LLM), LangChain
- **Database**: Supabase (PostgreSQL with pgvector)
- **File Processing**: PDF parsing with LangChain

## Prerequisites

- Node.js 18+
- Supabase account
- Google Gemini API key

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd rag-app
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Database Setup

1. Create a new Supabase project
2. Run the migration script in `src/migrations/001_initial_migration.sql` in your Supabase SQL editor
3. This will create:
   - Documents table
   - Document chunks table
   - Vector embeddings table
   - Chat messages table
   - Vector similarity search function

### 4. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Usage

### Uploading Documents

1. Navigate to the "Upload Documents" page
2. Either upload a PDF file or enter text directly
3. Add an optional title
4. Click "Upload & Process"
5. The system will:
   - Extract text from PDF (if applicable)
   - Split text into chunks
   - Generate embeddings using Google Gemini
   - Store everything in Supabase

### Chatting with Documents

1. Navigate to the "Chat" page
2. Ask questions about your uploaded documents
3. The system will:
   - Generate embedding for your question
   - Find similar document chunks
   - Use Gemini to generate a response based on the context

## API Endpoints

- `POST /api/upload` - Upload and process documents
- `POST /api/chat` - Chat with the RAG system

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # Chat API endpoint
│   │   └── upload/route.ts        # Upload API endpoint
│   ├── chat/page.tsx              # Chat page
│   ├── upload/page.tsx            # Upload page
│   └── layout.tsx                 # Root layout
├── components/
│   ├── ChatInterface.tsx          # Chat UI component
│   └── FileUpload.tsx             # Upload UI component
├── lib/
│   ├── pdf-utils.ts               # PDF processing utilities
│   └── supabase.ts                # Supabase client
└── migrations/
    └── 001_initial_migration.sql  # Database schema
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Google Gemini API](https://ai.google.dev/)
- [LangChain Documentation](https://js.langchain.com/)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).
