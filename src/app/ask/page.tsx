"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, Pill, SectionLabel, TabBar } from "@/components/ui";
import { RequireChart } from "@/components/RequireChart";
import { chartSummary, type Chart } from "@/lib/astro/chart";
import { localAstrologer } from "@/lib/astro/localAstrologer";
import {
  buildPromptPack,
  HANDOFFS,
  type HandoffTarget,
  type PromptScope,
} from "@/lib/astro/promptPack";
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

interface Turn {
  id: string;
  question: string;
  answer: string;
}

function AskView({ chart }: { chart: Chart }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // The same factual block the offline reader quotes from. Computed once.
  const context = useMemo(() => chartSummary(chart), [chart]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns]);

  // Reading is synchronous and local — no request, no spinner, no failure mode.
  const send = (text: string) => {
    const question = text.trim();
    if (!question) return;
    setTurns((prev) => [
      ...prev,
      {
        id: `t${prev.length}-${Date.now()}`,
        question,
        answer: localAstrologer(question, context),
      },
    ]);
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
          {turns.length === 0 && (
            <Card>
              <p className="font-serif text-lg">Ask about your chart.</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                I read your chart here on your device — no account, no key,
                nothing sent anywhere. The answers are exact but narrow.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                For a fuller reading, every answer comes with a prompt you can
                hand to ChatGPT, Claude, Gemini or anything else. Your birth
                data only travels if you choose to paste it.
              </p>
            </Card>
          )}

          {turns.map((turn, index) => (
            <div key={turn.id} className="space-y-4">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary/18 px-4 py-2.5 text-[14px] leading-relaxed text-ink">
                  {turn.question}
                </div>
              </div>

              <div className="flex justify-start">
                <div className="glass max-w-[92%] rounded-2xl rounded-bl-sm border-l-2 border-l-primary/60 px-4 py-3">
                  <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink/90">
                    {turn.answer}
                  </p>
                </div>
              </div>

              {/* Only under the newest answer: repeating it every turn buries
                  the thread in controls. */}
              {index === turns.length - 1 && (
                <Handoff chart={chart} question={turn.question} />
              )}
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 border-t border-white/8 bg-void/85 pb-[calc(env(safe-area-inset-bottom)+72px)] backdrop-blur-xl">
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-3">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => send(suggestion)}
                className="shrink-0"
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
              disabled={!input.trim()}
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors",
                !input.trim()
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

/** The take-it-elsewhere panel: build a prompt, copy it, hand it to a model. */
function Handoff({ chart, question }: { chart: Chart; question: string }) {
  const [scope, setScope] = useState<PromptScope>("relevant");
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const pack = useMemo(
    () => buildPromptPack(chart, question, scope),
    [chart, question, scope],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pack.text);
      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused outright; the textarea below is the
      // way out, so point at it rather than failing silently.
      setCopyFailed(true);
    }
  };

  const openTarget = (target: HandoffTarget) => {
    // Opened synchronously. Awaiting the clipboard write first would break the
    // user-gesture chain and popup blockers would swallow the tab.
    window.open(target.href(pack.text), "_blank", "noopener,noreferrer");
    void copy();
  };

  const chooseScope = (next: PromptScope) => {
    setScope(next);
    setCopied(false);
    setCopyFailed(false);
  };

  return (
    <Card className="border-gold/20">
      <SectionLabel>Take it to a bigger model</SectionLabel>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        {pack.topic
          ? `Scoped to ${pack.topic.label}: the placements that actually govern the question, plus your big three.`
          : "Nothing matched a specific topic, so this carries your core placements. Send the full chart if you want everything."}
      </p>

      <div className="mt-3 flex gap-1.5">
        {(
          [
            ["relevant", "Just this question"],
            ["full", "Full chart"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => chooseScope(value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
              scope === value
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-white/10 bg-white/5 text-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Pill tone="default">
          {pack.included.length} placements · {pack.chars.toLocaleString()} chars
        </Pill>
      </div>

      <button
        onClick={copy}
        className={cn(
          "mt-3 w-full rounded-full px-4 py-2.5 text-sm font-semibold transition-colors",
          copied
            ? "bg-aqua/20 text-aqua"
            : "glow-primary bg-primary text-void hover:bg-primary/90",
        )}
      >
        {copied ? "Copied ✓" : "Copy prompt"}
      </button>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {HANDOFFS.map((target) => (
          <button
            key={target.id}
            onClick={() => openTarget(target)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-ink"
            title={
              target.prefills
                ? `Copy and open ${target.name} with the prompt filled in`
                : `Copy and open ${target.name} — paste it there, it has no prefill`
            }
          >
            Copy &amp; open {target.name}
            {target.prefills ? "" : " ↗"}
          </button>
        ))}
      </div>

      {copyFailed && (
        <p className="mt-2 text-[11px] text-fire/90">
          Your browser refused clipboard access — open the prompt below and copy
          it by hand.
        </p>
      )}

      <details className="group mt-3">
        <summary className="cursor-pointer list-none text-[11px] text-faint hover:text-muted">
          See exactly what gets shared ▾
        </summary>
        <textarea
          readOnly
          value={pack.text}
          onFocus={(event) => event.currentTarget.select()}
          rows={10}
          className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-void-2/60 p-3 font-mono text-[11px] leading-relaxed text-muted outline-none focus:border-primary/40"
        />
      </details>
    </Card>
  );
}
