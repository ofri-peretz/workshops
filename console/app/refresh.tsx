"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-reads the page on an interval, so the waiting count stays current. */
export function Refresh({ every }: { every: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), every);
    return () => clearInterval(id);
  }, [router, every]);
  return null;
}
