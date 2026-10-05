import { CAPTION_SIZES, type EditPlan, type Style } from "./editPlan";

// When the Director isn't connected, common feedback still works: these rules cover the look
// (captions, motion, transitions, title, music level). Anything else needs the Director.

type Result = { style: Style; plan: EditPlan; changes: string[] };

const has = (text: string, re: RegExp) => re.test(text);

export function reviseLocally(feedback: string, style: Style, plan: EditPlan): Result {
  const f = feedback.toLowerCase();
  const next: Style = { ...style };
  let nextPlan = plan;
  const changes: string[] = [];
  const captionWord = /(caption|subtitle|text|words)/;

  // Music level.
  if (has(f, /music|song|sound|background/)) {
    if (has(f, /(no|remove|without|turn off|kill)\s+(the\s+)?(music|song|background)/)) {
      next.musicVolume = 0;
      changes.push("turned the music off");
    } else if (has(f, /(quiet|lower|softer|down|too loud|distract|reduce|less)/)) {
      next.musicVolume = Math.max(0.15, Math.round((style.musicVolume - 0.25) * 100) / 100);
      changes.push("lowered the music");
    } else if (has(f, /(louder|up|more|raise|increase|can'?t hear)/)) {
      next.musicVolume = Math.min(1, Math.round((style.musicVolume + 0.2) * 100) / 100);
      changes.push("raised the music (it still stays under your voice)");
    }
  }

  // Captions.
  if (has(f, /(no|remove|hide|turn off|without)\s+(the\s+)?(captions|subtitles)/)) {
    next.captions = "Off";
    changes.push("turned captions off");
  } else {
    const picked = (["Karaoke", "Bold", "Minimal", "Pop"] as const).find((c) => f.includes(c.toLowerCase()));
    if (picked) {
      next.captions = picked;
      changes.push(`switched to ${picked} captions`);
    } else if (style.captions === "Off" && has(f, /(add|show|turn on|put)\s+(the\s+)?(captions|subtitles)/)) {
      next.captions = "Pop";
      changes.push("turned captions on");
    }
    const i = CAPTION_SIZES.indexOf(style.captionSize);
    if (has(f, /(bigger|larger|too small|can'?t read|increase)/) && has(f, captionWord) && i < 2) {
      next.captionSize = CAPTION_SIZES[i + 1];
      changes.push("made the captions bigger");
    } else if (has(f, /(smaller|too big|too large|huge)/) && has(f, captionWord) && i > 0) {
      next.captionSize = CAPTION_SIZES[i - 1];
      changes.push("made the captions smaller");
    }
    if (has(f, captionWord) && has(f, /(lower|bottom|move (it |them )?down|cover(s|ing)? my face|over my face|blocking)/)) {
      next.captionPosition = "Lower";
      changes.push("moved the captions lower");
    } else if (has(f, captionWord) && has(f, /(middle|center|centre|higher|move (it |them )?up)/)) {
      next.captionPosition = "Middle";
      changes.push("moved the captions to the middle");
    }
  }

  // Motion and transitions.
  if (has(f, /(calm|less zoom|too much zoom|too much movement|less movement|dizzy|shaky|too busy|slower)/)) {
    next.energy = "Calm";
    changes.push("calmed the camera movement");
  } else if (has(f, /(more energy|punchier|more exciting|faster|more zoom|boring|more dynamic|hype)/)) {
    next.energy = "Punchy";
    if (style.transition === "Cut") next.transition = "Whip";
    changes.push("added more energy");
  }
  const transition = (
    [
      [/whip/, "Whip", "used whip transitions"],
      [/zoom transition/, "Zoom", "used zoom transitions"],
      [/(no flash|hard cut|plain cut|simple cut|clean cut)/, "Cut", "used clean cuts"],
      [/flash/, "Flash", "used flash transitions"],
    ] as const
  ).find(([re]) => has(f, re));
  if (transition) {
    next.transition = transition[1];
    changes.push(transition[2]);
  }

  // Title.
  if (has(f, /(no|remove|hide|without)\s+(the\s+)?(title|hook text|text at the (start|beginning))/)) {
    next.showTitle = false;
    changes.push("removed the opening title");
  }

  // Callouts.
  if (has(f, /(no|remove|fewer|less)\s+(the\s+)?(callouts|pop-?ups|on-screen text)/) && plan.callouts.length) {
    nextPlan = { ...plan, callouts: has(f, /(fewer|less)/) ? plan.callouts.slice(0, Math.ceil(plan.callouts.length / 2)) : [] };
    changes.push(has(f, /(fewer|less)/) ? "cut the callouts down" : "removed the callouts");
  }

  return { style: next, plan: nextPlan, changes };
}
