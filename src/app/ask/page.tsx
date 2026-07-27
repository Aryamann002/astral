"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Card, Pill, TabBar } from "@/components/ui";
import { RequireChart } from "@/components/RequireChart";
import { chartSummary, type Chart } from "@/lib/astro/chart";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "What should I know about my chart?",
  "Why am I so restless?",
  "What does my chart say about work?",
  "Tell me about my Saturn return",
  "How do I actually love people?",
];

export default function AskPage() {
  return <RequireChart>{(chart) => <AskView chart={chart} />}</RequireChart>;
}

function AskView({ chart }: { chart: Chart }) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // The chart is serialised once and sent with every turn, so the model always
  // has the full set of placements rather than a summary of a summary.
  const chartContext = useMemo(() => chartSummary(chart), [chart]);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { chartContext },
    }),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const busy = status === "submitted" || status === "streaming";

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  };

  const sun = chart.byId.sun;
  const moon = chart.byId.moon;

  return (
    <>
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/8 bg-void/80 px-5 py-4 backdrop-blur-xl">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary shadow-[0_0_18px_rgba(169,155,255,0.35)]">
            ✦
          </span>
          <div className="min-w-0">
            <p className="font-serif text-lg leading-none">Astral</p>
            <p className="mt-1 truncate text-[11px] text-faint">
              reading {sun.sign.glyph} {sun.sign.name} sun · {moon.sign.glyph}{" "}
              {moon.sign.name} moon
            </p>
          </div>
        </header>

        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto px-5 py-6"
        >
          {messages.length === 0 && (
            <Card>
              <p className="font-serif text-lg">Ask about your chart.</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                I have your full chart in front of me — every placement, house
                and aspect. Ask something specific and I&apos;ll tell you which
                part of it I&apos;m reading from.
              </p>
            </Card>
          )}

          {messages.map((message) => {
            const text = message.parts
              .filter(
                (p): p is { type: "text"; text: string } => p.type === "text",
              )
              .map((p) => p.text)
              .join("");
            if (!text) return null;

            return message.role === "user" ? (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary/18 px-4 py-2.5 text-[14px] leading-relaxed text-ink">
                  {text}
                </div>
              </div>
            ) : (
              <div key={message.id} className="flex justify-start">
                <div className="glass max-w-[92%] rounded-2xl rounded-bl-sm border-l-2 border-l-primary/60 px-4 py-3">
                  <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink/90">
                    {text}
                  </p>
                </div>
              </div>
            );
          })}

          {busy && messages[messages.length - 1]?.role === "user" && (
            <Thinking />
          )}

          {error && (
            <Card className="border-fire/25 bg-fire/[0.06]">
              <p className="text-xs text-fire/90">
                Something went wrong reaching the astrologer. Try again in a
                moment.
              </p>
            </Card>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-white/8 bg-void/85 pb-[calc(env(safe-area-inset-bottom)+72px)] backdrop-blur-xl">
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-3">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => send(suggestion)}
                disabled={busy}
                className="shrink-0 disabled:opacity-40"
              >
                <Pill tone="primary">{suggestion}</Pill>
              </button>
            ))}
          </div>

          <form
            className="flex items-center gap-2 px-5 pb-3"
            onSubmit={(event) => {
              event.preventDefault();
              send(input);
            }}
          >
            <div className="glass flex flex-1 items-center gap-2 rounded-full px-4 py-2.5">
              <span className="text-gold/70">✦</span>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about your chart…"
                className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors",
                busy || !input.trim()
                  ? "bg-white/8 text-faint"
                  : "glow-primary bg-primary text-void",
              )}
              aria-label="Send"
            >
              ↑
            </button>
          </form>
        </div>
      </div>
      <TabBar />
    </>
  );
}

function Thinking() {
  return (
    <div className="flex justify-start">
      <div className="glass flex items-center gap-1.5 rounded-2xl rounded-bl-sm px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70"
            style={{ animationDelay: `${i * 0.16}s`, animationDuration: "1s" }}
          />
        ))}
      </div>
    </div>
  );
}
