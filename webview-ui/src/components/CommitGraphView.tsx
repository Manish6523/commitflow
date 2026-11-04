import React, { useMemo, useState } from 'react';
import { GitCommit } from '../types';
import { useCommitStore } from '../stores/useCommitStore';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { timeAgo } from '../utils/fileHistory';
import { CommitActions, RefBadges } from './CommitBits';
import { iconButton } from './ui/styles';

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

const ROW_HEIGHT = 32;
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

  const graphWidth = GRAPH_LEFT_PAD + totalLanes * LANE_WIDTH;
  const graphHeight = Math.max(600, nodes.length * ROW_HEIGHT);

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      <div className="flex items-center justify-between gap-2 px-3 py-1 border-b border-vscode-border bg-vscode-sidebar/60 shrink-0">
        <span className="text-[11px] text-gray-400">
          {nodes.length} commits · {totalLanes} {totalLanes === 1 ? 'lane' : 'lanes'}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
            className={iconButton}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono tabular-nums px-1 text-gray-400">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
            className={iconButton}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setZoom(1)} className={iconButton} title="Reset zoom" aria-label="Reset zoom">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
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
                className="group relative flex items-center gap-3 px-3 cursor-pointer hover:bg-vscode-hover transition-colors duration-100"
              >
                <span className="flex-1 min-w-0 flex items-center gap-1.5 text-xs">
                  <span className="truncate font-medium text-gray-200" title={node.commit.subject}>
                    {node.commit.subject}
                  </span>
                  <RefBadges commit={node.commit} />
                </span>
                <span className="text-[11px] text-gray-400 truncate shrink-0 max-w-[40%]">
                  <span className="font-mono">{node.commit.shortHash}</span> · {node.commit.author.name} ·{' '}
                  {timeAgo(node.commit.author.timestamp)}
                </span>
                <CommitActions commit={node.commit} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

