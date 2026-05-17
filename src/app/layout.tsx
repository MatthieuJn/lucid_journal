import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lucid Journal",
  description: "Personal activity timeline and journal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-gray-950 text-gray-100 antialiased">{children}</body>
    </html>
  );
}
