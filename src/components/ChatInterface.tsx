"use client";

import { useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  sourcesUsed?: number;
  contextLength?: number;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: userMessage }),
      });

      const result = await response.json();

      if (result.response) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.response,
            sourcesUsed: result.sources_used,
            contextLength: result.context_length,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I encountered an error processing your request.",
          },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error processing your request.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-8">
      <h2 className="text-2xl font-bold mb-4">Chat with Your Documents</h2>

      <div className="border border-gray-300 rounded-lg h-96 overflow-y-auto p-4 mb-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-center">
            Start a conversation by asking questions about your uploaded
            documents.
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`mb-4 ${
                message.role === "user" ? "text-right" : "text-left"
              }`}
            >
              <div
                className={`inline-block max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-800 border"
                }`}
              >
                <div>{message.content}</div>
                {message.role === "assistant" &&
                  message.sourcesUsed !== undefined && (
                    <div className="text-xs text-gray-500 mt-2">
                      Sources used: {message.sourcesUsed} | Context length:{" "}
                      {message.contextLength} chars
                    </div>
                  )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="text-left">
            <div className="inline-block bg-white text-gray-800 border px-4 py-2 rounded-lg">
              Thinking...
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about your documents..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
