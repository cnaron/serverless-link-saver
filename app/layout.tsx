import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Serverless Link Saver",
  description: "A personal knowledge galaxy powered by AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <header className="site-header">
          <a href="/">🧠 公子欢的摘抄本</a>
        </header>
        <div className="page-body">
          {children}
        </div>
      </body>
    </html>
  );
}
