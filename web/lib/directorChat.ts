import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ChatRequest, DirectorReply } from "./chat";
import { callDirector, DirectorError, responseText } from "./director";
import { beatRanges, fitText, SHOT_TYPE_LABEL, targetSeconds } from "./plan";

const SYSTEM = `You are the Director in ViralDirector, coaching a solo creator — often a teenager — through planning and filming one short vertical video. You speak like a warm, direct film director on set.

How to answer:
- Plain words. If you use a filmmaking term, explain it in the same sentence.
- Short: 2–5 sentences unless the creator asks for more. Lead with the answer or the single most useful fix.
- Be specific to their video: use the plan, the shot and the measurements in <context>. Never invent details you weren't given.
- Stay on making this video. If asked about something unrelated, answer in one line at most and steer back.
- No emoji, no markdown headings, no bullet lists longer than 3 items.

Modes (given in <context>):
- ask: answer the question. Set verdict to "none" and suggestedLine to "".
- line: the creator edited a line. Judge whether it still does its beat's job, sounds natural spoken aloud, and fits the shot's seconds (people speak about 2.5–3 words per second). If you can make it clearly better, put one rewrite in suggestedLine — same meaning, the creator's voice, no quotes. Otherwise "". verdict is "none".
- take: review a recorded take. Images are frames from the take, center-cropped to 9:16 as viewers will see them. Audio numbers come from the browser; the transcript comes from browser speech recognition and may have small errors. Set verdict to "keep" or "retake", then give the one fix that matters most and at most two short extra tips. Only judge what the frames, numbers and transcript show — you cannot hear the audio itself.
  Comment on framing, lighting, eye contact, expression, energy and background. Never comment on the creator's body, looks or clothing, except to say something in frame is distracting.`;

const ReplySchema = z.object({
  reply: fitText(3000),
  suggestedLine: fitText(400, 0),
  verdict: z.enum(["keep", "retake", "none"]),
});

const REPLY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "suggestedLine", "verdict"],
  properties: {
    reply: { type: "string" },
    suggestedLine: { type: "string" },
    verdict: { type: "string", enum: ["keep", "retake", "none"] },
  },
};

const pct = (n: number | null) => (n === null ? "not measured" : `${Math.round(n * 100)}%`);

function contextBlock(req: ChatRequest): string {
  const { brief, plan, hook, step, shot, originalLine } = req.context;
  const ranges = beatRanges(plan);
  const lines = [
    `mode: ${req.mode}`,
    `current step: ${step}`,
    `concept: ${brief.concept}`,
    ...(brief.story ? [`approved story the plan was built from:\n${brief.story}`] : []),
    `goal: ${brief.goal} · platform: ${brief.platform} · audience: ${brief.audience} · target length: ${targetSeconds(brief)}s`,
    `chosen hook (${plan.hooks[hook].kind}): ${plan.hooks[hook].line}`,
    "beats:",
    ...plan.beats.map((b, i) => `  ${ranges[i]} ${b.label}: ${b.line}`),
    "shots:",
    ...plan.shots.map((s, i) => `  ${i + 1}. ${s.title} (${SHOT_TYPE_LABEL[s.type]}, ${s.seconds}s${s.required ? "" : ", optional"})`),
  ];
  if (shot !== null && plan.shots[shot]) {
    const s = plan.shots[shot];
    lines.push(
      `current shot: ${shot + 1}. ${s.title}`,
      `  type: ${SHOT_TYPE_LABEL[s.type]} · size: ${s.size} · location: ${s.location} · ${s.seconds}s`,
      `  framing: ${s.framing}`,
      `  lighting: ${s.lighting}`,
      `  delivery: ${s.delivery}`,
      `  line: ${s.line || "(no line)"}`,
    );
    if (originalLine !== null && originalLine !== s.line) lines.push(`  original line before the creator's edit: ${originalLine || "(no line)"}`);
  }
  if (req.take) {
    const t = req.take;
    lines.push(
      `take ${t.takeNumber} (${t.source === "upload" ? "uploaded clip" : "recorded in the app"}):`,
      `  duration: ${t.seconds.toFixed(1)}s`,
      `  peak level: ${pct(t.peak)} · share of audio clipping: ${pct(t.clipped)} · share with speech-level audio: ${pct(t.voiced)}`,
      `  transcript: ${t.transcript ?? "(not available)"}`,
      `  frames attached: ${t.frames.length}`,
    );
  }
  return lines.join("\n");
}

/** Keeps only complete question → answer pairs, so every answer stays with its own question. */
function cleanHistory(history: ChatRequest["history"]): Anthropic.Beta.BetaMessageParam[] {
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  for (let i = 0; i + 1 < history.length; i++) {
    if (history[i].role === "user" && history[i + 1].role === "assistant") {
      out.push({ role: "user", content: history[i].text }, { role: "assistant", content: history[i + 1].text });
      i++;
    }
  }
  return out;
}

export async function askDirector(req: ChatRequest): Promise<DirectorReply> {
  const images: Anthropic.Beta.BetaContentBlockParam[] = (req.take?.frames ?? []).map((data) => ({
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data },
  }));

  const response = await callDirector(
    {
      max_tokens: 8000,
      output_config: {
        effort: req.mode === "take" ? "medium" : "low",
        format: { type: "json_schema", schema: REPLY_JSON_SCHEMA },
      },
      system: SYSTEM,
      messages: [
        ...cleanHistory(req.history),
        {
          role: "user",
          content: [
            ...images,
            { type: "text", text: `<context>\n${contextBlock(req)}\n</context>\n\n${req.message}` },
          ],
        },
      ],
    },
    "answer",
  );

  let json: unknown;
  try {
    json = JSON.parse(responseText(response));
  } catch {
    throw new DirectorError("The Director’s answer came back garbled. Try again.", 502);
  }
  const parsed = ReplySchema.safeParse(json);
  if (!parsed.success) throw new DirectorError("The Director’s answer came back incomplete. Try again.", 502);
  const r = parsed.data;
  return {
    reply: r.reply,
    suggestedLine: req.mode === "line" ? r.suggestedLine.trim() : "",
    verdict: req.mode === "take" ? r.verdict : "none",
  };
}

// Exported for tests.
export { contextBlock, cleanHistory };
