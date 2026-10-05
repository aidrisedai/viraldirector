import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { beatRanges, plannedSeconds, targetSeconds, type Brief, type Plan } from "@/lib/plan";
import { Term } from "./Term";
import s from "./director.module.css";

// Beat bar shades cycle through the brand's ink tones after the emerald hook.
const BEAT_COLORS = ["var(--black)", "var(--vd-text-muted)"];

type Props = { plan: Plan; brief: Brief; sample: boolean; hook: number; onPickHook: (i: number) => void; onNext: () => void };

export function PlanStep({ plan, brief, sample, hook, onPickHook, onNext }: Props) {
  const ranges = beatRanges(plan);

  return (
    <main data-screen-label="02 Plan" className={s.main}>
      <div className={`${s.wide} ${s.twoCol}`}>
        <div className={s.stack} style={{ gap: 24 }}>
          <div className={s.stack} style={{ gap: 10 }}>
            <span className={s.eyebrow}>PICK YOUR HOOK</span>
            <h1 className={s.h1}>The first 3 seconds decide everything.</h1>
            {sample && (
              <>
                <Badge tone="neutral">Sample plan</Badge>
                <span className={s.hint}>The Director isn’t connected yet, so this is the example plan, not one written for your concept.</span>
              </>
            )}
          </div>
          {plan.hooks.map((h, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={i === hook}
              className={`${s.hook} ${i === hook ? s.hookOn : ""}`}
              onClick={() => onPickHook(i)}
            >
              <div className={s.hookTop}>
                <span className={s.hookKind}>{h.kind.toUpperCase()}</span>
                <span className={s.hookTag}>{i === hook ? "Selected" : ""}</span>
              </div>
              <span className={s.hookLine}>{h.line}</span>
              <span className={s.hookWhy}>{h.why}</span>
            </button>
          ))}
        </div>

        <div className={s.stack} style={{ gap: 24 }}>
          <div className={`${s.card} ${s.stack}`} style={{ padding: 24, gap: 16 }}>
            <div className={s.beatHead}>
              <span style={{ fontSize: 17, fontWeight: 600 }}><Term word="Beat sheet" /></span>
              <span className={s.muted} style={{ fontSize: 14 }}>
                {targetSeconds(brief)}s target · {plannedSeconds(plan)}s planned
              </span>
            </div>
            <div className={s.beatBar} aria-hidden>
              {plan.beats.map((b, i) => (
                <div key={i} style={{ flex: b.seconds, background: i === 0 ? "var(--brand-accent)" : BEAT_COLORS[(i - 1) % 2] }} />
              ))}
            </div>
          </div>

          <div className={`${s.card} ${s.stack}`} style={{ padding: "8px 24px" }}>
            {plan.beats.map((b, i) => (
              <div key={i} className={s.beatRow}>
                <span className={`${s.beatLabel} ${i === 0 ? s.beatLabelHook : ""}`}>
                  <Term word={b.label.replace(/\s*[×x]\s*\d+$/, "")}>{b.label.toUpperCase()}</Term>
                </span>
                <span style={{ fontSize: 15, lineHeight: 1.5 }}>{b.line}</span>
                <span className={s.beatTime}>{ranges[i]}</span>
              </div>
            ))}
          </div>

          <div className={s.actionsEnd}>
            <Button size="lg" iconRight="arrow-right" onClick={onNext}>See shot list</Button>
          </div>
        </div>
      </div>
    </main>
  );
}
