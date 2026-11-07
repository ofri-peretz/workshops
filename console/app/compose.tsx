import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Group } from "@/lib/groups";
import type { Chapter } from "@/lib/room";

/** Build a session from chapters of any workshop. A group's seen chapters are marked, so a returning group gets something new. */
export function Compose({ chapters, groups }: { chapters: Chapter[]; groups: Group[] }) {
  if (!chapters.length) return null;
  const seen = new Map(groups.flatMap((g) => g.chapters.map((c) => [c, g.label] as const)));
  return (
    <Card data-testid="compose">
      <CardHeader>
        <CardTitle>Or compose one</CardTitle>
        <CardDescription>Pick chapters from any workshop. Welcome and wrap-up are added; up to 3 hours.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Label className="grid gap-2">
            <span>Title</span>
            <Input data-testid="compose-title" name="title" maxLength={40} placeholder="Monitoring and performance" />
          </Label>
          <Label className="grid gap-2">
            <span>Group (private, on this laptop)</span>
            <Input data-testid="compose-group" name="group" maxLength={60} list="groups" placeholder="Who's in the room" />
            <datalist id="groups">{groups.map((g) => <option key={g.label} value={g.label}>{`last ${g.last}`}</option>)}</datalist>
          </Label>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {chapters.map((c) => (
            <li key={c.id}>
              <Label className="flex items-start gap-3 font-normal">
                <Checkbox data-testid={`compose-${c.id}`} name="c" value={c.id} className="mt-0.5" />
                <span className="grid gap-0.5">
                  <span className="font-medium">{c.name} · {c.min} min</span>
                  <span className="text-sm text-muted-foreground">{c.q} · {c.in.map((x) => x.title).join(", ")}</span>
                  {seen.has(c.id) ? <Badge data-testid={`compose-${c.id}-seen`} variant="secondary">Seen by {seen.get(c.id)}</Badge> : null}
                </span>
              </Label>
            </li>
          ))}
        </ul>
        <Button data-testid="compose-go-live" type="submit" name="compose" value="1">Go live with these chapters</Button>
      </CardContent>
    </Card>
  );
}
