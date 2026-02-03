"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface LinkItem {
  id: string;
  title: string;
  category: string;
  tags: string[];
  summary: string;
  insight?: string;
  url: string;
  notionUrl: string;
}

export default function Home() {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/links")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setLinks(data);
        } else {
          setError(data.error || "Unknown error");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-12">
      <header className="max-w-5xl mx-auto mb-12 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            LinkMind Serverless
          </h1>
          <p className="text-zinc-500 mt-2">Personal AI Knowledge Base • {links.length} Items</p>
        </div>
        <Link
          href="https://github.com/cnaron/serverless-link-saver"
          target="_blank"
          className="text-sm px-4 py-2 rounded-full border border-zinc-800 hover:bg-zinc-900 transition-colors"
        >
          View Docs
        </Link>
      </header>

      {error && (
        <div className="max-w-5xl mx-auto mb-8 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-300">
          Error: {error}
        </div>
      )}

      {loading ? (
        <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-zinc-900 rounded-xl border border-zinc-800"></div>
          ))}
        </div>
      ) : (
        <div className="max-w-5xl mx-auto space-y-6">
          {links.map((link) => (
            <article
              key={link.id}
              className="group bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 p-6 rounded-xl transition-all duration-200"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-mono font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">
                  {link.category}
                </span>
                <a
                  href={link.notionUrl}
                  target="_blank"
                  className="text-zinc-500 hover:text-white transition-colors text-sm"
                  title="Open in Notion"
                >
                  ↗ Notion
                </a>
              </div>

              {/* Title */}
              <h2 className="text-xl font-semibold mb-4 leading-snug group-hover:text-emerald-300 transition-colors">
                <a href={link.url} target="_blank">{link.title}</a>
              </h2>

              {/* Summary */}
              <div className="mb-4">
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {link.summary}
                </p>
              </div>

              {/* Insight (if exists) */}
              {link.insight && (
                <div className="mb-4 p-4 bg-amber-900/20 border-l-4 border-amber-500/50 rounded-r-lg">
                  <p className="text-xs text-amber-400 font-medium mb-1">💡 AI 洞见</p>
                  <p className="text-sm text-amber-100/80 leading-relaxed">
                    {link.insight}
                  </p>
                </div>
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {link.tags.slice(0, 5).map((tag) => (
                  <span key={tag} className="text-xs text-zinc-500 bg-zinc-950 px-2 py-1 rounded-md border border-zinc-800">
                    #{tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
