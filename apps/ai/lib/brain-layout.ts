import { BRAIN_NODE_TYPES, type BrainNode, type BrainNodeType } from "@ecorione/shared-schema";

export type BrainPoint = { x: number; y: number };

export type BrainLayout = {
  width: number;
  height: number;
  positions: Map<string, BrainPoint>;
};

export const BRAIN_CANVAS_MIN_HEIGHT = 640;
export const BRAIN_CANVAS_Y_PADDING = 72;
export const BRAIN_NODE_MIN_CENTER_GAP = 64;
export const BRAIN_CANVAS_X_PADDING = 100;
export const BRAIN_LANE_CENTER_GAP = 190;
export const BRAIN_CANVAS_WIDTH =
  BRAIN_CANVAS_X_PADDING * 2 + BRAIN_LANE_CENTER_GAP * (BRAIN_NODE_TYPES.length - 1);

export function brainLaneX(type: BrainNodeType): number {
  const index = BRAIN_NODE_TYPES.indexOf(type);
  if (index < 0) throw new Error(`Unsupported Brain node type: ${type}`);
  return BRAIN_CANVAS_X_PADDING + BRAIN_LANE_CENTER_GAP * index;
}

export function layoutBrainNodes(nodes: BrainNode[]): BrainLayout {
  const grouped = new Map<BrainNodeType, BrainNode[]>();
  for (const type of BRAIN_NODE_TYPES) {
    grouped.set(
      type,
      nodes.filter((node) => node.type === type),
    );
  }
  const largestLane = Math.max(
    1,
    ...BRAIN_NODE_TYPES.map((type) => grouped.get(type)?.length ?? 0),
  );
  const height = Math.max(
    BRAIN_CANVAS_MIN_HEIGHT,
    BRAIN_CANVAS_Y_PADDING * 2 + Math.max(0, largestLane - 1) * BRAIN_NODE_MIN_CENTER_GAP,
  );
  const positions = new Map<string, BrainPoint>();

  for (const type of BRAIN_NODE_TYPES) {
    const group = grouped.get(type) ?? [];
    if (group.length === 0) continue;
    if (group.length === 1) {
      positions.set(group[0]!.id, { x: brainLaneX(type), y: height / 2 });
      continue;
    }

    const usableHeight = height - BRAIN_CANVAS_Y_PADDING * 2;
    const step = usableHeight / (group.length - 1);
    group.forEach((node, index) => {
      positions.set(node.id, {
        x: brainLaneX(type),
        y: BRAIN_CANVAS_Y_PADDING + step * index,
      });
    });
  }

  return {
    width: BRAIN_CANVAS_WIDTH,
    height,
    positions,
  };
}
