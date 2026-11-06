"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** "in 42 min", ticking each second; refreshes the page when time runs out so the state follows. */
export function Countdown({ until }: { until: string | null }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = until ? Date.parse(until) - now : 0;
  useEffect(() => {
    if (until && left <= 0) router.refresh();
  }, [until, left <= 0, router]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!until) return <span>—</span>;
  if (left <= 0) return <span>now</span>;
  const m = Math.floor(left / 60_000), s = Math.floor((left % 60_000) / 1000);
  return <span className="tabular-nums">in {m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min ${String(s).padStart(2, "0")} s`}</span>;
}
