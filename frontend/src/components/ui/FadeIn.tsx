"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import clsx from "clsx";

interface FadeInProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "none";
  /** Animate when the component mounts (page load) instead of on scroll */
  onMount?: boolean;
}

/**
 * Subtle fade-in with optional upward slide. Respects prefers-reduced-motion via motion-safe.
 */
export function FadeIn({
  children,
  className,
  delay = 0,
  direction = "up",
  onMount = false,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (onMount) {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -32px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [onMount]);

  return (
    <div
      ref={ref}
      className={clsx(
        "motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out",
        !visible && "opacity-0",
        !visible && direction === "up" && "translate-y-4",
        !visible && direction === "down" && "-translate-y-3",
        visible && "opacity-100 translate-y-0",
        className,
      )}
      style={{ transitionDelay: `${delay}ms` } satisfies CSSProperties}
    >
      {children}
    </div>
  );
}
