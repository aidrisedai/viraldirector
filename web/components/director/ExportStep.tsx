import { useMemo, useState } from "react";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { Icon } from "@/components/ds/Icon";
import { plannedSeconds, SHOT_TYPE_LABEL, type Brief, type Plan } from "@/lib/plan";
import { exportChecks, scriptText, slug, takeFileName, type Take } from "@/lib/takes";
import { fixDuration } from "./useRecorder";
import s from "./director.module.css";

type Props = { plan: Plan; brief: Brief; hook: number; kept: (Take | undefined)[]; onGoToShot: (i: number) => void };

function download(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

export function ExportStep({ plan, brief, hook, kept, onGoToShot }: Props) {
  const checks = exportChecks(plan, brief, kept);
  const ready = checks.every((c) => c.ok);
  // Rough cut: kept takes in script order, played back to back.
  const cut = useMemo(() => kept.flatMap((t, i) => (t ? [{ take: t, shot: plan.shots[i] }] : [])), [kept, plan]);
  const [clip, setClip] = useState(0);
  const current = cut[Math.min(clip, cut.length - 1)];

  const downloadTakes = async () => {
    for (const { take, shot } of cut) {
      download(take.url, takeFileName(take, shot));
      await new Promise((r) => setTimeout(r, 400)); // Browsers drop rapid back-to-back downloads.
    }
  };

  const downloadScript = () => {
    const url = URL.createObjectURL(new Blob([scriptText(brief.concept, plan, hook)], { type: "text/plain" }));
    download(url, `${slug(brief.concept)}-script.txt`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <main data-screen-label="06 Export" className={s.main}>
      <div className={s.mid}>
        <div className={s.preview}>
          {current ? (
            <>
              <video
                key={current.take.id}
                className={s.takeVideo}
                src={current.take.url}
                controls
                playsInline
            onLoadedMetadata={fixDuration}
                onEnded={() => setClip((c) => (c + 1 < cut.length ? c + 1 : 0))}
                autoPlay={clip > 0}
              />
              <span className={s.mediaCaption} style={{ top: 14, left: 16 }}>
                ROUGH CUT · {Math.min(clip, cut.length - 1) + 1} OF {cut.length}
              </span>
            </>
          ) : (
            <div className={s.cameraLabel} style={{ color: "var(--vd-text-muted)" }}>KEEP A TAKE TO SEE YOUR ROUGH CUT</div>
          )}
        </div>

        <div className={s.stack} style={{ gap: 28 }}>
          <div className={s.stack} style={{ gap: 10 }}>
            <Badge tone={ready ? "accent" : "warning"} dot={ready}>{ready ? "Ready to export" : "Not ready yet"}</Badge>
            <h1 className={s.exportTitle}>{clock(plannedSeconds(plan))} · {plan.shots.length} shots</h1>
          </div>

          <div className={s.checks}>
            {checks.map((c) => (
              <div key={c.label} className={s.check}>
                <Icon name={c.ok ? "check" : "x"} size={18} color={c.ok ? "var(--brand-accent)" : "var(--vd-warn-bar)"} />
                {c.label}
              </div>
            ))}
          </div>

          <div className={s.settings}>
            <div className={s.setting}>
              <span>Hook</span>
              <span className={s.muted}>{plan.hooks[hook].kind}</span>
            </div>
            {plan.shots.map((x, i) => (
              <button key={i} type="button" className={s.setting} onClick={() => onGoToShot(i)}>
                <span>{i + 1}. {x.title}</span>
                <span className={s.settingValue}>
                  {kept[i] ? `${SHOT_TYPE_LABEL[x.type]} · ${kept[i]!.seconds.toFixed(1)}s` : x.required ? "Missing" : "Skipped"}
                  <Icon name="chevron-right" size={18} color="var(--vd-text-muted)" />
                </span>
              </button>
            ))}
          </div>

          <div className={s.stack} style={{ gap: 10 }}>
            <div className={s.actions}>
              <Button size="lg" icon="download" onClick={downloadTakes} disabled={!cut.length}>
                Download {cut.length} {cut.length === 1 ? "take" : "takes"}
              </Button>
              <Button variant="outline" size="lg" onClick={downloadScript}>Download script</Button>
            </div>
            <span className={s.hint}>
              Takes download in script order, numbered by shot, ready to drop into your editor.
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
