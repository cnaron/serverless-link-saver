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
  archiveUrl?: string; // Optional Telegra.ph link
  created_time?: string;
}

function formatDateLabel(isoString: string | undefined): string {
  if (!isoString) return 'Unknown Date';
  const date = new Date(isoString);
  // Format: "YYYY-MM-DD" e.g. "2024-02-03"
  // LinkMind uses a specific format, let's try to match standard "Sept 23, 2024" or similar if we want 
  // But home.ejs just prints `item._dayLabel`. 
  // Let's use locale date string for now, or just YYYY-MM-DD for simplicity/consistency.
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
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

  // Group links by day
  const groupedLinks: { label: string; items: LinkItem[] }[] = [];
  let currentLabel = '';

  links.forEach(link => {
    const label = formatDateLabel(link.created_time || new Date().toISOString());
    if (label !== currentLabel) {
      groupedLinks.push({ label, items: [] });
      currentLabel = label;
    }
    groupedLinks[groupedLinks.length - 1].items.push(link);
  });

  if (loading) {
    return <div className="text-center py-12 text-zinc-500">Loading...</div>;
  }

  if (error) {
    return <div className="text-center py-12 text-red-500">Error: {error}</div>;
  }

  return (
    <>
      {/* Tag Filter Banner */}
      {tagFilter && (
        <div style={{
          marginBottom: '20px',
          padding: '10px 15px',
          background: 'var(--badge-scraped-bg)',
          color: 'var(--badge-scraped-text)',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.9rem'
        }}>
          <span>Filtering by tag: <b>#{tagFilter}</b></span>
          <button
            onClick={clearFilter}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '1.2rem'
            }}>✕</button>
        </div>
      )}

      {links.length === 0 ? (
        <div className="empty-state">还没有收藏任何链接</div>
      ) : (
        <div className="timeline">
          {groupedLinks.map((group, groupIdx) => (
            <div key={groupIdx}>
              <div className="day-label">{group.label}</div>
              {group.items.map((link) => (
                <div key={link.id} className="link-card">
                  <h3>
                    <Link href={`/link/${link.id}`}>{link.title}</Link>
                    {/* Status badges could go here if we had status logic */}
                  </h3>
                  <div className="card-meta">
                    <a href={link.url} target="_blank">{link.url}</a>
                    {/* Add time if available, e.g. · 14:00 */}
                    {link.created_time && ` · ${new Date(link.created_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`}
                  </div>

                  {/* Summary in details/summary like LinkMind */}
                  {link.summary && (
                    <details>
                      <summary>{link.summary}</summary>
                      {/* We can show Insight inside details too if we want, or keep it separate. 
                          LinkMind only shows summary in details. 
                          I will put visual cue if insight exists. 
                      */}
                      {link.insight && (
                        <div style={{
                          marginTop: '10px',
                          paddingLeft: '10px',
                          borderLeft: '2px solid var(--accent)',
                          color: 'var(--dim)',
                          fontSize: '0.85rem'
                        }}>
                          <strong>AI Insight:</strong> {link.insight}
                        </div>
                      )}
                    </details>
                  )}

                  {/* Tags */}
                  <div style={{ marginTop: '8px' }}>
                    {link.tags.map(tag => (
                      <Link
                        key={tag}
                        href={`/?tag=${encodeURIComponent(tag)}`}
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--dim)',
                          marginRight: '8px',
                          textDecoration: 'none'
                        }}
                      >
                        #{tag}
                      </Link>
                    ))}
                  </div>

                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-zinc-500">Loading...</div>}>
      <LinkList />
    </Suspense>
  );
}
