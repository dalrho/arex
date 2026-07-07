"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";

/** Shared styling for clickable rows inside a dropdown panel. */
export const menuItemClass =
  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50";

export const menuSectionClass =
  "px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400";

interface DropdownProps {
  /** Render prop for the trigger element; call `toggle` on click and mirror `open` in aria-expanded. */
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  /** Panel content. Pass a function to receive a `close` callback for items that should dismiss the menu. */
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: "left" | "right";
  direction?: "down" | "up";
  panelClassName?: string;
  className?: string;
}

/**
 * Lightweight dropdown/popover. Closes on outside click and Escape.
 * Used for header menus (notifications, help, account) and toolbar filter panels.
 */
export default function Dropdown({
  trigger,
  children,
  align = "right",
  direction = "down",
  panelClassName,
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        close();
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <div ref={containerRef} className={clsx("relative", className)}>
      {trigger({ open, toggle })}
      {open && (
        <div
          role="menu"
          className={clsx(
            "absolute z-30 min-w-[220px] rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-950/10",
            align === "right" ? "right-0" : "left-0",
            direction === "down" ? "top-full mt-2" : "bottom-full mb-2",
            panelClassName
          )}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </div>
  );
}
