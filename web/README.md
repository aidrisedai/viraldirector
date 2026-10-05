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

### Railway

`railway.json` configures the build (this Dockerfile) and the health check. One-time setup:

1. Railway → **New Project → Deploy from GitHub repo** → `aidrisedai/viraldirector`.
2. Service **Settings → Source → Root Directory**: `/web`. Set **Config file path** to `/web/railway.json`
   if Railway doesn't pick it up.
3. **Variables:** add `ANTHROPIC_API_KEY` (and `ANTHROPIC_WORKSPACE_ID` if the key starts with `sk-ant-usr-`).
   Railway injects `PORT`; don't set it.
4. **Settings → Networking → Generate Domain** (HTTPS, which the camera needs). Optionally add a custom domain and
   set `NEXT_PUBLIC_SITE_URL` to it.
5. Keep **one replica**: the rate limiter is in memory, so it's exact with one instance and per-instance with more.

Every push to `main` redeploys; a deploy goes live only after `/api/health` responds.

Health check: `GET /api/health` → `{"ok":true,"director":"connected"|"sample"}`.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | For real plans | Server-side key for the Director. Never expose it as `NEXT_PUBLIC_*`. |
| `ANTHROPIC_WORKSPACE_ID` | Only for unscoped keys | Needed when the key starts with `sk-ant-usr-`. Prefer a workspace-scoped key. |
| `DIRECTOR_MODEL` | No | Defaults to `claude-opus-5-5`. |
| `PLAN_RATE_LIMIT` | No | Plans per IP per 10 minutes (default 10). |
| `EDIT_RATE_LIMIT` | No | Director edit plans per IP per 10 minutes (default 10). |
| `CHAT_RATE_LIMIT` | No | Questions and feedback requests to the Director per IP per 10 minutes (default 40). |
| `NEXT_PUBLIC_SITE_URL` | No | Canonical URL for share metadata. |

## How it works

| Step | What's real |
| --- | --- |
| Concept | Brief (concept, goal, length, platform, audience, format). Dictation via the browser's speech recognition where available. |
| Plan | `POST /api/plan` calls Claude with the PRD's virality framework and a JSON-schema structured output, then validates it with Zod (`lib/plan.ts`). Three hooks; picking one rewrites the hook beat and the hook shot's line. |
| Shots | Call sheet grouped by location, required/optional, framing/lighting/delivery. Lines are editable. Upload a clip instead of recording. |
| Record | Live webcam with thirds grid, eye line, caption safe zone; 3-second countdown; auto-stop at target + 0.5s; teleprompter advances with the take; space starts/stops. |
| Review | Plays the take back. Automatic checks measured in the browser: duration vs. target, audio level/clipping, whether speech was heard. Keep or retake. |
| Export | **Create my video** renders the finished, postable video in the browser (below). Quality gate (hook ≤ 3s, length, clipping, required shots), a Director-written post caption, and raw takes/script downloads. |

**Ask the Director** (header button, every step) answers questions about the video with the plan and current
shot as context (`POST /api/director`):

- **Words:** filmmaking terms (A-roll, chest-up, eye line, pattern interrupt…) are tappable everywhere they appear.
  Definitions and "What is …?" questions come from `lib/glossary.ts` instantly, with no API call, and work without a key.
- **Line feedback:** "Ask the Director about this line" judges an edited line against its beat and length and can
  suggest a rewrite that applies with one click.
- **Take feedback:** on Review, the Director sees four frames from the take (center-cropped to 9:16), the audio
  measurements and, where the browser supports speech recognition, a transcript, then says keep or retake.
  Chrome and Edge send the audio to their own speech service for this; Safari transcribes on-device; Firefox has none.

**Create my video** (`components/director/render/`, logic in `lib/edit.ts`) turns the kept takes into one video,
entirely in the browser — nothing is uploaded:

- Takes in script order; dead air trimmed from each clip's start and end (speech detection on the decoded audio).
- Each clip's speech level-matched to a common target, plus a peak limiter: about −12 to −16 LUFS, typical for Reels/TikTok.
- Word-by-word captions (current word on an emerald pill), timed across the detected speech; uses the transcript
  when there is one, else the script line. Timing is estimated, not word-level speech recognition.
- The hook as an animated title over the first seconds; slow push-in/out, a punch-in on the hook, jump-cut zooms
  between caption phrases, and a flash on each cut.
- A generated music bed (Calm build / Upbeat / none) that ducks under speech — synthesized, so royalty-free.
- 9:16 (1080×1920) or 4:5 (1080×1350). MP4 (H.264/AAC) in Chrome, Edge and Safari; WebM in Firefox (Instagram needs MP4).
- Download, or Share on phones (Web Share API) straight to Instagram, TikTok, etc.

Rendering is real time (a 45s video takes about 45s) and needs the tab to stay visible.

**Finishing tools on the Export step:**

- **Captions** (`export/CaptionsCard.tsx`): captions follow what was actually said, not the script — the browser's
  transcript where available, editable per clip, with the script shown when they differ. **Get exact captions** runs
  Whisper (`Xenova/whisper-base.en`, transformers.js) on the device for word-level timing; the model (about 80–100 MB)
  downloads from Hugging Face on first use and is cached. ONNX Runtime's WebAssembly is served from `/ort/`
  (copied from `node_modules` at build). Footage never leaves the device.
- **Extra content + the Director's edit** (`export/ExtrasCard.tsx`, `POST /api/edit`, `lib/editPlan.ts`): add up to 6
  pictures or clips with a note each, plus free-form notes. The Director (Claude, with thumbnails) returns an edit
  plan — cutaways over the voice (added clips or planned B-roll), picture-in-picture cards, stat/label callouts,
  emphasised caption words, and the end-card call to action. Plans are clamped to the footage before rendering.
  Without the Director, a built-in edit lays B-roll over the voice and places added items on the talking parts.
- **EdAI branding** (on by default): the official wordmark (`public/brand/`, from the `edai-logo` brand skill) in a
  protected panel top-left over the opening, and an end card with the white brandmark (star over arch), the call to
  action and the tagline "Raising Principled and Ambitious Teens as Builders and Founders" bottom-centre. Per the
  brand rules there is no watermark, and the wordmark and brandmark never sit side by side.

The plan persists in `localStorage`. Takes stay in memory only, and the page warns before a refresh discards them.

### Code map

- `app/api/plan/route.ts`: validation, rate limit, sample fallback, error mapping
- `lib/director.ts`: Claude call (server-only), prompt, schema, refusal fallback
- `lib/plan.ts`: brief/plan schemas, sample plan, helpers
- `lib/takes.ts`: take review, export gate, file naming, script export
- `app/api/director/route.ts`, `lib/directorChat.ts`, `lib/chat.ts`: Ask the Director (ask / line / take modes)
- `lib/glossary.ts`: plain-language definitions used by tappable terms and instant answers
- `components/director/`: the six steps; `useRecorder.ts` is camera + MediaRecorder + audio metering + transcript;
  `DirectorPanel.tsx` + `useDirectorChat.ts` are the chat; `frames.ts` grabs frames for take feedback
- `components/ds/`: EdAI design-system primitives (Button, Badge, Icon)

## Production notes and known limits

- **Rate limiting is per server instance.** On serverless or multi-instance hosting, also cap `/api/plan` with your
  host's firewall/WAF, or swap `lib/rateLimit.ts` for a shared store. Set a monthly spend limit on the Anthropic key.
- **No accounts or server storage.** Projects live in one browser; takes are lost on refresh.
- **Video creation limits:** exact captions are English-only (whisper-base.en) and need the one-time model
  download; without them caption timing is estimated from the audio. Cutaway clips are silent under the voice.
  16:9 and 1:1 aren't offered yet; rendering is real time in the tab.
- CSP allows `'unsafe-inline'` scripts because Next's App Router inlines bootstrap scripts; move to nonces via
  middleware if you need a strict CSP.
