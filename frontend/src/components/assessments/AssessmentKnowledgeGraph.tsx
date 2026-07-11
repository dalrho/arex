"use client";

import { useEffect, useRef, useMemo } from "react";
import clsx from "clsx";

type AssessmentKnowledgeGraphProps = {
  active?: boolean;
  className?: string;
  heightClassName?: string;
  allDocuments?: { id: string; filename: string }[];
  affectedDocuments?: { id: string; filename: string }[];
  regulationTitle?: string;
  onProgress?: (count: number) => void;
};

type NodePoint = {
  id: string;
  x: number;
  y: number;
  z: number;
  color: string;
  core?: boolean;
  isDoc?: boolean;
};

type PhysicsNode = NodePoint & {
  cx: number;
  cy: number;
  cz: number;
  vx: number;
  vy: number;
  vz: number;
};

type ProjectedPoint = PhysicsNode & {
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
const SEGMENT_SECONDS = 1.4; // Time in seconds for scanner beam to travel between nodes (fast responsive trace)

function generateDynamicGraph(
  allDocuments: { id: string; filename: string }[],
  affectedDocuments: { id: string; filename: string }[]
) {
  const nodes: NodePoint[] = [];
  const routeNodeIndexes: number[] = [];

  // 1. Central core node representing the regulation (FDA regulation)
  const centerNode: NodePoint = {
    id: "center-regulation",
    x: 0,
    y: 0,
    z: 0,
    color: "#22d3ee", // cyan
    core: true,
  };
  nodes.push(centerNode);
  const centerIndex = 0;
  routeNodeIndexes.push(centerIndex);

  // Identify affected document IDs
  const affectedIds = new Set((affectedDocuments.length > 0 ? affectedDocuments : allDocuments).map((d) => d.id));

  // 2. Document nodes distributed on an outer shell representing ALL files on the website
  const numDocs = allDocuments.length;
  
  for (let i = 0; i < numDocs; i++) {
    const doc = allDocuments[i];
    const theta = (i / numDocs) * Math.PI * 2;
    const phi = Math.PI / 3 + (i % 2) * (Math.PI / 6); // tilt angle
    const radius = 0.76;

    const docNode: NodePoint = {
      id: `doc-${doc.id}`,
      x: Math.cos(theta) * Math.sin(phi) * radius,
      y: Math.cos(phi) * radius * 0.85,
      z: Math.sin(theta) * Math.sin(phi) * radius,
      color: NODE_COLORS[i % NODE_COLORS.length],
      isDoc: true,
    };
    nodes.push(docNode);
    const docIndex = nodes.length - 1;

    // If this file is affected, include it in the active tracing scanning route!
    if (affectedIds.has(doc.id)) {
      routeNodeIndexes.push(docIndex);
    }
  }

  // 3. Add ambient faint nodes for 3D depth
  const bgCount = 15;
  for (let i = 0; i < bgCount; i++) {
    const y = 1 - (i / (bgCount - 1)) * 2;
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * Math.PI * (3 - Math.sqrt(5));
    const scatter = 0.65 + ((i * 37) % 30) / 100;

    nodes.push({
      id: `bg-node-${i}`,
      x: Math.cos(theta) * radiusAtY * scatter,
      y: y * (0.8 + ((i * 13) % 18) / 100),
      z: Math.sin(theta) * radiusAtY * scatter,
      color: "#475569", // dim slate gray for ambient depth
    });
  }

  // Create links between ambient/depth nodes
  const links: GraphLink[] = [];
  nodes.forEach((_, index) => {
    if (index === centerIndex || index <= numDocs) return;
    const firstTarget = (index + 3) % nodes.length;
    if (firstTarget > numDocs) {
      links.push({ from: index, to: firstTarget, strength: 0.08 });
    }
  });

  return { nodes, links, routeNodeIndexes };
}

function updateForceDirectedSimulation(nodes: PhysicsNode[], links: GraphLink[], dt: number) {
  // 1. Repulsion force between all nodes (Charge force)
  const kRepel = 0.015;
  for (let i = 0; i < nodes.length; i++) {
    const n1 = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const n2 = nodes[j];
      const dx = n1.cx - n2.cx;
      const dy = n1.cy - n2.cy;
      const dz = n1.cz - n2.cz;
      const MathDistSq = dx * dx + dy * dy + dz * dz + 0.05;
      const dist = Math.sqrt(MathDistSq);

      const force = kRepel / MathDistSq;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const fz = (dz / dist) * force;

      if (!n1.core) {
        n1.vx += fx * dt;
        n1.vy += fy * dt;
        n1.vz += fz * dt;
      }
      if (!n2.core) {
        n2.vx -= fx * dt;
        n2.vy -= fy * dt;
        n2.vz -= fz * dt;
      }
    }
  }

  // 2. Attraction force between background linked nodes
  const kLink = 0.18;
  const targetLength = 0.5;
  links.forEach((link) => {
    const n1 = nodes[link.from];
    const n2 = nodes[link.to];
    const dx = n2.cx - n1.cx;
    const dy = n2.cy - n1.cy;
    const dz = n2.cz - n1.cz;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;

    const force = kLink * (dist - targetLength);
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    const fz = (dz / dist) * force;

    if (!n1.core) {
      n1.vx += fx * dt;
      n1.vy += fy * dt;
      n1.vz += fz * dt;
    }
    if (!n2.core) {
      n2.vx -= fx * dt;
      n2.vy -= fy * dt;
      n2.vz -= fz * dt;
    }
  });

  // 3. Gravity pulling outer nodes gently back to center
  const kGravity = 0.04;
  nodes.forEach((node) => {
    if (node.core) return;
    node.vx -= node.cx * kGravity * dt;
    node.vy -= node.cy * kGravity * dt;
    node.vz -= node.cz * kGravity * dt;
  });

  // 4. Update coordinates & apply damping
  const damping = 0.95;
  nodes.forEach((node) => {
    if (node.core) {
      node.cx = 0;
      node.cy = 0;
      node.cz = 0;
      return;
    }
    node.cx += node.vx * dt;
    node.cy += node.vy * dt;
    node.cz += node.vz * dt;

    node.vx *= damping;
    node.vy *= damping;
    node.vz *= damping;
  });
}

function rotateAndProjectNodes(nodes: PhysicsNode[], width: number, height: number, elapsedSeconds: number) {
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
    // Project and rotate using current simulation coordinates
    const rotatedX = node.cx * yCos + node.cz * ySin;
    const rotatedZ = -node.cx * ySin + node.cz * yCos;
    const tiltedY = node.cy * xCos - rotatedZ * xSin;
    const tiltedZ = node.cy * xSin + rotatedZ * xCos;
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
  context.shadowColor = "rgba(34, 211, 238, 1.0)";
  context.shadowBlur = width * 6.5;
  context.beginPath();
  context.moveTo(from.px, from.py);
  context.lineTo(to.px, to.py);
  context.stroke();
  context.restore();
}

function drawFlowingParticles(
  context: CanvasRenderingContext2D,
  from: ProjectedPoint,
  to: ProjectedPoint,
  elapsedSeconds: number,
) {
  const particleCount = 2;
  context.save();

  for (let i = 0; i < particleCount; i++) {
    const offset = i / particleCount;
    const speed = 0.35;
    const progress = ((elapsedSeconds * speed) + offset) % 1.0;

    const px = from.px + (to.px - from.px) * progress;
    const py = from.py + (to.py - from.py) * progress;

    const averageDepth = (from.depth + to.depth) / 2;
    const size = Math.max(1.5, 3.2 * averageDepth * (1 + progress * 0.4));

    context.fillStyle = `rgba(34, 211, 238, ${0.85 * (1 - progress)})`;
    context.shadowColor = "rgba(34, 211, 238, 0.95)";
    context.shadowBlur = size * 3.5;

    context.beginPath();
    context.arc(px, py, size, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawNode(
  context: CanvasRenderingContext2D,
  node: ProjectedPoint,
  elapsedSeconds: number,
  lit: boolean,
) {
  const pulse = lit ? 0.78 + Math.sin(elapsedSeconds * 4.2 + node.depth * 5) * 0.22 : 0;
  const baseRadius = lit ? 3.5 : node.core ? 2.5 : 1.65;
  const radius = Math.max(1, baseRadius * node.scale * (lit ? 0.92 + pulse * 0.18 : 0.82));
  const alpha = lit ? 0.96 : 0.14 + Math.max(0, node.depth) * 0.23;

  if (lit) {
    // 1. Concentric ring pulse ripple effect (expanding and fading sonar rings)
    context.save();
    const ringSpeed = 1.6;
    const ringCount = 2;
    for (let i = 0; i < ringCount; i++) {
      const progress = ((elapsedSeconds * ringSpeed) + (i / ringCount)) % 1.0;
      const ringRadius = radius * (1.2 + progress * 3.2);
      const ringOpacity = 0.72 * (1 - progress);

      context.strokeStyle = `rgba(34, 211, 238, ${ringOpacity})`;
      context.lineWidth = Math.max(0.8, 1.4 * node.scale * (1 - progress));
      context.shadowColor = "rgba(34, 211, 238, 0.75)";
      context.shadowBlur = 8 * node.scale;

      context.beginPath();
      context.arc(node.px, node.py, ringRadius, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();

    // 2. Soft background radial glow
    context.save();
    context.fillStyle = `rgba(34, 211, 238, ${0.16 + pulse * 0.18})`;
    context.shadowColor = "rgba(34, 211, 238, 0.85)";
    context.shadowBlur = 24 * node.scale;
    context.beginPath();
    context.arc(node.px, node.py, radius * (3.4 + pulse * 0.55), 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  // 3. Core node circle
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
  nodes: PhysicsNode[],
  graphLinks: GraphLink[],
  routeNodeIndexes: number[]
) {
  if (!nodes || nodes.length === 0) return;
  const projectedNodes = rotateAndProjectNodes(nodes, width, height, elapsedSeconds);
  const centerX = width / 2;
  const centerY = height / 2;
  const glowRadius = Math.min(width, height) * 0.48;

  const cycleSeconds = routeNodeIndexes.length * SEGMENT_SECONDS;
  const cycleTime = active ? elapsedSeconds % cycleSeconds : cycleSeconds - 0.4;
  const currentSegment = Math.min(routeNodeIndexes.length - 2, Math.floor(cycleTime / SEGMENT_SECONDS));
  const segmentProgress = Math.min(1, Math.max(0, (cycleTime - currentSegment * SEGMENT_SECONDS) / SEGMENT_SECONDS));
  const litRouteNodeCount = Math.min(routeNodeIndexes.length, 1 + Math.floor(cycleTime / SEGMENT_SECONDS));
  const litNodeIndexes = new Set(routeNodeIndexes.slice(0, litRouteNodeCount));

  context.clearRect(0, 0, width, height);

  const backgroundGlow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius);
  backgroundGlow.addColorStop(0, "rgba(14, 165, 233, 0.13)");
  backgroundGlow.addColorStop(0.42, "rgba(15, 23, 42, 0.35)");
  backgroundGlow.addColorStop(1, "rgba(2, 6, 23, 0)");
  context.fillStyle = backgroundGlow;
  context.fillRect(0, 0, width, height);

  // 1. Draw background connecting lines (faint constellation)
  const linePulse = 0.85 + Math.sin(elapsedSeconds * 2.2) * 0.15;
  graphLinks.forEach((link) => {
    const from = projectedNodes[link.from];
    const to = projectedNodes[link.to];
    if (!from || !to) return;
    const averageDepth = Math.max(0, Math.min(1, (from.depth + to.depth) / 2));

    context.save();
    context.strokeStyle = `rgba(51, 65, 85, ${0.04 + averageDepth * link.strength * linePulse * 0.4})`;
    context.lineWidth = 0.5 + averageDepth * 0.5;
    context.beginPath();
    context.moveTo(from.px, from.py);
    context.lineTo(to.px, to.py);
    context.stroke();
    context.restore();
  });

  // 2. Draw active connecting lines as they travel from node to node
  routeNodeIndexes.slice(1).forEach((nodeIndex, segmentIndex) => {
    const from = projectedNodes[routeNodeIndexes[segmentIndex]];
    const to = projectedNodes[nodeIndex];
    if (!from || !to) return;

    if (segmentIndex < currentSegment) {
      // Completed connection
      drawLineGlow(context, from, to, 0.78, 3.8);
      drawFlowingParticles(context, from, to, elapsedSeconds);
      return;
    }

    if (segmentIndex === currentSegment) {
      // Traveling right now
      const easedProgress = 1 - Math.pow(1 - segmentProgress, 3);
      const currentPoint = {
        ...to,
        px: from.px + (to.px - from.px) * easedProgress,
        py: from.py + (to.py - from.py) * easedProgress,
      };

      drawLineGlow(context, from, currentPoint, 1.0, 5.0);

      // Draw traveling head pulse
      context.save();
      context.fillStyle = "#ffffff";
      context.shadowColor = "rgba(103, 232, 249, 1.0)";
      context.shadowBlur = 30;
      context.beginPath();
      context.arc(currentPoint.px, currentPoint.py, 7.5, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  });

  // 3. Draw nodes (Sorted by depth for correct 3D occlusion)
  projectedNodes
    .map((node, index) => ({ node, index }))
    .sort((a, b) => a.node.depth - b.node.depth)
    .forEach(({ node, index }) => {
      const isLit = litNodeIndexes.has(index);
      drawNode(context, node, elapsedSeconds, isLit);
    });
}

export default function AssessmentKnowledgeGraph({
  active = true,
  className,
  heightClassName,
  allDocuments = [],
  affectedDocuments = [],
  onProgress,
}: AssessmentKnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastReportedCountRef = useRef(-1);

  // Initialize nodes and links configurations based on all system files and affected files
  const { nodes: staticNodes, links: graphLinks, routeNodeIndexes } = useMemo(() => {
    const resolvedAllDocs = allDocuments.length > 0 ? allDocuments : [
      { id: "sop101", filename: "SOP-101.txt" },
      { id: "sop102", filename: "SOP-102.txt" },
      { id: "sop103", filename: "SOP-103.txt" },
      { id: "sop104", filename: "SOP-104.txt" },
    ];
    return generateDynamicGraph(resolvedAllDocs, affectedDocuments);
  }, [allDocuments, affectedDocuments]);

  // Keep a mutable reference of simulated physics nodes
  const physicsNodesRef = useRef<PhysicsNode[]>([]);

  // Initialize/reset physics simulation node positions and velocities
  useEffect(() => {
    physicsNodesRef.current = staticNodes.map((node) => {
      const isCenter = node.core;
      // Spread starting coordinates randomly
      const radius = isCenter ? 0 : 0.4 + Math.random() * 0.45;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      return {
        ...node,
        cx: isCenter ? 0 : Math.cos(theta) * Math.sin(phi) * radius,
        cy: isCenter ? 0 : Math.sin(theta) * Math.sin(phi) * radius,
        cz: isCenter ? 0 : Math.cos(phi) * radius,
        vx: 0,
        vy: 0,
        vz: 0,
      };
    });
  }, [staticNodes]);

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

    let lastTime = performance.now();
    const startTime = performance.now();
    const reduceMotion = false; // Always animate, bypassing OS preferences for this loading screen

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
      const dt = Math.min(0.03, (timestamp - lastTime) / 1000); // Caps delta time at 30ms to prevent jumps
      lastTime = timestamp;

      // Run force-directed simulation step
      if (physicsNodesRef.current.length > 0 && !reduceMotion) {
        updateForceDirectedSimulation(physicsNodesRef.current, graphLinks, dt);
      }

      const elapsedSeconds = reduceMotion ? 5.6 : (timestamp - startTime) / 1000;
      const cycleSeconds = routeNodeIndexes.length * SEGMENT_SECONDS;
      const cycleTime = active && !reduceMotion ? elapsedSeconds % cycleSeconds : cycleSeconds - 0.4;
      const litRouteNodeCount = Math.min(routeNodeIndexes.length, 1 + Math.floor(cycleTime / SEGMENT_SECONDS));
      const currentAffectedCount = Math.max(0, litRouteNodeCount - 1);

      // Report current count back to loading panel
      if (onProgress && currentAffectedCount !== lastReportedCountRef.current) {
        lastReportedCountRef.current = currentAffectedCount;
        setTimeout(() => onProgress(currentAffectedCount), 0);
      }

      drawGraph(
        context,
        width,
        height,
        elapsedSeconds,
        active && !reduceMotion,
        physicsNodesRef.current,
        graphLinks,
        routeNodeIndexes
      );

      if (!reduceMotion) {
        animationFrame = requestAnimationFrame(render);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      drawGraph(
        context,
        width,
        height,
        (performance.now() - startTime) / 1000,
        active && !reduceMotion,
        physicsNodesRef.current,
        graphLinks,
        routeNodeIndexes
      );
    });

    resize();
    resizeObserver.observe(container);
    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [active, graphLinks, routeNodeIndexes, onProgress]);

  return (
    <div
      ref={containerRef}
      aria-label="Animated 3D assessment sphere showing compliance analysis links connecting regulation and SOP files."
      role="img"
      className={clsx("relative w-full overflow-hidden", heightClassName ?? "h-[24rem] md:h-[30rem]", className)}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-x-[14%] bottom-[7%] h-px bg-cyan-300/10 blur-sm" />
    </div>
  );
}
