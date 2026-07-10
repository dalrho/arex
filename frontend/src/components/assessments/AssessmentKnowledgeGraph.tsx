"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";

type AssessmentKnowledgeGraphProps = {
  active?: boolean;
  className?: string;
  heightClassName?: string;
};

type NodePoint = {
  id: string;
  x: number;
  y: number;
  z: number;
  color: string;
  core?: boolean;
};

type ProjectedPoint = NodePoint & {
  px: number;
  py: number;
  depth: number;
  scale: number;
};

type GraphLink = {
  from: number;
  to: number;
  strength: number;
};

const NODE_COLORS = ["#2563eb", "#22d3ee", "#34d399", "#60a5fa", "#0f766e", "#64748b", "#f59e0b", "#e11d48"];
const ROUTE_NODE_INDEXES = [58, 12, 71, 4, 46, 83, 27, 63];
const SEGMENT_SECONDS = 0.82;
const GRAPH_CYCLE_SECONDS = 7.2;

function createGalaxyNodes(shellCount: number, coreCount: number): NodePoint[] {
  const shellNodes = Array.from({ length: shellCount }, (_, index) => {
    const y = 1 - (index / (shellCount - 1)) * 2;
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = index * Math.PI * (3 - Math.sqrt(5));
    const scatter = 0.72 + ((index * 37) % 28) / 100;

    return {
      id: `assessment-shell-node-${index}`,
      x: Math.cos(theta) * radiusAtY * scatter,
      y: y * (0.82 + ((index * 13) % 16) / 100),
      z: Math.sin(theta) * radiusAtY * scatter,
      color: NODE_COLORS[index % NODE_COLORS.length],
    };
  });

  const coreNodes = Array.from({ length: coreCount }, (_, index) => {
    const theta = index * 2.399963229728653;
    const phi = (((index * 41) % 100) / 100) * Math.PI;
    const radius = 0.18 + ((index * 29) % 58) / 100;

    return {
      id: `assessment-core-node-${index}`,
      x: Math.cos(theta) * Math.sin(phi) * radius,
      y: Math.cos(phi) * radius * 0.92,
      z: Math.sin(theta) * Math.sin(phi) * radius,
      color: NODE_COLORS[(index + 3) % NODE_COLORS.length],
      core: true,
    };
  });

  return [...shellNodes, ...coreNodes];
}

function createGraphLinks(nodes: NodePoint[]): GraphLink[] {
  const links: GraphLink[] = [];

  nodes.forEach((_, index) => {
    const firstTarget = (index + 9 + (index % 5)) % nodes.length;
    const secondTarget = (index + 23 + (index % 7)) % nodes.length;

    if (index % 2 === 0) {
      links.push({ from: index, to: firstTarget, strength: 0.24 });
    }

    if (index % 5 === 0) {
      links.push({ from: index, to: secondTarget, strength: 0.14 });
    }
  });

  return links;
}

const nodes = createGalaxyNodes(72, 18);
const graphLinks = createGraphLinks(nodes);

function rotateAndProjectNodes(width: number, height: number, elapsedSeconds: number) {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.34;
  const yRotation = elapsedSeconds * 0.22;
  const xTilt = -0.28;
  const yCos = Math.cos(yRotation);
  const ySin = Math.sin(yRotation);
  const xCos = Math.cos(xTilt);
  const xSin = Math.sin(xTilt);
  const focalLength = 2.7;

  return nodes.map((node) => {
    const rotatedX = node.x * yCos + node.z * ySin;
    const rotatedZ = -node.x * ySin + node.z * yCos;
    const tiltedY = node.y * xCos - rotatedZ * xSin;
    const tiltedZ = node.y * xSin + rotatedZ * xCos;
    const perspective = focalLength / (focalLength - tiltedZ);
    const depth = (tiltedZ + 1.2) / 2.4;

    return {
      ...node,
      px: centerX + rotatedX * radius * perspective,
      py: centerY + tiltedY * radius * perspective * 0.95,
      depth,
      scale: perspective * (0.7 + Math.max(0, depth) * 0.55),
    };
  });
}

function drawLineGlow(
  context: CanvasRenderingContext2D,
  from: ProjectedPoint,
  to: ProjectedPoint,
  opacity: number,
  width: number,
) {
  const gradient = context.createLinearGradient(from.px, from.py, to.px, to.py);
  gradient.addColorStop(0, `rgba(34, 211, 238, ${opacity})`);
  gradient.addColorStop(0.55, `rgba(103, 232, 249, ${opacity})`);
  gradient.addColorStop(1, `rgba(52, 211, 153, ${opacity})`);

  context.save();
  context.lineCap = "round";
  context.strokeStyle = gradient;
  context.lineWidth = width;
  context.shadowColor = "rgba(34, 211, 238, 0.9)";
  context.shadowBlur = width * 4.8;
  context.beginPath();
  context.moveTo(from.px, from.py);
  context.lineTo(to.px, to.py);
  context.stroke();
  context.restore();
}

function drawNode(context: CanvasRenderingContext2D, node: ProjectedPoint, elapsedSeconds: number, lit: boolean) {
  const pulse = lit ? 0.78 + Math.sin(elapsedSeconds * 4.2 + node.depth * 5) * 0.22 : 0;
  const baseRadius = lit ? 3.5 : node.core ? 2 : 1.65;
  const radius = Math.max(1, baseRadius * node.scale * (lit ? 0.92 + pulse * 0.18 : 0.82));
  const alpha = lit ? 0.96 : 0.14 + Math.max(0, node.depth) * 0.23;

  if (lit) {
    context.save();
    context.fillStyle = `rgba(34, 211, 238, ${0.16 + pulse * 0.18})`;
    context.shadowColor = "rgba(34, 211, 238, 0.85)";
    context.shadowBlur = 24 * node.scale;
    context.beginPath();
    context.arc(node.px, node.py, radius * (3.4 + pulse * 0.55), 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  context.save();
  context.fillStyle = lit ? "#67e8f9" : node.color;
  context.globalAlpha = alpha;
  context.shadowColor = lit ? "rgba(103, 232, 249, 0.9)" : "rgba(34, 211, 238, 0.18)";
  context.shadowBlur = lit ? 16 : 4;
  context.beginPath();
  context.arc(node.px, node.py, radius, 0, Math.PI * 2);
  context.fill();

  if (lit) {
    context.globalAlpha = 0.9;
    context.strokeStyle = "rgba(236, 254, 255, 0.9)";
    context.lineWidth = Math.max(1, 1.2 * node.scale);
    context.stroke();
  }

  context.restore();
}

function drawGraph(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsedSeconds: number,
  active: boolean,
) {
  const projectedNodes = rotateAndProjectNodes(width, height, elapsedSeconds);
  const centerX = width / 2;
  const centerY = height / 2;
  const glowRadius = Math.min(width, height) * 0.48;
  const cycleTime = active ? elapsedSeconds % GRAPH_CYCLE_SECONDS : GRAPH_CYCLE_SECONDS - 0.4;
  const currentSegment = Math.min(ROUTE_NODE_INDEXES.length - 2, Math.floor(cycleTime / SEGMENT_SECONDS));
  const segmentProgress = Math.min(1, Math.max(0, (cycleTime - currentSegment * SEGMENT_SECONDS) / SEGMENT_SECONDS));
  const litRouteNodeCount = Math.min(ROUTE_NODE_INDEXES.length, 1 + Math.floor(cycleTime / SEGMENT_SECONDS));
  const litNodeIndexes = new Set(ROUTE_NODE_INDEXES.slice(0, litRouteNodeCount));

  context.clearRect(0, 0, width, height);

  const backgroundGlow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius);
  backgroundGlow.addColorStop(0, "rgba(14, 165, 233, 0.13)");
  backgroundGlow.addColorStop(0.42, "rgba(15, 23, 42, 0.35)");
  backgroundGlow.addColorStop(1, "rgba(2, 6, 23, 0)");
  context.fillStyle = backgroundGlow;
  context.fillRect(0, 0, width, height);

  graphLinks.forEach((link) => {
    const from = projectedNodes[link.from];
    const to = projectedNodes[link.to];
    const averageDepth = Math.max(0, Math.min(1, (from.depth + to.depth) / 2));

    context.save();
    context.strokeStyle = `rgba(51, 65, 85, ${0.1 + averageDepth * link.strength})`;
    context.lineWidth = 0.7 + averageDepth * 0.7;
    context.beginPath();
    context.moveTo(from.px, from.py);
    context.lineTo(to.px, to.py);
    context.stroke();
    context.restore();
  });

  ROUTE_NODE_INDEXES.slice(1).forEach((nodeIndex, segmentIndex) => {
    const from = projectedNodes[ROUTE_NODE_INDEXES[segmentIndex]];
    const to = projectedNodes[nodeIndex];

    if (segmentIndex < currentSegment) {
      drawLineGlow(context, from, to, 0.36, 2.3);
      return;
    }

    if (segmentIndex === currentSegment) {
      const easedProgress = 1 - Math.pow(1 - segmentProgress, 3);
      const currentPoint = {
        ...to,
        px: from.px + (to.px - from.px) * easedProgress,
        py: from.py + (to.py - from.py) * easedProgress,
      };

      drawLineGlow(context, from, currentPoint, 0.98, 3.6);
    }
  });

  projectedNodes
    .map((node, index) => ({ node, index }))
    .sort((a, b) => a.node.depth - b.node.depth)
    .forEach(({ node, index }) => {
      drawNode(context, node, elapsedSeconds, litNodeIndexes.has(index));
    });
}

export default function AssessmentKnowledgeGraph({
  active = true,
  className,
  heightClassName,
}: AssessmentKnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) {
      return undefined;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return undefined;
    }

    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    const startTime = performance.now();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const render = (timestamp: number) => {
      const elapsedSeconds = reduceMotion ? 5.6 : (timestamp - startTime) / 1000;

      drawGraph(context, width, height, elapsedSeconds, active && !reduceMotion);

      if (!reduceMotion) {
        animationFrame = requestAnimationFrame(render);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      drawGraph(context, width, height, (performance.now() - startTime) / 1000, active && !reduceMotion);
    });

    resize();
    resizeObserver.observe(container);
    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [active]);

  return (
    <div
      ref={containerRef}
      aria-label="Animated 3D assessment sphere showing scattered source nodes lighting after evidence links connect."
      role="img"
      className={clsx("relative w-full overflow-hidden", heightClassName ?? "h-[24rem] md:h-[30rem]", className)}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-x-[14%] bottom-[7%] h-px bg-cyan-300/10 blur-sm" />
    </div>
  );
}
