/**
 * Local response engine.
 *
 * The frontend ships without a backend, so replies are composed locally and
 * streamed token-by-token through the exact same interface a real API would
 * use. Swap `streamCompletion` for a `fetch(...)` + ReadableStream reader
 * against FastAPI and nothing else in the UI has to change.
 */
import type { Message } from "../types/chat";

export interface StreamHandle {
  stop: () => void;
}

const CODE_HINT = /(code|function|component|react|python|javascript|typescript|api|sql|bug|error|script|class|css|html|regex|deploy)/i;
const TABLE_HINT = /(compare|comparison|vs|difference|pros and cons|table|pricing|options)/i;
const LIST_HINT = /(steps|how to|guide|plan|roadmap|checklist|ideas|list|strategy)/i;
const MATH_HINT = /(calculate|equation|formula|math|integral|derivative|probability)/i;
const GREET = /^(hi|hey|hello|yo|namaste|hola|good (morning|evening|afternoon))\b/i;

function lang(prompt: string) {
  if (/python|flask|fastapi|django|pandas/i.test(prompt)) return "python";
  if (/sql|postgres|mysql|query/i.test(prompt)) return "sql";
  if (/css|tailwind|styling/i.test(prompt)) return "css";
  if (/html|markup/i.test(prompt)) return "html";
  if (/json|config/i.test(prompt)) return "json";
  return "tsx";
}

function codeSample(l: string, topic: string) {
  switch (l) {
    case "python":
      return `from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="${topic}")

class Prompt(BaseModel):
    text: str
    model: str = "vatsa-1.5-pro"

@app.post("/api/chat")
async def chat(body: Prompt):
    # stream tokens back to the client
    return {"reply": f"You said: {body.text}", "model": body.model}`;
    case "sql":
      return `select
  c.id,
  c.title,
  count(m.id) as message_count,
  max(m.created_at) as last_activity
from conversations c
left join messages m on m.chat_id = c.id
where c.deleted_at is null
group by c.id, c.title
order by last_activity desc
limit 50;`;
    case "css":
      return `.panel {
  background: #111111;
  border: 1px solid #222;
  border-radius: 16px;
  transition: background 160ms ease, transform 160ms ease;
}

.panel:hover {
  background: rgba(255, 255, 255, 0.05);
  transform: translateY(-1px);
}`;
    case "html":
      return `<section class="hero">
  <h1>${topic}</h1>
  <p>Ship the interface first, wire the API second.</p>
  <button type="button" data-action="start">Get started</button>
</section>`;
    case "json":
      return `{
  "name": "${topic.toLowerCase().replace(/\s+/g, "-") || "project"}",
  "runtime": "node20",
  "features": ["streaming", "persistence", "keyboard-first"]
}`;
    default:
      return `import { useEffect, useState } from "react";

export function useDebounced<T>(value: T, delay = 500) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}`;
  }
}

function subject(prompt: string) {
  const clean = prompt.replace(/[?.!]/g, "").trim();
  const words = clean.split(/\s+/).slice(0, 7).join(" ");
  return words || "your request";
}

export function composeReply(prompt: string, history: Message[]): string {
  const topic = subject(prompt);
  const turn = history.filter((m) => m.role === "user").length;

  if (GREET.test(prompt.trim())) {
    return `Hey — good to see you.

I'm **Vatsa AI**. Tell me what you're working on and I'll help you shape it: architecture, code, writing, research, or planning.

A few things I'm good at:

- Breaking a vague idea into a concrete build plan
- Writing and reviewing code with working examples
- Comparing options in a table so the trade-offs are obvious
- Turning messy notes into something publishable

What are we building?`;
  }

  const parts: string[] = [];

  parts.push(
    `### ${topic.charAt(0).toUpperCase() + topic.slice(1)}\n\nHere's how I'd approach it. I've kept it practical so you can act on it immediately${
      turn > 1 ? ", and I'm carrying over the context from earlier in this thread" : ""
    }.`,
  );

  if (LIST_HINT.test(prompt) || !CODE_HINT.test(prompt)) {
    parts.push(`**The short version**

1. **Define the boundary** — write down exactly what "done" looks like before touching anything else.
2. **Pick the smallest slice** that proves the idea works end to end.
3. **Instrument it** — logs, timings, and a way to reproduce failures.
4. **Iterate on the slice** until it is boring, then widen the scope.

> Most projects don't fail on capability, they fail on scope. Shrink the first slice until it feels almost trivial.`);
  }

  if (TABLE_HINT.test(prompt)) {
    parts.push(`**Trade-offs at a glance**

| Approach | Speed to ship | Flexibility | Best for |
| --- | --- | --- | --- |
| Managed service | Very fast | Low | Validating demand |
| Framework + plugins | Fast | Medium | Most products |
| Custom build | Slow | High | Differentiated core |

If you're unsure, start in the middle row and only move down when a constraint actually hurts.`);
  }

  if (CODE_HINT.test(prompt)) {
    const l = lang(prompt);
    parts.push(`**A concrete starting point**

\`\`\`${l}
${codeSample(l, topic)}
\`\`\`

Notes on the snippet:

- It has one responsibility, so it's easy to test in isolation.
- Every side effect is cleaned up — no leaked timers or listeners.
- The signature is stable, so swapping the implementation later won't ripple.`);
  }

  if (MATH_HINT.test(prompt)) {
    parts.push(`**The math**

For a sequence of independent attempts each with success probability \`p\`, the chance of at least one success in \`n\` tries is:

\`\`\`text
P(success) = 1 - (1 - p)^n
\`\`\`

So at \`p = 0.2\`, five attempts already gets you to ~67%.`);
  }

  parts.push(`**Checklist**

- [x] Problem stated in one sentence
- [ ] Smallest slice identified
- [ ] Success metric agreed
- [ ] Failure mode written down

Want me to go deeper on any one of these, or turn it into a step-by-step implementation plan?`);

  return parts.join("\n\n");
}

/** Streams text to `onToken` in small chunks. Returns a stop handle. */
export function streamText(
  full: string,
  opts: {
    speed?: number;
    onToken: (chunk: string) => void;
    onDone: (stopped: boolean) => void;
  },
): StreamHandle {
  let cancelled = false;
  let i = 0;
  const speed = Math.max(1, opts.speed ?? 2);
  const chunk = Math.max(2, Math.round(speed * 2.5));
  let raf = 0;
  let last = 0;

  const tick = (t: number) => {
    if (cancelled) return;
    if (t - last >= 16) {
      last = t;
      const next = full.slice(i, i + chunk + Math.floor(Math.random() * 3));
      i += next.length;
      if (next) opts.onToken(next);
      if (i >= full.length) {
        opts.onDone(false);
        return;
      }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    stop() {
      if (cancelled) return;
      cancelled = true;
      cancelAnimationFrame(raf);
      opts.onDone(true);
    },
  };
}
