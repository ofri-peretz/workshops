import "server-only";

const need = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing. Copy console/.env.example to console/.env.local and fill it in.`);
  return v;
};

export const env = {
  supabaseUrl: () => need("SUPABASE_URL"),
  anonKey: () => need("SUPABASE_ANON_KEY"),
  ownerEmail: () => need("OWNER_EMAIL"),
  codeSecret: () => need("CODE_SECRET"),
  presenterToken: () => need("PRESENTER_TOKEN"),
  relayUrl: () => need("RELAY_URL").replace(/\/$/, ""),
  phoneUrl: () => need("PHONE_URL"),
};
