import "./globals.css";
import Link from "next/link";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav className="bg-blue-600 text-white p-4">
          <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-xl font-bold">RAG System</h1>
            <div className="space-x-4">
              <Link href="/upload" className="hover:underline">
                Upload Documents
              </Link>
              <Link href="/chat" className="hover:underline">
                Chat
              </Link>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
