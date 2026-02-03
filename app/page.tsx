import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6 text-white">
      <div className="max-w-md text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-white">
          🌌 Serverless Link Saver
        </h1>
        <p className="mb-8 text-zinc-400">
          Your personal AI knowledge base is active and running.
          <br />
          Send links to your Telegram Bot to archive them.
        </p>

        <div className="grid gap-4">
          <div className="rounded-lg bg-zinc-900 p-4 border border-zinc-800">
            <h3 className="mb-2 font-medium text-emerald-400">✅ System Status: Online</h3>
            <p className="text-sm text-zinc-500">
              Webhook Listener: Active<br />
              AI Reasoning: Active<br />
              Notion Connection: Active
            </p>
          </div>

          <Link
            href="https://github.com/cnaron/serverless-link-saver"
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/20"
            target="_blank"
          >
            View Documentation
          </Link>
        </div>
      </div>
    </div>
  );
}
