"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// ForceGraph3D (must be client-side only)
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
});

export default function KnowledgeGraph() {
  const [data, setData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/graph")
      .then((res) => res.json())
      .then((graphData) => {
        setData(graphData);
        setLoading(false);
      })
      .catch((err) => console.error(err));
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center text-white font-mono animate-pulse">Initializing Knowledge Galaxy...</div>;

  return (
    <div className="h-screen w-full bg-[#000011] overflow-hidden relative">
      <ForceGraph3D
        graphData={data}
        nodeLabel="name"
        nodeAutoColorBy="group"
        linkDirectionalParticles={4}
        linkDirectionalParticleSpeed={0.01}
        linkOpacity={0.3}
        backgroundColor="#000011"
        onNodeClick={(node: any) => {
          if (node.url) {
            window.open(node.url, '_blank');
          }
        }}
        nodeRelSize={6}
      />

      {/* Overlay UI */}
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600 drop-shadow-lg">
          Knowledge Galaxy
        </h1>
        <div className="mt-2 flex gap-4 text-sm text-gray-400 font-mono">
          <span>🌌 Nodes: {data.nodes.length}</span>
          <span>🔗 Links: {data.links.length}</span>
        </div>
      </div>

      <div className="absolute bottom-6 right-6 z-10 text-xs text-gray-600 font-mono pointer-events-none">
        Drag to Rotate • Scroll to Zoom • Click to Open
      </div>
    </div>
  );
}
