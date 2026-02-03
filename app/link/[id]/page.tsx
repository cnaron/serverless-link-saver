"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

interface ArticleDetail {
    id: string;
    title: string;
    url: string;
    summary: string;
    insight?: string;
    category: string;
    tags: string[];
    notionUrl: string;
    content: string;
}

interface RelatedLink {
    id: string;
    title: string;
    summary: string;
}

export default function ArticlePage() {
    const params = useParams();
    const router = useRouter();
    const [article, setArticle] = useState<ArticleDetail | null>(null);
    const [relatedArticles, setRelatedArticles] = useState<RelatedLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchArticle = async () => {
            try {
                const res = await fetch(`/api/links/${params.id}`);
                if (!res.ok) throw new Error("Article not found");
                const data = await res.json();
                setArticle(data);

                // Fetch related articles by tags
                if (data.tags.length > 0) {
                    const relRes = await fetch(`/api/links?tag=${encodeURIComponent(data.tags[0])}`);
                    if (relRes.ok) {
                        const relData = await relRes.json();
                        // Filter out current article
                        setRelatedArticles(
                            relData.filter((a: any) => a.id !== data.id).slice(0, 5)
                        );
                    }
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setLoading(false);
            }
        };

        if (params.id) {
            fetchArticle();
        }
    }, [params.id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
                <div className="animate-pulse text-zinc-500">Loading...</div>
            </div>
        );
    }

    if (error || !article) {
        return (
            <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-4">
                <p className="text-red-400">Error: {error || "Article not found"}</p>
                <button
                    onClick={() => router.push("/")}
                    className="px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700"
                >
                    Back to Home
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
            {/* Header */}
            <header className="border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10 backdrop-blur">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
                    <Link href="/" className="text-zinc-500 hover:text-white transition-colors">
                        ← Back
                    </Link>
                    <span className="text-xs font-mono text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">
                        {article.category}
                    </span>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-6 py-12">
                {/* Title */}
                <h1 className="text-3xl font-bold mb-4 leading-tight">{article.title}</h1>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-8">
                    {article.tags.map((tag) => (
                        <Link
                            key={tag}
                            href={`/?tag=${encodeURIComponent(tag)}`}
                            className="text-xs text-zinc-400 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800 hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
                        >
                            #{tag}
                        </Link>
                    ))}
                </div>

                {/* Summary */}
                <div className="mb-6 p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                    <p className="text-sm text-zinc-400 font-medium mb-2">📝 摘要</p>
                    <p className="text-zinc-300 leading-relaxed">{article.summary}</p>
                </div>

                {/* Insight */}
                {article.insight && (
                    <div className="mb-8 p-4 bg-amber-900/20 border-l-4 border-amber-500/50 rounded-r-lg">
                        <p className="text-xs text-amber-400 font-medium mb-1">💡 AI 洞见</p>
                        <p className="text-amber-100/80 leading-relaxed">{article.insight}</p>
                    </div>
                )}

                {/* Full Content */}
                <div className="prose prose-invert prose-zinc max-w-none">
                    <h2 className="text-xl font-semibold mb-4 text-zinc-300">📄 完整内容</h2>
                    <div className="bg-zinc-900/30 p-6 rounded-lg border border-zinc-800">
                        <ReactMarkdown
                            components={{
                                h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-3">{children}</h1>,
                                h2: ({ children }) => <h2 className="text-xl font-semibold mt-5 mb-2">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-lg font-medium mt-4 mb-2">{children}</h3>,
                                p: ({ children }) => <p className="mb-4 leading-relaxed text-zinc-300">{children}</p>,
                                ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>,
                                li: ({ children }) => <li className="text-zinc-400">{children}</li>,
                                blockquote: ({ children }) => (
                                    <blockquote className="border-l-4 border-zinc-600 pl-4 my-4 italic text-zinc-400">{children}</blockquote>
                                ),
                                code: ({ children }) => (
                                    <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-sm text-emerald-400">{children}</code>
                                ),
                                pre: ({ children }) => (
                                    <pre className="bg-zinc-800 p-4 rounded-lg overflow-x-auto my-4">{children}</pre>
                                ),
                            }}
                        >
                            {article.content}
                        </ReactMarkdown>
                    </div>
                </div>

                {/* External Links */}
                <div className="mt-8 flex gap-4">
                    <a
                        href={article.url}
                        target="_blank"
                        className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors"
                    >
                        🔗 View Original
                    </a>
                    <a
                        href={article.notionUrl}
                        target="_blank"
                        className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors"
                    >
                        📓 Open in Notion
                    </a>
                </div>
            </main>

            {/* Related Articles Sidebar */}
            {relatedArticles.length > 0 && (
                <aside className="max-w-4xl mx-auto px-6 pb-12">
                    <h3 className="text-lg font-medium mb-4 text-zinc-300">📚 相关文章</h3>
                    <div className="grid gap-3">
                        {relatedArticles.map((rel) => (
                            <Link
                                key={rel.id}
                                href={`/link/${rel.id}`}
                                className="block p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors"
                            >
                                <p className="font-medium text-zinc-200 mb-1">{rel.title}</p>
                                <p className="text-sm text-zinc-500 line-clamp-2">{rel.summary}</p>
                            </Link>
                        ))}
                    </div>
                </aside>
            )}
        </div>
    );
}
