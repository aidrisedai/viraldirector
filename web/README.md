# ViralDirector — web app

Tell the Director your idea; it writes the hook, beat sheet and shot list with Claude, then walks you
through recording each shot on your webcam, checks every take, and hands you the takes in script order.

Built from the Claude Design handoff (`../project/ViralDirector Web.dc.html`) on the EdAI design system.

## Accounts and projects

Signed out (or with sign-in not set up), the app is a single-video studio, exactly as before. Signed in, the home page is
**your studio**: projects and your single videos.

A **project** is a goal reached one video at a time — "one video a day for 90 days", "3 a week until launch":

- **New project** (`/projects/new`): name, goal, how often (every day, 5/3/1 a week, twice a day), how long (30/60/90 days,
  6 months, open-ended), start date, and the platform/audience/purpose/length every video in it defaults to. The Director
  then writes the first ideas.
- **Project page** (`/projects/[id]`): today's status ("Today's video is waiting", "On track", "2 behind"), a *Make
  today's video* button, made vs. target with a progress bar, the day streak (daily projects) or how far ahead of plan
  you are, posted count, days left, and a calendar of the whole run. **Up next** is the idea backlog: the Director
  suggests more (optionally steered — "more behind-the-scenes"), you add, edit, reorder or skip your own. **Made** lists
  every video with its thumbnail, date, length and hook; mark it posted (with the link), copy its caption, or reopen it.
  Drafts you started but didn't finish appear under **In progress**.
- **Making a video from an idea** opens the studio with the idea and the project's settings filled in, plus *series
  context* (the goal and the recent videos) so the Director builds the series instead of repeating hooks. The video is
  saved after planning (so it can be picked up on another device), and when it's exported it's recorded as made with a
  thumbnail; its idea is used up. Single videos are saved the same way, outside any project.

Stored per video: title, concept, hook, caption, length, format, a small JPEG thumbnail, the brief and plan, and status
(draft / made / posted). **The video files themselves stay on the device that made them** — nothing is uploaded.

Code: `lib/projectTypes.ts` (shapes and validation), `lib/projects.ts` (Postgres queries — every one scoped to the
signed-in user), `lib/db.ts` (pool + automatic schema), `lib/projectStats.ts` (progress in the creator's time zone),
`lib/projectIdeas.ts` + `lib/series.ts` (the Director's ideas and series context), `app/api/{projects,ideas,videos}`,
`components/app/` (studio, project pages, account). Sign-in is Clerk (`proxy.ts`, `lib/auth.ts`, `lib/authConfig.ts`);
the Content-Security-Policy is set per request in `proxy.ts` and allows only your Clerk domain (read from the key).

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
3. **Variables:** add `ANTHROPIC_API_KEY` (and `ANTHROPIC_WORKSPACE_ID` if the key starts with `sk-ant-usr-`), and
   `OPENAI_API_KEY` for server-side captions.
   Railway injects `PORT`; don't set it.
4. **Accounts and projects (optional):**
   - **Database:** in the Railway project, **+ New → Database → PostgreSQL**. Then in the app service's **Variables**, add
     `DATABASE_URL` as a reference to the Postgres service's `DATABASE_URL`. Tables are created automatically.
   - **Sign-in:** create an application at [clerk.com](https://clerk.com), choose the sign-in methods you want (email,
     Google, …), and add its `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to the app's Variables. For production, add
     your domain in Clerk and use the live keys (`pk_live_…`, `sk_live_…`).
   - `/api/health` then shows `"accounts":"clerk","database":"connected"`.
5. **Settings → Networking → Generate Domain** (HTTPS, which the camera needs). Optionally add a custom domain and
   set `NEXT_PUBLIC_SITE_URL` to it.
6. Keep **one replica**: the rate limiter is in memory, so it's exact with one instance and per-instance with more.

Every push to `main` redeploys; a deploy goes live only after `/api/health` responds.

Health check: `GET /api/health` → `{"ok":true,"director":"connected"|"sample","transcription":"server"|"device","accounts":"clerk"|"test"|"off","database":"connected"|"none"}`.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | For real plans | Server-side key for the Director. Never expose it as `NEXT_PUBLIC_*`. |
| `ANTHROPIC_WORKSPACE_ID` | Only for unscoped keys | Needed when the key starts with `sk-ant-usr-`. Prefer a workspace-scoped key. |
| `OPENAI_API_KEY` | Recommended | Server-side speech-to-text (exact captions with no model download for creators). |
| `OPENAI_TRANSCRIBE_MODEL` | No | Defaults to `whisper-1` (needed for word timestamps). |
| `TRANSCRIBE_RATE_LIMIT` | No | Transcriptions per IP per 10 minutes (default 60). |
| `WRITER_RATE_LIMIT` | No | Writer questions, drafts and revisions per IP per 10 minutes (default 20). |
| `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | For accounts | Clerk sign-in. Without them there's no sign-in and no projects. |
| `DATABASE_URL` | For projects | Postgres for projects, ideas and saved videos. |
| `DEV_AUTH` | Local only | `1` signs everyone in as one test user outside production. |
| `IDEAS_RATE_LIMIT` | No | Idea suggestions per user per 10 minutes (default 12). |
| `DIRECTOR_MODEL` | No | Defaults to `claude-opus-5-5`. |
| `PLAN_RATE_LIMIT` | No | Plans per IP per 10 minutes (default 10). |
| `EDIT_RATE_LIMIT` | No | Director edit plans per IP per 10 minutes (default 10). |
| `CHAT_RATE_LIMIT` | No | Questions and feedback requests to the Director per IP per 10 minutes (default 40). |
| `NEXT_PUBLIC_SITE_URL` | No | Canonical URL for share metadata. |

## How it works

| Step | What's real |
| --- | --- |
| Concept | Brief (concept, goal, length, platform, audience, format). Dictation via the browser's speech recognition where available. Two ways in: **Quick idea** (one sentence) or **Tell the full story** (below). |
| Plan | `POST /api/plan` calls Claude with the PRD's virality framework and a JSON-schema structured output, then validates it with Zod (`lib/plan.ts`). Three hooks; picking one rewrites the hook beat and the hook shot's line. |
| Shots | Call sheet grouped by location, required/optional, framing/lighting/delivery. Lines are editable. Upload a clip instead of recording. |
| Record | Live webcam with thirds grid, eye line, caption safe zone; 3-second countdown; auto-stop at target + 0.5s; teleprompter advances with the take; space starts/stops. |
| Review | Plays the take back. Automatic checks measured in the browser: duration vs. target, audio level/clipping, whether speech was heard. Keep or retake. |
| Export | **The editor**: a live preview of the finished video and a timeline to arrange it by hand (below). **Export my video** makes the file. Quality gate (hook ≤ 3s, length, clipping, required shots), a Director-written post caption, and raw takes/script downloads. |

**Tell the full story** (`components/director/StoryWriter.tsx`, `POST /api/writer`, `lib/writer.ts`, `lib/story.ts`):
the creator explains the scenario in their own words (up to 4,000 characters, typed or dictated) and picks a writer —
Screenwriter, Copywriter, Journalist or Comedy writer, each a different craft prompt. The writer asks up to three
follow-up questions (skippable), then writes a title, a one-line logline and a spoken script with `[visual notes]`, sized
to the target length (about 2.6 words per second; the draft shows its estimated spoken length). The creator can edit it
by hand or ask for revisions. On handoff the logline becomes the concept and the script goes to the Director as
`brief.story`; the Director builds hooks, beats and shots from it and keeps its lines where they fit. Writers never
invent facts. The draft is saved in `localStorage` until **New video**. Needs the API key (no sample writer).

**Ask the Director** (header button, every step) answers questions about the video with the plan and current
shot as context (`POST /api/director`):

- **Words:** filmmaking terms (A-roll, chest-up, eye line, pattern interrupt…) are tappable everywhere they appear.
  Definitions and "What is …?" questions come from `lib/glossary.ts` instantly, with no API call, and work without a key.
- **Line feedback:** "Ask the Director about this line" judges an edited line against its beat and length and can
  suggest a rewrite that applies with one click.
- **Take feedback:** on Review, the Director sees four frames from the take (center-cropped to 9:16), the audio
  measurements and, where the browser supports speech recognition, a transcript, then says keep or retake.
  Chrome and Edge send the audio to their own speech service for this; Safari transcribes on-device; Firefox has none.

**The editor** (`components/director/editor/Editor.tsx`, logic in `lib/timeline.ts`) is where the video is finished by
hand, no prompts needed:

- A live preview of the finished video — play, pause, scrub, ←/→ to step, Space to play. It is drawn by the same engine
  that exports the file (`render/engine.ts` + `render/compositor.ts`), so the preview *is* the final video.
- A timeline with **Clips** (tap one to fix its captions or remove it; removed clips can be put back), **Overlays**
  (pictures and clips over your voice — drag them from the media bin or straight from your computer onto the row, tap
  "+ At playhead", drag to move, drag the right edge to lengthen, switch Full screen / Card), **Text** (add text at the
  playhead, edit it, make it a big counting number) and **Music** (the volume slider changes the level live while it plays).
- Undo/redo (⌘/Ctrl+Z), Delete to remove the selected piece. The look controls (caption style, motion, title, music)
  update the preview immediately. Hand edits are saved as "Your edit"; the Director can still revise them.

**On phones** (≤ 820 px) the editor opens full screen, built like a mobile editing app: the preview fills the top;
the timeline scrolls under a fixed centre playhead (swipe to scrub, pinch or −/+ to zoom); a bottom tool bar opens
sheets for Media (tap a picture or clip to put it at the playhead, or add from the phone), Text, Captions, Style,
Music (live volume) and the Director; tapping a piece on the timeline swaps the bar for its actions (move by dragging,
Shorter/Longer, Full/Card, Delete). Export lives in its own sheet. Recording is a full-screen camera with the
teleprompter and shutter over it; the header collapses to one row with the steps scrolling sideways. The app has a web
manifest and safe-area support, so "Add to Home Screen" opens it full screen like an app.

**Export my video** (`components/director/render/`, logic in `lib/edit.ts`) turns the edit into one video file,
entirely in the browser — nothing is uploaded:

- Takes in script order; dead air trimmed from each clip's start and end (speech detection on the decoded audio).
- Each clip's speech level-matched to a common target, plus a peak limiter: about −12 to −16 LUFS, typical for Reels/TikTok.
- Animated captions (`render/text.ts`) in four styles — **Pop** (word by word on an emerald pill that glides between
  words), **Karaoke** (the line fills in as it's spoken), **Bold** (one or two huge words slam in with motion blur),
  **Minimal** (clean sentence-case lines) — in three sizes, mid-frame or lower. Timed from exact word times when
  available, else across the detected speech.
- A kinetic opening title (words rise out of a mask over a soft scrim, an emerald rule draws in); stat callouts that
  wipe open and count their number up; label callouts that slide in behind an emerald bar; spring-in picture cards.
- Motion: Punchy (punch-in on the hook, jump-cut zooms, pushes on emphasised words) or Calm (slow drifts only), and a
  transition between clips — Flash, Whip (motion-blurred slide), Zoom or Cut. Motion curves live in `lib/motion.ts`.
- Music (`render/musicTrack.ts`, `lib/audioMix.ts`): a generated bed (Calm build / Upbeat, synthesized, royalty-free)
  or **My music** — the creator's own song (MP3/M4A/WAV, up to 60 MB, looped if short). Every track is measured
  (90th-percentile RMS) and set relative to the quietest speaking clip: its loud parts sit 20 dB under the voice while
  anyone talks and 9 dB under it in gaps and on the end card, scaled down by the volume slider — so music is never as
  loud as the voice, however loud the song was mastered.
- 9:16 (1080×1920) or 4:5 (1080×1350). MP4 (H.264/AAC) in Chrome, Edge and Safari; WebM in Firefox (Instagram needs MP4).
- Download, or Share on phones (Web Share API) straight to Instagram, TikTok, etc.

Rendering is real time (a 45s video takes about 45s) and needs the tab to stay visible.

**Finishing tools on the Export step:**

- **Captions** (`export/CaptionsCard.tsx`): captions follow what was actually said, not the script — the browser's
  transcript where available, editable per clip, with the script shown when they differ. **Exact captions** (word-level
  timing): with `OPENAI_API_KEY` set they run automatically on the server (`POST /api/transcribe`, OpenAI `whisper-1` —
  the hosted model that returns word timestamps; only a 16 kHz mono WAV of each clip's audio is sent, never the video;
  the transcript's punctuation is aligned onto the word timings in `lib/transcript.ts`). Without it they run on the
  device with Whisper (`Xenova/whisper-base.en`, transformers.js): a one-time 80–100 MB model download, cached; ONNX
  Runtime's WebAssembly is served from `/ort/` (copied from `node_modules` at build).
- **Extra content + the Director's edit** (`export/ExtrasCard.tsx`, `POST /api/edit`, `lib/editPlan.ts`): add up to 6
  pictures or clips with a note each, plus free-form notes. The Director (Claude, with thumbnails) returns an edit
  plan — cutaways over the voice (added clips or planned B-roll), picture-in-picture cards, stat/label callouts,
  emphasised caption words, and the end-card call to action. Plans are clamped to the footage before rendering.
  Without the Director, a built-in edit lays B-roll over the voice and places added items on the talking parts.
- **Look** (`export/LookControls.tsx`): caption style, size and position, transition, energy, the opening title
  (rewrite or hide it), music and its volume, branding. The Director picks these with its edit; the creator can change
  any of them.
- **Improve this video** (`export/ImproveCard.tsx`): after the video is made, the creator says what to change in plain
  words ("music is distracting", "at 0:12 the captions cover my face"). The Director gets the current edit, the style,
  where each segment starts in the video they watched, and earlier rounds, and returns a revised edit and style — it
  can restyle, move or remove cutaways and callouts, fix caption text, or drop a weak shot — then the video is made
  again automatically. Without the Director, `lib/revise.ts` handles common requests about captions, motion, title and
  music level, and says what it can't do.
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
- `app/api/writer/route.ts`, `lib/writer.ts`, `lib/story.ts`: story mode (writers, questions, drafts, revisions)
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
