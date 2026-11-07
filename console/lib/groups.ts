import "server-only";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** What each group has seen: kept in a file on the presenter's laptop only (gitignored), never in the relay's public log. */
export type Group = { label: string; chapters: string[]; last: string };
const FILE = join(process.cwd(), ".groups.json"); // the console runs from console/

export async function readGroups(): Promise<Group[]> {
  try {
    return JSON.parse(await readFile(FILE, "utf8"));
  } catch {
    return [];
  }
}

/** Adds this session's chapters to the group's history (creates the group the first time). */
export async function rememberGroup(label: string, chapters: string[]) {
  const groups = await readGroups();
  const g = groups.find((x) => x.label === label) ?? (groups.push({ label, chapters: [], last: "" }), groups.at(-1)!);
  g.chapters = [...new Set([...g.chapters, ...chapters])];
  g.last = new Date().toISOString().slice(0, 10);
  await writeFile(FILE, JSON.stringify(groups, null, 2) + "\n");
}
