"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Close is final for everyone in the room, so it takes a second, deliberate press. */
export function ConfirmClose({ action }: { action: () => Promise<void> }) {
  const [armed, setArmed] = useState(false);
  if (!armed) return <Button data-testid="close-room" variant="outline" type="button" onClick={() => setArmed(true)}>Close the room</Button>;
  return (
    <form action={action} className="flex gap-2">
      <Button data-testid="close-room-confirm" variant="destructive" type="submit">Close for everyone</Button>
      <Button data-testid="close-room-cancel" variant="ghost" type="button" onClick={() => setArmed(false)}>Keep open</Button>
    </form>
  );
}
