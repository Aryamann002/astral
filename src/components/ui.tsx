"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Card({
  children,
  className,
  glow,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        "glass lumen rounded-[12px] p-4",
        glow && "border-gold/40 shadow-[0_0_28px_rgba(232,197,138,0.12)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn("smallcaps text-gold/80", className)}>{children}</p>;
}

export function Pill({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "gold" | "primary" | "aqua" | "warm";
  className?: string;
}) {
  const tones = {
    default: "bg-white/5 text-muted border-white/10",
    gold: "bg-gold/10 text-gold border-gold/25",
    primary: "bg-primary/12 text-primary border-primary/30",
    aqua: "bg-aqua/10 text-aqua border-aqua/25",
    warm: "bg-fire/10 text-fire border-fire/25",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tabular",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "outline";
  disabled?: boolean;
  className?: string;
}) {
  const variants = {
    primary:
      "bg-primary text-void font-semibold glow-primary hover:bg-primary/90 disabled:bg-white/10 disabled:text-faint disabled:shadow-none",
    outline: "hairline text-ink hover:bg-white/5 disabled:text-faint",
    ghost: "text-muted hover:text-ink hover:bg-white/5",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full px-5 py-3 text-sm transition-colors disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Violet → gold gradient meter used for scores throughout the app. */
export function Meter({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary to-gold transition-[width] duration-700"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="smallcaps mb-2 block text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-[10px] border border-white/10 bg-white/[0.03] px-3.5 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-faint focus:border-primary/60 focus:bg-white/[0.05]";

const TABS = [
  { href: "/chart", label: "Chart", glyph: "◍" },
  { href: "/today", label: "Today", glyph: "☾" },
  { href: "/transits", label: "Transits", glyph: "✧" },
  { href: "/match", label: "Match", glyph: "⚭" },
  { href: "/ask", label: "Ask", glyph: "✦" },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-void/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-[10px] tracking-wide transition-colors",
                active ? "text-primary" : "text-faint hover:text-muted",
              )}
            >
              <span
                className={cn(
                  "text-lg leading-none",
                  active && "drop-shadow-[0_0_8px_rgba(169,155,255,0.6)]",
                )}
              >
                {tab.glyph}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Screen({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn("mx-auto min-h-dvh max-w-lg px-5 pb-28 pt-8", className)}
    >
      {children}
    </main>
  );
}

export function ScreenHeader({
  label,
  title,
  subtitle,
  right,
}: {
  label: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel>{label}</SectionLabel>
        {right}
      </div>
      <h1 className="font-serif text-[28px] leading-tight text-ink">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
    </header>
  );
}

export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card className="text-center">
      <p className="font-serif text-xl text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-xs text-sm text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}
