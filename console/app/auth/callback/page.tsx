"use client";
import { useEffect, useState } from "react";

/** Lands from the emailed link: Supabase puts the session in the URL fragment, which never reaches a server log. */
export default function Callback() {
  const [message, setMessage] = useState("Signing you in…");
  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    if (p.get("error_description")) { setMessage(`${p.get("error_description")}. Request a new link.`); return; }
    fetch("/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ access_token: p.get("access_token"), refresh_token: p.get("refresh_token"), expires_in: p.get("expires_in") }),
    }).then(async (r) => {
      history.replaceState(null, "", "/auth/callback");
      if (r.ok) window.location.replace("/");
      else setMessage((await r.json().catch(() => ({}))).error ?? "Sign-in failed. Request a new link.");
    });
  }, []);
  return (
    <main className="mx-auto grid max-w-md gap-4 px-4 py-24">
      <p role="status">{message}</p>
      <a className="underline" href="/signin">Back to sign-in</a>
    </main>
  );
}
