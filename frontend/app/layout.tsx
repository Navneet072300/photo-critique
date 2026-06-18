import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Photo Critique Library",
  description: "AI-powered composition critique and auto-tagging for your photos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 antialiased">{children}</body>
    </html>
  );
}
