import { useMemo } from "react";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import type { Shot } from "@/lib/plan";
import { reviewTake, type Take } from "@/lib/takes";
import { fixDuration } from "./useRecorder";
import s from "./director.module.css";

type Props = {
  shot: Shot;
  index: number;
  take: Take;
  takeNumber: number;
  onRetake: () => void;
  onKeep: () => void;
  onAskDirector: () => void;
  askBusy: boolean;
};

export function ReviewStep({ shot, index, take, takeNumber, onRetake, onKeep, onAskDirector, askBusy }: Props) {
  const review = useMemo(() => reviewTake(take, shot), [take, shot]);
  const good = review.verdict === "accept";

  return (
    <main data-screen-label="05 Take review" className={s.main}>
      <div className={s.mid}>
        <div className={s.takePlayer}>
          <video
            key={take.id}
            className={s.takeVideo}
            src={take.url}
            controls
            playsInline
            autoPlay
            onLoadedMetadata={fixDuration}
          />
          <span className={s.mediaCaption} style={{ top: 14, left: 16 }}>
            SHOT {index + 1} · TAKE {takeNumber} · {take.seconds.toFixed(1)}s
          </span>
        </div>

        <div className={s.stack} style={{ gap: 28 }}>
          <div className={s.stack} style={{ gap: 12 }}>
            <Badge tone={good ? "accent" : "warning"} dot={good}>
              {good ? "Director says keep it" : "Director suggests a retake"}
            </Badge>
            <h1 className={s.quote}>“{review.note}”</h1>
          </div>

          <div className={s.scores}>
            {review.checks.map((c) => (
              <div key={c.label} className={s.score}>
                <div className={s.scoreHead}>
                  <span>{c.label}</span>
                  <span className={c.warn ? s.warnText : s.muted}>{c.note}</span>
                </div>
                <div className={s.trackSoft}>
                  <div className={c.warn ? s.fillWarn : s.fill} style={{ width: `${c.value}%` }} />
                </div>
              </div>
            ))}
            {take.source === "upload" && <span className={s.hint}>Audio checks run on takes recorded here, not on uploads.</span>}
          </div>

          {take.transcript && (
            <div className={s.stack} style={{ gap: 6 }}>
              <span className={s.small}>What I heard</span>
              <span className={s.serifLine}>“{take.transcript}”</span>
            </div>
          )}

          <div className={s.askCard}>
            <div className={s.stack} style={{ gap: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 500 }}>Want a second opinion?</span>
              <span className={s.hint}>
                The Director looks at frames from this take{take.transcript ? ", what you said" : ""} and the audio checks, then
                tells you what to fix.
              </span>
            </div>
            <Button variant="outline" size="md" icon="message" onClick={onAskDirector} disabled={askBusy}>
              Ask the Director
            </Button>
          </div>

          <div className={s.actions}>
            {good ? (
              <>
                <Button size="lg" icon="check" onClick={onKeep}>Keep take</Button>
                <Button variant="outline" size="lg" icon="rotate-ccw" onClick={onRetake}>Retake</Button>
              </>
            ) : (
              <>
                <Button size="lg" icon="rotate-ccw" onClick={onRetake}>Retake</Button>
                <Button variant="outline" size="lg" onClick={onKeep}>Use this take anyway</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
