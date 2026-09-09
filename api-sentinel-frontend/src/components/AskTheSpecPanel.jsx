import { useState, useRef, useEffect } from "react";
import { MessagesSquare, Bookmark, RotateCcw, Send } from "lucide-react";
import { askSpec } from "../services/api";
import { getErrorMessage } from "../services/apiErrors";
import { cn } from "../lib/utils";

const SUGGESTED_PROMPTS = [
  "What should I fix first and why?",
  "Which routes can leak another user's data?",
  "Summarise this scan.",
];

const ROUTE_REGEX = /\b(GET|POST|PUT|PATCH|DELETE)\s+\/[a-zA-Z0-9_{}/-]+/g;

function extractRoutes(text) {
  const matches = text.match(ROUTE_REGEX) || [];
  return [...new Set(matches)];
}

function renderInline(text, keyPrefix) {
  const segments = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return segments.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={`${keyPrefix}-${i}`}
          className="rounded-md bg-white border border-blue-100 px-1.5 py-0.5 text-xs font-mono text-blue-700"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

function renderContent(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let bulletBuffer = [];
  let numberBuffer = [];

  const flushBullets = () => {
    if (!bulletBuffer.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-1.5 space-y-1 pl-4">
        {bulletBuffer.map((item, i) => (
          <li key={i} className="relative pl-3 before:absolute before:left-0 before:top-[0.55em] before:h-1 before:w-1 before:rounded-full before:bg-blue-300">
            {renderInline(item, `b-${blocks.length}-${i}`)}
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  const flushNumbers = () => {
    if (!numberBuffer.length) return;
    blocks.push(
      <ol key={`ol-${blocks.length}`} className="my-1.5 space-y-1.5 pl-4 list-decimal marker:font-semibold marker:text-blue-500">
        {numberBuffer.map((item, i) => (
          <li key={i} className="pl-1 font-medium text-slate-800">
            {renderInline(item, `n-${blocks.length}-${i}`)}
          </li>
        ))}
      </ol>
    );
    numberBuffer = [];
  };

  const flushAll = () => {
    flushBullets();
    flushNumbers();
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (line === "") return; // blank lines just create spacing between blocks

    if (/^-{3,}$/.test(line)) {
      flushAll();
      blocks.push(<hr key={`hr-${blocks.length}`} className="my-2.5 border-sky-100" />);
      return;
    }

    const h4 = line.match(/^####\s+(.*)/);
    if (h4) {
      flushAll();
      blocks.push(
        <p key={`h4-${blocks.length}`} className="mt-2.5 text-[13px] font-semibold uppercase tracking-wide text-blue-600">
          {renderInline(h4[1], `h4-${blocks.length}`)}
        </p>
      );
      return;
    }

    const h3 = line.match(/^###\s+(.*)/);
    if (h3) {
      flushAll();
      blocks.push(
        <p key={`h3-${blocks.length}`} className="mt-3 text-sm font-semibold text-slate-900">
          {renderInline(h3[1], `h3-${blocks.length}`)}
        </p>
      );
      return;
    }

    const bullet = line.match(/^[*-]\s+(.*)/);
    if (bullet) {
      flushNumbers();
      bulletBuffer.push(bullet[1]);
      return;
    }

    const numbered = line.match(/^\d+[.)]\s+(.*)/);
    if (numbered) {
      flushBullets();
      numberBuffer.push(numbered[1]);
      return;
    }

    flushAll();
    blocks.push(
      <p key={`p-${blocks.length}`} className="leading-relaxed">
        {renderInline(line, `p-${blocks.length}`)}
      </p>
    );
  });

  flushAll();
  return blocks;
}

export default function AskTheSpecPanel({ projectId, scanName = "this report" }) {
  const storageKey = `ask-the-spec:${projectId ?? "default"}`;

  const [messages, setMessages] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return saved?.messages ?? [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedAt, setSavedAt] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return saved?.savedAt ? new Date(saved.savedAt) : null;
    } catch {
      return null;
    }
  });
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const send = async (text) => {
    const message = text ?? input;
    if (!message.trim()) return;

    const next = [...messages, { role: "user", content: message }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { reply } = await askSpec(projectId, message, next);
      setMessages((prev) => [...prev, { role: "assistant", content: reply, routes: extractRoutes(reply) }]);
    } catch (err) {
      // Keep the real error in the console so the network tab / server response
      // is easy to check instead of guessing from the generic bubble text.
      console.error("askSpec failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: getErrorMessage(err, "Something went wrong reaching the assistant."),
          routes: [],
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    const now = new Date();
    try {
      localStorage.setItem(storageKey, JSON.stringify({ messages, savedAt: now.toISOString() }));
      setSavedAt(now);
    } catch (err) {
      console.error("Failed to save chat:", err);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setSavedAt(null);
    try {
      localStorage.removeItem(storageKey);
    } catch (err) {
      console.error("Failed to clear saved chat:", err);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-start justify-between px-6 pt-5 pb-4">
        <div>
          <div className="flex items-center gap-2 text-blue-600 font-bold">
            <MessagesSquare size={16} />
            Ask the Spec
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Answers are grounded strictly in the scan report — no guessing about routes it never saw.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 border border-green-200">
              SAVED {savedAt.toLocaleDateString()} {savedAt.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Bookmark size={13} /> Save chat
          </button>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <RotateCcw size={13} /> New chat
          </button>
        </div>
      </div>

      <div className="min-h-[240px] space-y-3 px-6 pb-4 font-sans antialiased">
        <div className="rounded-2xl rounded-bl-md bg-sky-50/70 px-4 py-3 text-[13px] leading-relaxed text-slate-600">
          I've read the <span className="font-medium text-blue-600">{scanName}</span> report. Ask me things
          like <em className="not-italic text-slate-500">which routes leak data?</em> or{" "}
          <em className="not-italic text-slate-500">what should I fix first?</em>
        </div>

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="inline-block max-w-[75%] rounded-2xl rounded-br-md bg-gradient-to-br from-blue-600 to-blue-500 px-4 py-2.5 text-[13.5px] font-medium leading-relaxed text-white shadow-sm shadow-blue-600/10">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div
                className={cn(
                  "inline-block max-w-[85%] rounded-2xl rounded-bl-md border px-4 py-3 text-[13.5px] leading-relaxed shadow-sm shadow-slate-900/[0.02]",
                  m.isError
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-sky-100 bg-sky-50/60 text-slate-700"
                )}
              >
                <div className="space-y-0.5">{renderContent(m.content)}</div>
                {m.routes?.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {m.routes.map((r) => (
                      <span
                        key={r}
                        className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-mono text-blue-700"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md border border-sky-100 bg-sky-50/60 px-4 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-300 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-300 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-300" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-gray-100 px-6 py-3">
        {SUGGESTED_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => send(p)}
            className="rounded-full border border-sky-100 bg-sky-50/50 px-3.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            {p}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-gray-100 px-6 py-3.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about this scan…"
          className="flex-1 rounded-full border border-gray-200 bg-gray-50/60 px-4 py-2.5 text-[13.5px] font-sans text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 focus:bg-white"
        />
        <button
          onClick={() => send()}
          disabled={loading}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-sm shadow-blue-600/20 transition-transform hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}