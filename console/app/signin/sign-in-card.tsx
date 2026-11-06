"use client";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requestLink } from "../actions";

const LINK_MS = 10 * 60_000;
const RESEND_MS = 60_000;
type State = { sent?: boolean; at?: number; error?: string };

/** One button; after it, a countdown for the link's 10 minutes and a resend after one. */
export function SignInCard({ email }: { email: string }) {
  const [state, send, pending] = useActionState<State>(async () => ({ ...(await requestLink()), at: Date.now() }), {});
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!state.sent) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.sent]);
  const left = state.sent && state.at ? Math.max(0, state.at + LINK_MS - now) : 0;
  const canResend = !state.sent || (state.at ?? 0) + RESEND_MS <= now;
  const mmss = `${Math.floor(left / 60_000)}:${String(Math.floor((left % 60_000) / 1000)).padStart(2, "0")}`;

  return (
    <Card data-testid="sign-in" className="w-full max-w-float">
      <CardHeader>
        <CardTitle className="text-2xl">{state.sent ? "Check your inbox" : "Sign in"}</CardTitle>
        <CardDescription>
          {state.sent ? (
            <>We sent a one-time link to <b className="text-foreground">{email}</b>. Open it on this computer.</>
          ) : (
            <>A one-time link goes to <b className="text-foreground">{email}</b>. Only that address can open the console.</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {state.sent ? (
          <div className="grid gap-1 rounded-xl border border-border bg-muted/40 p-4" role="status">
            <span className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">The link works for</span>
            <span className="font-mono text-4xl font-semibold tabular-nums">{left ? mmss : "expired"}</span>
          </div>
        ) : null}
        <form action={send}>
          <Button data-testid="send-link" type="submit" size="lg" className="w-full" disabled={pending || !canResend} variant={state.sent ? "outline" : "default"}>
            {pending ? "Sending…" : state.sent ? (canResend ? "Send a new link" : "You can resend in a minute") : "Email me a sign-in link"}
          </Button>
        </form>
        {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
        <p className="text-xs text-muted-foreground">The console runs only on this computer. Sign-ups are off.</p>
      </CardContent>
    </Card>
  );
}
