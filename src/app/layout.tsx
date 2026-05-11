import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PAH v4 — SERVER SIDE",
  description: "Server-side prediction engine with naive ensemble",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
