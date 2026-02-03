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

  if (loading) return <div className="flex h-screen items-center justify-center text-white">Loading your Universe...</div>;

  return (
    <div className="h-screen w-full bg-black">
      <ForceGraph3D
        graphData={data}
        nodeLabel="name"
        nodeAutoColorBy="group"
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.005}
        linkOpacity={0.5}
        backgroundColor="#000000"
        onNodeClick={(node: any) => {
          if (node.url) {
            window.open(node.url, '_blank');
          }
        }}
      />
      <div className="absolute top-5 left-5 text-white z-10 p-4 bg-black/50 rounded-lg">
        <h1 className="text-2xl font-bold">🌌 Knowledge Galaxy</h1>
        <p className="text-sm opacity-80">Drag to rotate • Scroll to zoom</p>
      </div>
    </div>
  );
}
