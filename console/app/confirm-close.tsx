"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Signing everyone out takes a second, deliberate press: every phone must enter the new code. */
export function ConfirmSignOut({ action }: { action: () => Promise<void> }) {
  const [armed, setArmed] = useState(false);
  if (!armed) return <Button data-testid="signout-all" variant="outline" type="button" onClick={() => setArmed(true)}>Sign everyone out</Button>;
  return (
    <form action={action} className="flex gap-2">
      <Button data-testid="signout-all-confirm" variant="destructive" type="submit">New code, everyone out</Button>
      <Button data-testid="signout-all-cancel" variant="ghost" type="button" onClick={() => setArmed(false)}>Cancel</Button>
    </form>
  );
}

/** Restarting wipes the run's scores, so it is a deliberate second press, never on the projector. */
export function ConfirmReset({ action }: { action: () => Promise<void> }) {
  const [armed, setArmed] = useState(false);
  if (!armed) return <Button data-testid="reset-room" variant="outline" type="button" onClick={() => setArmed(true)}>Restart from step 1</Button>;
  return (
    <form action={action} className="flex gap-2">
      <Button data-testid="reset-room-confirm" variant="destructive" type="submit">Restart, scores cleared</Button>
      <Button data-testid="reset-room-cancel" variant="ghost" type="button" onClick={() => setArmed(false)}>Cancel</Button>
    </form>
  );
}

/** Close is final for everyone in the room, so it takes a second, deliberate press. */
export function ConfirmClose({ action }: { action: () => Promise<void> }) {
  const [armed, setArmed] = useState(false);
  if (!armed) return <Button data-testid="close-room" variant="outline" type="button" onClick={() => setArmed(true)}>Kick everyone out</Button>;
  return (
    <form action={action} className="flex gap-2">
      <Button data-testid="close-room-confirm" variant="destructive" type="submit">Close the room, everyone out</Button>
      <Button data-testid="close-room-cancel" variant="ghost" type="button" onClick={() => setArmed(false)}>Keep open</Button>
    </form>
  );
}
