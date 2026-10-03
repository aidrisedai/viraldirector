# ViralDirector — Product Requirements Document

Oct 3, 2026 · @Azeez

## Overview and problem

ViralDirector flips video creation from "fix it in post" to "get it right on set": the creator gives a concept, the platform directs every shot, and then assembles the finished video from what it asked for.

**The problem.** Today's AI video tools (CapCut, Descript, Opus Clip, Submagic) start after recording. They can trim, caption and reframe, but they cannot add a hook that was never filmed, a B-roll shot nobody captured, or energy the creator didn't bring. Most raw footage is structurally weak, so editing polishes a weak video.

**Why creators struggle.** Viral short-form video follows learnable patterns — a hook in the first 1–3 seconds, a clear payoff, pattern interrupts, a loop or CTA — but most creators don't know them, or forget them once the camera is on. They record one long take, then hope an editor can save it.

**The thesis.** A director upstream beats an editor downstream. If the platform plans the video before recording — script, shot list, framing, delivery notes, takes — every piece it receives is already fit for the final cut, and assembly becomes mostly automatic.

**One-line pitch.** Tell us your idea; we'll direct you shot by shot, then hand you a finished, platform-ready video.

## Goals, non-goals and success metrics

The MVP succeeds if a first-time creator goes from idea to a publishable 30–60 second video in one sitting, and the result outperforms what they'd have made alone.

**Goals**

- Turn a one-sentence concept into a complete, recordable production plan in under 2 minutes.
- Guide recording shot by shot so every clip arrives usable, with retakes caught before assembly.
- Auto-assemble a finished video (cuts, captions, music, B-roll, export) with no timeline editing required.
- Teach virality patterns implicitly, so creators improve with every video.

**Non-goals (v1)**

- A full manual timeline editor. Light trims and swaps only.
- Long-form video (over 3 minutes) or multi-person productions.
- Fully AI-generated video with no human footage. The creator is always on camera or behind it.
- Guaranteeing virality. We maximize the odds; we don't promise outcomes.

**Success metrics**

| Metric | Target (first 90 days) | Why it matters |
| --- | --- | --- |
| Concept-to-export completion rate | 40%+ of started projects | Proves the guided flow doesn't lose people |
| Median time, concept to export | Under 30 minutes | The promise is one sitting |
| Clips accepted on first take | 60%+ | Direction quality is working |
| Videos published (self-reported or via API) | 50%+ of exports | Output is good enough to post |
| Avg. 3-second hold rate vs. creator's baseline | +20% | The hook framework actually works |
| 30-day retention | 35%+ make a second video | Creators see value repeat |

## Target users and personas

The primary user is a founder, educator or small business owner who knows their subject but not video craft, and records on a phone.

| Persona | Who they are | Core pain | What ViralDirector gives them |
| --- | --- | --- | --- |
| The expert founder | Runs a company or nonprofit; needs reach on LinkedIn, Instagram, TikTok | Has ideas, no time or video skill; posts feel flat | A ready shot plan per idea; finished video in one session |
| The teen builder / student creator | Building a product or brand; comfortable on camera | Rambles, no structure, weak hooks | Learns story structure by doing; confidence from direction |
| The small business owner | Café, coach, trucking, local service | Doesn't know what to film beyond "talk to camera" | Concrete B-roll and demo shots tied to their business |
| The educator / org comms lead | Teacher, masjid or school comms, program lead | Needs consistent branded content at volume | Reusable formats, brand kit, batch planning |

Out of scope for v1: professional editors and agencies, who want granular control rather than direction.

## Core user journey

The creator does two things — approve a plan and perform it; the platform does everything else.

&#91;embedded content: core user journey · 6 steps, 2 loops\]

Recording is the only step that loops on purpose: a weak take is caught in seconds, not discovered in the edit.

**Example.** Concept: "Why most teens never start a business." The Director proposes the hook "Your first business idea is probably bad — that's the point," a 45-second beat sheet, and 7 shots: 4 talking-head lines, 2 B-roll (notebook sketch, phone showing a first sale), and 1 reaction reset. The creator records in about 15 minutes; the platform exports 9:16 and 4:5 cuts with captions and music.

## Functional requirements

Six modules carry the product; P0 items are required for MVP, P1 for the first release after it, P2 later.

### 1. Concept intake

| ID | Requirement | Priority |
| --- | --- | --- |
| CI-1 | Creator enters a concept in free text or voice ("why most teens never start a business") | P0 |
| CI-2 | Platform asks at most 3–4 clarifying questions: goal (grow, sell, teach), target platform, audience, length | P0 |
| CI-3 | Creator can pick a format template (talking head, tutorial, story, myth-busting, day-in-the-life, before/after) or let the Director choose | P0 |
| CI-4 | Optional brand kit: logo, colors, fonts, intro/outro cards, music preferences | P1 |
| CI-5 | Optional trend input: paste a reference video link to match its structure (not its content) | P2 |

### 2. Treatment and script

| ID | Requirement | Priority |
| --- | --- | --- |
| TS-1 | Generate 3 hook options, each with a one-line rationale; creator picks or edits one | P0 |
| TS-2 | Generate a beat sheet: hook, setup, value beats, payoff, CTA/loop, with target seconds per beat | P0 |
| TS-3 | Generate the script line by line, written for the creator's speaking style | P0 |
| TS-4 | Creator can edit any line; the Director re-checks pacing and length after edits | P0 |
| TS-5 | Learn the creator's voice from past scripts and approved edits | P1 |

### 3. Shot list (the Director's call sheet)

| ID | Requirement | Priority |
| --- | --- | --- |
| SL-1 | Break the script into numbered shots, each with: type (A-roll, B-roll, insert, reaction, screen recording), line(s) covered, framing, duration, delivery note | P0 |
| SL-2 | Each B-roll shot is concrete and filmable with a phone ("hands typing on laptop, over-the-shoulder, 3 sec"), not abstract ("show productivity") | P0 |
| SL-3 | Show a visual storyboard frame per shot (sketch or reference image) | P1 |
| SL-4 | Group shots by location so the creator records efficiently, not in story order | P1 |
| SL-5 | Mark each shot as required or optional; the video still assembles if optional shots are skipped | P0 |

### 4. Guided recording

| ID | Requirement | Priority |
| --- | --- | --- |
| GR-1 | In-app camera walks through shots one at a time with the line shown as a teleprompter | P0 |
| GR-2 | Framing overlay (rule of thirds, eye line, safe zones for captions and platform UI) | P0 |
| GR-3 | Countdown, then auto-stop at target duration plus a small buffer | P0 |
| GR-4 | Instant take review: Director scores the take (audio, framing, energy, line accuracy) and says accept or retake, with one specific note | P0 |
| GR-5 | Creator can upload clips recorded elsewhere and map them to shots | P0 |
| GR-6 | Real-time coaching during the take ("slow down", "look at lens") | P2 |

### 5. Assembly

| ID | Requirement | Priority |
| --- | --- | --- |
| AS-1 | Auto-assemble accepted takes in script order, trimming silences and false starts | P0 |
| AS-2 | Auto captions, styled, word-level timing, placed inside safe zones | P0 |
| AS-3 | Background music matched to mood, ducked under speech | P0 |
| AS-4 | Pacing pass: zoom punch-ins, cuts on emphasis, pattern interrupts every 3–5 seconds | P0 |
| AS-5 | Fill missing optional B-roll with stock or AI-generated footage, clearly labelled | P1 |
| AS-6 | Light edit mode: swap a take, change hook, change music, adjust caption style | P0 |

### 6. Export and learning loop

| ID | Requirement | Priority |
| --- | --- | --- |
| EX-1 | Export presets: 9:16 for TikTok, Reels, Shorts; 1:1 and 4:5 for LinkedIn/feed; 16:9 cut-down | P0 |
| EX-2 | Generate post caption, hashtags and a thumbnail/cover frame | P1 |
| EX-3 | Creator logs performance (or connects accounts) so the Director learns which hooks and formats work for them | P2 |

## The Director engine

The Director is the product's moat: an opinionated system that converts a concept into a shot plan using a codified virality framework, then judges each take against that plan.

**Virality framework the Director applies to every plan**

1. **Hook (0–3 s):** a bold claim, question, contrarian take, visual surprise or open loop. Spoken and on-screen text must both land in the first second.
2. **Retention structure:** one idea per video; a new visual or beat every 3–5 seconds; tension before payoff.
3. **Payoff:** deliver what the hook promised, specifically, before the viewer can guess it.
4. **Loop or CTA:** an ending that rewinds into the hook, or one clear action (follow, comment a word, link).
5. **Platform fit:** length, aspect ratio, caption safe zones and tone tuned to the chosen platform.

**Shot vocabulary.** The Director only asks for shots a solo creator can film with a phone:

| Shot type | Purpose | Example direction |
| --- | --- | --- |
| A-roll (talking head) | Carries the script | "Chest-up, eyes on lens, phone at eye height, window light in front" |
| Hook shot | Stops the scroll | "Start mid-motion: walk into frame and say the line as you stop" |
| B-roll | Visual proof of what's said | "Close-up of your hands sketching the app on paper, 3 s" |
| Insert / prop | Emphasis on an object | "Hold the product to the lens, then pull back" |
| Screen recording | Demo or proof | "Record your screen tapping 'Publish', 5 s" |
| Reaction / reset | Pattern interrupt | "Different angle, raise an eyebrow, 1 s, no line" |

**Direction notes per shot** cover four things: framing, lighting, delivery (energy level 1–5, pace, emotion) and the exact line. Notes are short and actionable, written like a director talks, never as theory.

**Take evaluation.** Each take is scored on audio clarity, framing match, line accuracy (speech-to-text vs. script), energy and duration. The Director returns accept or retake with a single fix ("Good energy; you rushed the last three words — try it again slower"). Creators can override and accept anyway.

**Adaptivity.** If a creator skips or fails a shot, the Director re-plans: shortens a beat, moves a line to A-roll, or swaps in an optional shot, so the video still holds together.

## Assembly engine

Because every clip is tagged to a shot and a script line at recording time, assembly is a deterministic build from the plan, not a guess from raw footage.

**Build steps**

1. **Map:** place each accepted take on its beat using the shot list as the edit decision list (EDL).
2. **Clean:** transcribe, align words to the script, cut silences, ums and false starts; normalize audio and reduce noise.
3. **Layer:** lay B-roll over A-roll on the lines the shot list tied it to; keep the creator's voice continuous underneath.
4. **Pace:** add punch-in zooms on emphasized words, cut on beats, and insert a pattern interrupt where a segment runs past 5 seconds without a visual change.
5. **Text:** burn in word-timed captions with keyword highlights; add on-screen hook text in the first second.
6. **Sound:** add a music bed matched to mood and ducked under speech, plus light SFX on transitions (toggleable).
7. **Brand:** apply intro/outro cards, logo, colors and fonts from the brand kit.
8. **Render:** export each requested aspect ratio, reframing per ratio with face tracking.

**Creator controls after assembly.** Swap a take, pick a different hook, change caption style or music, toggle SFX, trim a beat. Every change re-renders a preview in seconds, not minutes.

**Quality gate before export.** An automated check flags: hook longer than 3 seconds, any caption outside safe zones, audio clipping, total length over platform target, and missing required shots.

## MVP scope and roadmap

The MVP is every P0 requirement above, for one creator, one platform format (9:16), 30–90 second videos — but we test the Director by hand first.

&#91;embedded content: roadmap · 4 phases, 3 gates\]

Each gate (diamond) must pass before the next phase starts. Phase 0 is cheap on purpose: if hand-delivered shot plans don't produce better videos, no app will fix that.

**Phase 0 in practice.** Creators submit a concept through a form or chat; the Director (an LLM with the framework prompt) returns hooks, script and shot list; creators record on their own phones; the team assembles in an existing editor. We measure shot completion, time spent, and hold rate vs. the creator's past videos.

## Technical architecture

The production plan is the system's backbone: the Director writes it, the capture app fills it with takes, and the renderer reads it as an edit list.

&#91;embedded content: system architecture · clients, orchestrator, 3 services\]

**Core data model.** Project → Plan (concept, platform, hook, beats) → Shots (type, line, framing, duration, required flag) → Takes (file, transcript, scores, accepted flag) → Render (ratio, settings, output URL).

**Suggested stack (to validate)**

| Layer | Option | Notes |
| --- | --- | --- |
| Mobile capture | React Native / Expo | One codebase; native camera access needed for overlays |
| Web planner | Next.js | Planning and review on desktop |
| Director | Claude API with structured JSON output | Plan schema enforced; framework kept as editable prompt config |
| Transcription | Whisper or Deepgram | Word-level timestamps for cuts and captions |
| Rendering | FFmpeg on queued workers (or Remotion) | Low-res preview fast; full render at export |
| Storage | S3-compatible object storage + Postgres | Media in buckets, plan and metadata in Postgres |

## Risks, open questions and decisions needed

The biggest risk is friction: if directing feels like homework, creators quit before the payoff.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Too many shots → drop-off mid-recording | High | Cap MVP plans at 6–10 shots; mark optional shots; show progress ("4 of 7 done") |
| Generic, templated output ("every video looks the same") | High | Vary hooks and formats; learn creator voice; let creators edit script freely |
| Take scoring feels wrong or nagging | Medium | One note per take; always allow override; tune thresholds from accept-anyway data |
| Render cost and latency | Medium | Low-res previews, server render only at export; cache intermediate layers |
| Music and stock licensing | Medium | License a royalty-free library; never use trending copyrighted audio in exports |
| AI-generated B-roll misrepresents reality | Medium | Label generated footage; default to creator-shot B-roll |
| Platforms change what works | Low–Medium | Keep the virality framework as editable config, not hard-coded logic |

**Open questions**

- [ ] Mobile-first app, web app, or both for MVP? Recording strongly favors mobile.
- [ ] Standalone product, or a module inside EdAI Studio / the existing reel pipeline?
- [ ] Who is the launch audience — EdAI teen builders, founders broadly, or small businesses?
- [ ] Pricing: free tier with watermark + subscription, or per-video credits?
- [ ] Do we support a second person (interviewer, co-host) in v1 or v2?
- [ ] Build vs. buy for captions, transcription and rendering (e.g., third-party APIs vs. in-house FFmpeg pipeline)?
- [ ] Which platform is the default target — TikTok/Reels/Shorts (9:16) or LinkedIn?
