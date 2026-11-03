import React, { useMemo, useState } from 'react';
import { GitCommit } from '../types';
import { useCommitStore } from '../stores/useCommitStore';
import { GitBranch, Tag as TagIcon, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface CommitGraphViewProps {
  commits: GitCommit[];
}

interface GraphNode {
  commit: GitCommit;
  lane: number;
  x: number;
  y: number;
  parentCoords: { x: number; y: number }[];
}

const LANE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
];

const ROW_HEIGHT = 44;
const LANE_WIDTH = 20;
const GRAPH_LEFT_PAD = 30;

export const CommitGraphView: React.FC<CommitGraphViewProps> = ({ commits }) => {
  const { selectCommit } = useCommitStore();
  const [zoom, setZoom] = useState(1);

  // Calculate actual DAG swimlanes and parent-child curves
  const { nodes, totalLanes } = useMemo(() => {
    const commitIndexMap = new Map<string, number>();
    commits.forEach((c, idx) => commitIndexMap.set(c.hash, idx));

    const activeLanes: (string | null)[] = [];
    const calculatedNodes: GraphNode[] = [];
    let maxLane = 0;

    commits.forEach((commit, rowIndex) => {
      // Find lane for this commit
      let lane = activeLanes.indexOf(commit.hash);
      if (lane === -1) {
        lane = activeLanes.indexOf(null);
        if (lane === -1) {
          lane = activeLanes.length;
          activeLanes.push(null);
        }
      }
      if (lane > maxLane) maxLane = lane;

      const y = rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
      const x = GRAPH_LEFT_PAD + lane * LANE_WIDTH;

      // Determine parent lanes
      const parentCoords: { x: number; y: number }[] = [];
      const primaryParent = commit.parentHashes[0];

      if (primaryParent && commitIndexMap.has(primaryParent)) {
        activeLanes[lane] = primaryParent;
      } else {
        activeLanes[lane] = null;
      }

      // Handle merge parents
      for (let pIdx = 1; pIdx < commit.parentHashes.length; pIdx++) {
        const pHash = commit.parentHashes[pIdx];
        if (commitIndexMap.has(pHash)) {
          let pLane = activeLanes.indexOf(pHash);
          if (pLane === -1) {
            pLane = activeLanes.indexOf(null);
            if (pLane === -1) {
              pLane = activeLanes.length;
              activeLanes.push(null);
            }
          }
          activeLanes[pLane] = pHash;
          if (pLane > maxLane) maxLane = pLane;
        }
      }

      calculatedNodes.push({
        commit,
        lane,
        x,
        y,
        parentCoords,
      });
    });

    // Second pass to resolve parent coordinates
    calculatedNodes.forEach((node) => {
      node.commit.parentHashes.forEach((pHash) => {
        const pIndex = commitIndexMap.get(pHash);
        if (pIndex !== undefined && calculatedNodes[pIndex]) {
          const parentNode = calculatedNodes[pIndex];
          node.parentCoords.push({ x: parentNode.x, y: parentNode.y });
        }
      });
    });

    return { nodes: calculatedNodes, totalLanes: Math.max(1, maxLane + 1) };
  }, [commits]);

  const graphWidth = GRAPH_LEFT_PAD + totalLanes * LANE_WIDTH + 40;
  const graphHeight = Math.max(600, nodes.length * ROW_HEIGHT);

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Zoom controls */}
      <div className="absolute top-3 right-4 z-20 flex items-center gap-1 bg-vscode-sidebar/90 border border-vscode-border rounded-lg p-1 shadow-md backdrop-blur">
        <button
          onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
          className="p-1.5 hover:bg-vscode-hover text-gray-300 rounded"
          title="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-[11px] font-mono px-1 text-gray-400">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
          className="p-1.5 hover:bg-vscode-hover text-gray-300 rounded"
          title="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="p-1.5 hover:bg-vscode-hover text-gray-300 rounded"
          title="Reset zoom"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Interactive Graph Canvas */}
      <div
        className="flex-1 overflow-auto bg-vscode-bg relative select-none"
        style={{ transformOrigin: 'top left' }}
      >
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            minHeight: graphHeight,
          }}
          className="relative min-w-full"
        >
          {/* SVG Connection Edges and Node Circles */}
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            width={graphWidth}
            height={graphHeight}
          >
            {/* Bezier connection lines */}
            {nodes.map((node) =>
              node.parentCoords.map((parent, pIdx) => {
                const color = LANE_COLORS[node.lane % LANE_COLORS.length];
                const deltaY = parent.y - node.y;
                const path =
                  node.x === parent.x
                    ? `M ${node.x} ${node.y} L ${parent.x} ${parent.y}`
                    : `M ${node.x} ${node.y} C ${node.x} ${node.y + deltaY * 0.5}, ${parent.x} ${parent.y - deltaY * 0.5}, ${parent.x} ${parent.y}`;

                return (
                  <path
                    key={`${node.commit.hash}-${pIdx}`}
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeOpacity="0.75"
                  />
                );
              })
            )}

            {/* Commit circles */}
            {nodes.map((node) => {
              const color = LANE_COLORS[node.lane % LANE_COLORS.length];
              const isMerge = node.commit.isMerge;

              return (
                <g key={node.commit.hash}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isMerge ? 5.5 : 4.5}
                    fill={color}
                    stroke="var(--vscode-editor-background, #1e1e1e)"
                    strokeWidth="2"
                  />
                  {isMerge && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={2}
                      fill="var(--vscode-editor-background, #1e1e1e)"
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Commit Rows next to the graph */}
          <div className="absolute top-0" style={{ left: graphWidth, right: 0 }}>
            {nodes.map((node) => (
              <div
                key={node.commit.hash}
                onClick={() => selectCommit(node.commit.hash)}
                style={{ height: ROW_HEIGHT }}
                className="flex items-center justify-between px-3 border-b border-vscode-border/30 hover:bg-vscode-hover/80 transition cursor-pointer group"
              >
                <div className="flex items-center gap-2 overflow-hidden mr-4">
                  <span className="font-mono text-xs text-blue-400 shrink-0 font-semibold">
                    {node.commit.shortHash}
                  </span>

                  {node.commit.branches.slice(0, 2).map((b) => (
                    <span
                      key={b}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono shrink-0"
                    >
                      <GitBranch className="w-2.5 h-2.5" />
                      {b}
                    </span>
                  ))}

                  {node.commit.tags.slice(0, 1).map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono shrink-0"
                    >
                      <TagIcon className="w-2.5 h-2.5" />
                      {t}
                    </span>
                  ))}

                  <span className="text-xs text-gray-200 truncate group-hover:text-blue-300 font-medium">
                    {node.commit.subject}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono text-gray-400 shrink-0">
                  <span className="truncate max-w-[120px] font-sans text-gray-300">
                    {node.commit.author.name}
                  </span>
                  <span className="text-[11px]">
                    {new Date(node.commit.author.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

