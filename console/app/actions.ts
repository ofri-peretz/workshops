"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import { accessToken, clearSession, sendSignInLink } from "@/lib/session";
import { closeRoom, goLive, newJoinCode, readChapters, relayControl } from "@/lib/room";
import { rememberGroup } from "@/lib/groups";

const signedIn = async () => {
  const jwt = await accessToken();
  if (!jwt) redirect("/signin");
  return jwt;
};

export async function requestLink(): Promise<{ sent?: boolean; error?: string }> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:4180";
    await sendSignInLink(env.ownerEmail(), `${host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"}://${host}`);
    return { sent: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function goLiveAction(form: FormData) {
  const jwt = await signedIn();
  const intro = String(form.get("intro") || "first"), audience = String(form.get("audience") || "tech");
  const names = form.get("names") === "named" ? "named" : "anonymous", voters = names === "named" && form.get("voters") === "on";
  const group = String(form.get("group") || "").trim().slice(0, 60);
  if (form.get("compose")) {
    const parts = form.getAll("c").map(String);
    // ponytail: the wrap-up is always Signals' (Monday questions, next, Q&A); pick per program if it matters
    const chapters = ["welcome", ...parts, "sig-close"];
    const title = String(form.get("title") || "").trim() || "Monitoring and performance";
    await goLive(jwt, "5", { intro, audience, chapters, title, names, voters });
    if (group) await rememberGroup(group, parts);
  } else {
    const w = String(form.get("workshop") || "1");
    await goLive(jwt, w, { intro, audience, names, voters });
    if (group) await rememberGroup(group, (await readChapters()).filter((c) => c.in.some((x) => String(x.w) === w)).map((c) => c.id));
  }
  revalidatePath("/");
}

export async function beginAction() {
  await signedIn();
  await relayControl({ op: "begin" });
  revalidatePath("/");
}

export async function newCodeAction() {
  await newJoinCode(await signedIn());
  revalidatePath("/");
}

/** A new code, and every phone out: each must enter the new code to come back. The room stays on its step. */
export async function signOutAllAction() {
  const jwt = await signedIn();
  await newJoinCode(jwt);
  await relayControl({ op: "signout" });
  revalidatePath("/");
}

export async function closeAction() {
  await closeRoom(await signedIn());
  revalidatePath("/");
}

export async function signOutAction() {
  await clearSession();
  redirect("/signin");
}
