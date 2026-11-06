"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import { accessToken, clearSession, sendSignInLink } from "@/lib/session";
import { closeRoom, goLive, newJoinCode } from "@/lib/room";

const signedIn = async () => {
  const jwt = await accessToken();
  if (!jwt) redirect("/signin");
  return jwt;
};

export async function requestLink(): Promise<{ sent?: boolean; error?: string }> {
  try {
    await sendSignInLink(env.ownerEmail());
    return { sent: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function goLiveAction(form: FormData) {
  await goLive(await signedIn(), String(form.get("workshop") || "1"));
  revalidatePath("/");
}

export async function newCodeAction() {
  await newJoinCode(await signedIn());
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
