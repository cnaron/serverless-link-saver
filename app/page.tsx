"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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

function LinkList() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tagFilter = searchParams.get('tag');

  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLinks = async () => {
      setLoading(true);
      try {
        const url = tagFilter
          ? `/api/links?tag=${encodeURIComponent(tagFilter)}`
          : '/api/links';
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setLinks(data);
          setError(null);
        } else {
          setError(data.error || "Unknown error");
        }
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchLinks();
  }, [tagFilter]);

  const clearFilter = () => {
    router.push('/');
  };

  return (
    <>
      <header className="max-w-5xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <Link href="/">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              LinkMind Serverless
            </h1>
          </Link>
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

      {/* Tag Filter Banner */}
      {tagFilter && (
        <div className="max-w-5xl mx-auto mb-6 p-4 bg-emerald-900/20 border border-emerald-800 rounded-lg flex items-center justify-between">
          <p className="text-emerald-300">
            Filtering by tag: <span className="font-mono font-bold">#{tagFilter}</span>
          </p>
          <button
            onClick={clearFilter}
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            ✕ Clear Filter
          </button>
        </div>
      )}

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

              {/* Title - Links to detail page */}
              <h2 className="text-xl font-semibold mb-4 leading-snug group-hover:text-emerald-300 transition-colors">
                <Link href={`/link/${link.id}`}>{link.title}</Link>
              </h2>

              {/* Summary */}
              <div className="mb-4">
                <p className="text-sm text-zinc-400 leading-relaxed line-clamp-3">
                  {link.summary}
                </p>
              </div>

              {/* Insight (if exists) */}
              {link.insight && (
                <div className="mb-4 p-3 bg-amber-900/20 border-l-4 border-amber-500/50 rounded-r-lg">
                  <p className="text-xs text-amber-400 font-medium mb-1">💡 AI 洞见</p>
                  <p className="text-sm text-amber-100/80 leading-relaxed line-clamp-2">
                    {link.insight}
                  </p>
                </div>
              )}

              {/* Tags - Clickable for filtering */}
              <div className="flex flex-wrap gap-2">
                {link.tags.slice(0, 5).map((tag) => (
                  <Link
                    key={tag}
                    href={`/?tag=${encodeURIComponent(tag)}`}
                    className="text-xs text-zinc-500 bg-zinc-950 px-2 py-1 rounded-md border border-zinc-800 hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            </article>
          ))}

          {links.length === 0 && !loading && (
            <div className="text-center py-12 text-zinc-500">
              {tagFilter ? `No articles found with tag "${tagFilter}"` : "No articles saved yet. Send a link to your Telegram bot!"}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-12">
      <Suspense fallback={<div className="text-center py-12 text-zinc-500">Loading...</div>}>
        <LinkList />
      </Suspense>
    </div>
  );
}
