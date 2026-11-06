"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { requestLink } from "../actions";

export default function SignIn() {
  const [state, send, pending] = useActionState(async () => requestLink(), {} as { sent?: boolean; error?: string });
  return (
    <main className="mx-auto grid max-w-md gap-6 px-4 py-24">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold">Workshop console</h1>
        <p className="text-muted-foreground">We'll email a one-time sign-in link to the presenter's address. It works for 10 minutes.</p>
      </div>
      <form action={send}>
        <Button data-testid="send-link" type="submit" disabled={pending}>{pending ? "Sending…" : "Email me a sign-in link"}</Button>
      </form>
      <p role="status" className="text-sm">
        {state.sent ? "Sent. Open the link on this computer." : state.error ?? ""}
      </p>
    </main>
  );
}
