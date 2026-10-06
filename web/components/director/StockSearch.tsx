"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ds/Button";
import type { Take } from "@/lib/takes";
import { takeFromFile } from "./useRecorder";
import s from "./director.module.css";

type Clip = { id: number; thumb: string; seconds: number; width: number; height: number; file: string; author: string; page: string };

let available: Promise<boolean> | null = null;
/** Whether the server has a stock library set up (asked once per page). */
const stockAvailable = () =>
  (available ??= fetch("/api/health", { cache: "no-store" })
    .then((r) => r.json())
    .then((h: { stock?: string }) => h.stock === "pexels")
    .catch(() => false));

/** A search phrase from a shot title: the nouns and verbs, without "your" and friends. */
export function stockQuery(title: string): string {
  return title
    .replace(/\b(your|my|our|the|a|an|of|on|in|at|to|with|for|and|you|me)\b/gi, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

type Props = { shot: number; title: string; onPick: (take: Take) => void };

/** Search free stock footage (Pexels) for a silent shot and use a clip as the take. */
export function StockSearch({ shot, title, onPick }: Props) {
  const [on, setOn] = useState<boolean | null>(null);
  const [q, setQ] = useState(() => stockQuery(title));
  const [results, setResults] = useState<Clip[] | null>(null);
  const [busy, setBusy] = useState<"search" | number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    stockAvailable().then((ok) => live && setOn(ok));
    return () => {
      live = false;
    };
  }, []);
  if (!on) return null;

  const search = async () => {
    if (q.trim().length < 2) return;
    setBusy("search");
    setError("");
    try {
      const res = await fetch(`/api/stock?q=${encodeURIComponent(q.trim())}`);
      const data = (await res.json()) as { results: Clip[] } | { error: string };
      if ("error" in data) throw new Error(data.error);
      setResults(data.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t search right now.");
    } finally {
      setBusy(null);
    }
  };

  const pick = async (c: Clip) => {
    setBusy(c.id);
    setError("");
    try {
      const res = await fetch(`/api/stock/file?u=${encodeURIComponent(c.file)}`);
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn’t download that clip.");
      const blob = await res.blob();
      const file = new File([blob], `pexels-${c.id}.mp4`, { type: blob.type || "video/mp4" });
      const take = await takeFromFile(file, shot);
      onPick({ ...take, origin: "stock", credit: `Video by ${c.author} on Pexels` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t use that clip.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={s.stack} style={{ gap: 12 }}>
      <span className={s.label}>Stock footage</span>
      <span className={s.hint}>Real clips from Pexels, free to use. Good for places, objects and moods — not for your students or your results.</span>
      <form
        className={s.stockForm}
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <input className={s.extraNote} aria-label="Search stock footage" value={q} maxLength={100} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" variant="outline" size="sm" disabled={busy !== null || q.trim().length < 2}>
          {busy === "search" ? "Searching…" : "Search"}
        </Button>
      </form>
      {error && <p className={s.error} role="alert">{error}</p>}
      {results && !results.length && <span className={s.hint}>Nothing found. Try simpler words, like “notebook” or “city at night”.</span>}
      {results && results.length > 0 && (
        <div className={s.stockGrid} aria-label="Stock clips">
          {results.map((c) => (
            <button key={c.id} type="button" className={s.stockItem} onClick={() => pick(c)} disabled={busy !== null} aria-label={`Use clip by ${c.author}, ${Math.round(c.seconds)} seconds`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- remote thumbnail from Pexels */}
              <img src={c.thumb} alt="" loading="lazy" />
              <span>{busy === c.id ? "Adding…" : `${Math.round(c.seconds)}s · ${c.author}`}</span>
            </button>
          ))}
        </div>
      )}
      {results && <a className={s.tiny} href="https://www.pexels.com" target="_blank" rel="noreferrer">Videos provided by Pexels</a>}
    </div>
  );
}
