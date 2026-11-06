// Vercel Function: every /api/* request lands here (see vercel.json). The store's replica lives in
// module scope, so a warm instance only fetches events it hasn't seen.
import { createHandler } from "../handler.mjs";
import { supabaseStore } from "../store.mjs";

const handle = createHandler({
  store: supabaseStore({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_KEY }),
  token: process.env.PRESENTER_TOKEN,
});
export const GET = handle;
export const POST = handle;
