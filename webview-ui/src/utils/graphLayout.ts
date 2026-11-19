import { GitCommit } from '../types';

export const LANE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
];

export interface GraphNode {
  commit: GitCommit;
  lane: number;
  x: number;
  y: number;
  parentCoords: { x: number; y: number }[];
}

export interface GraphLayout {
  nodes: GraphNode[];
  totalLanes: number;
}

/**
 * Place each commit (newest first) in a lane, so a branch keeps its lane and a
 * merge's other parents open new ones. Edges join each commit to its parents.
 */
export function layoutGraph(
  commits: GitCommit[],
  geometry: { rowHeight: number; laneWidth: number; leftPad: number }
): GraphLayout {
  const { rowHeight, laneWidth, leftPad } = geometry;
  const commitIndexMap = new Map<string, number>();
  commits.forEach((c, idx) => commitIndexMap.set(c.hash, idx));

  const activeLanes: (string | null)[] = [];
  const nodes: GraphNode[] = [];
  let maxLane = 0;

  const freeLane = () => {
    let lane = activeLanes.indexOf(null);
    if (lane === -1) {
      lane = activeLanes.length;
      activeLanes.push(null);
    }
    return lane;
  };

  commits.forEach((commit, rowIndex) => {
    let lane = activeLanes.indexOf(commit.hash);
    if (lane === -1) lane = freeLane();
    maxLane = Math.max(maxLane, lane);

    const primaryParent = commit.parentHashes[0];
    activeLanes[lane] = primaryParent && commitIndexMap.has(primaryParent) ? primaryParent : null;

    for (const parent of commit.parentHashes.slice(1)) {
      if (!commitIndexMap.has(parent)) continue;
      let parentLane = activeLanes.indexOf(parent);
      if (parentLane === -1) parentLane = freeLane();
      activeLanes[parentLane] = parent;
      maxLane = Math.max(maxLane, parentLane);
    }

    nodes.push({
      commit,
      lane,
      x: leftPad + lane * laneWidth,
      y: rowIndex * rowHeight + rowHeight / 2,
      parentCoords: [],
    });
  });

  for (const node of nodes) {
    for (const parent of node.commit.parentHashes) {
      const index = commitIndexMap.get(parent);
      if (index !== undefined) node.parentCoords.push({ x: nodes[index].x, y: nodes[index].y });
    }
  }

  return { nodes, totalLanes: Math.max(1, maxLane + 1) };
}

/** An SVG path from a commit down to one of its parents. */
export function edgePath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  if (from.x === to.x) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  const deltaY = to.y - from.y;
  return `M ${from.x} ${from.y} C ${from.x} ${from.y + deltaY * 0.5}, ${to.x} ${to.y - deltaY * 0.5}, ${to.x} ${to.y}`;
}
