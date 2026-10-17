import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrossCheck — Find the difference. Start a conversation.",
  description: "Compare two spoken statements across languages. Find contradictions and ask the right clarification questions.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
