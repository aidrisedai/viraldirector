# ViralDirector — web app

Tell the Director your idea; it writes the hook, beat sheet and shot list with Claude, then walks you
through recording each shot on your webcam, checks every take, and hands you the takes in script order.

Built from the Claude Design handoff (`../project/ViralDirector Web.dc.html`) on the EdAI design system.

## Run locally

```bash
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

Without `ANTHROPIC_API_KEY` the app still runs: `/api/plan` returns the PRD's example plan and the UI labels it
"Sample plan".

```bash
npm run check   # lint + typecheck + unit tests
npm run build   # production build (standalone output)
```

## Deploy

Any Node 20.9+ host works. Camera recording needs HTTPS (browsers block `getUserMedia` on plain HTTP).

The app ships as a standalone Docker image that runs on any container host (Fly.io, Render, Railway, Google Cloud Run, a VPS, …). Set the environment variables below as secrets in the host, never in the repo.

```bash
docker build -t viraldirector .
docker run -p 3000:3000 --env-file .env.local viraldirector
```

Health check: `GET /api/health` → `{"ok":true,"director":"connected"|"sample"}`.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | For real plans | Server-side key for the Director. Never expose it as `NEXT_PUBLIC_*`. |
| `ANTHROPIC_WORKSPACE_ID` | Only for unscoped keys | Needed when the key starts with `sk-ant-usr-`. Prefer a workspace-scoped key. |
| `DIRECTOR_MODEL` | No | Defaults to `claude-opus-5-5`. |
| `PLAN_RATE_LIMIT` | No | Plans per IP per 10 minutes (default 10). |
| `NEXT_PUBLIC_SITE_URL` | No | Canonical URL for share metadata. |

## How it works

| Step | What's real |
| --- | --- |
| Concept | Brief (concept, goal, length, platform, audience, format). Dictation via the browser's speech recognition where available. |
| Plan | `POST /api/plan` calls Claude with the PRD's virality framework and a JSON-schema structured output, then validates it with Zod (`lib/plan.ts`). Three hooks; picking one rewrites the hook beat and the hook shot's line. |
| Shots | Call sheet grouped by location, required/optional, framing/lighting/delivery. Lines are editable. Upload a clip instead of recording. |
| Record | Live webcam with thirds grid, eye line, caption safe zone; 3-second countdown; auto-stop at target + 0.5s; teleprompter advances with the take; space starts/stops. |
| Review | Plays the take back. Automatic checks measured in the browser: duration vs. target, audio level/clipping, whether speech was heard. Keep or retake. |
| Export | Rough cut plays kept takes back to back; quality gate (hook ≤ 3s, length, clipping, required shots); downloads numbered takes and the script. |

The plan persists in `localStorage`. Takes stay in memory only, and the page warns before a refresh discards them.

### Code map

- `app/api/plan/route.ts`: validation, rate limit, sample fallback, error mapping
- `lib/director.ts`: Claude call (server-only), prompt, schema, refusal fallback
- `lib/plan.ts`: brief/plan schemas, sample plan, helpers
- `lib/takes.ts`: take review, export gate, file naming, script export
- `components/director/`: the six steps; `useRecorder.ts` is camera + MediaRecorder + audio metering
- `components/ds/`: EdAI design-system primitives (Button, Badge, Icon)

## Production notes and known limits

- **Rate limiting is per server instance.** On serverless or multi-instance hosting, also cap `/api/plan` with your
  host's firewall/WAF, or swap `lib/rateLimit.ts` for a shared store. Set a monthly spend limit on the Anthropic key.
- **No accounts or server storage.** Projects live in one browser; takes are lost on refresh.
- **Not built yet (PRD P0s that need a backend):** automatic assembly into one edited video, burned-in captions,
  music, multi-ratio rendering, and Director scoring of framing/energy/line accuracy (needs speech-to-text and
  vision). Export gives creators their numbered takes to finish in any editor.
- CSP allows `'unsafe-inline'` scripts because Next's App Router inlines bootstrap scripts; move to nonces via
  middleware if you need a strict CSP.
