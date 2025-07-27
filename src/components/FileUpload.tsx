"use client";

import { useState } from "react";

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState("");
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file && !textInput.trim()) {
      setMessage("Please provide either a file or text input");
      return;
    }

    setUploading(true);
    setMessage("Processing...");

    try {
      const formData = new FormData();

      if (file) {
        console.log("Uploading file:", file.name, file.type, file.size);
        formData.append("file", file);
      }

      if (textInput.trim()) {
        formData.append("text", textInput.trim());
      }

      formData.append("title", title.trim());

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setMessage(
          `Successfully processed! Document ID: ${result.documentId}. Created ${result.chunksStored} chunks with ${result.embeddingsStored} embeddings.`
        );
        setFile(null);
        setTextInput("");
        setTitle("");
        // Reset file input
        const fileInput = document.querySelector(
          'input[type="file"]'
        ) as HTMLInputElement;
        if (fileInput) fileInput.value = "";
      } else {
        setMessage("Error: " + result.error);
      }
    } catch (error) {
      console.error("Upload error:", error);
      setMessage(
        "Upload failed: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8">
      <h2 className="text-2xl font-bold mb-4">Upload Document</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Title (optional)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Document title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Upload PDF File
          </label>
          <input
            type="file"
            accept=".pdf,.txt"
            onChange={(e) => {
              const selectedFile = e.target.files?.[0] || null;
              console.log(
                "File selected:",
                selectedFile?.name,
                selectedFile?.type
              );
              setFile(selectedFile);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <div className="text-center text-gray-500">OR</div>

        <div>
          <label className="block text-sm font-medium mb-2">Text Input</label>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            rows={6}
            placeholder="Enter your text here..."
          />
        </div>

        <button
          type="submit"
          disabled={uploading || (!file && !textInput.trim())}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? "Processing..." : "Upload & Process"}
        </button>
      </form>

      {message && (
        <div
          className={`mt-4 p-3 rounded-md ${
            message.includes("Successfully")
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}
