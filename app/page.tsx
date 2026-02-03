"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface LinkItem {
  id: string;
  title: string;
  category: string;
  tags: string[];
  summary: string;
  url: string;
  notionUrl: string;
}

export default function Home() {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/links")
      .then((res) => res.json())
      .then((data) => {
        setLinks(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-12">
      <header className="max-w-6xl mx-auto mb-12 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Serverless Link Saver
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

      {loading ? (
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-zinc-900 rounded-xl border border-zinc-800"></div>
          ))}
        </div>
      ) : (
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {links.map((link) => (
            <div
              key={link.id}
              className="group flex flex-col justify-between bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 p-6 rounded-xl transition-all duration-200"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-mono font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">
                    {link.category}
                  </span>
                  <a
                    href={link.notionUrl}
                    target="_blank"
                    className="text-zinc-500 hover:text-white transition-colors"
                    title="Open in Notion"
                  >
                    ↗
                  </a>
                </div>

                <h2 className="text-lg font-semibold mb-3 leading-snug group-hover:text-emerald-300 transition-colors">
                  <a href={link.url} target="_blank">{link.title}</a>
                </h2>

                <p className="text-sm text-zinc-400 leading-relaxed line-clamp-4">
                  {link.summary}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {link.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="text-xs text-zinc-600 bg-zinc-950 px-2 py-1 rounded-md border border-zinc-900">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
