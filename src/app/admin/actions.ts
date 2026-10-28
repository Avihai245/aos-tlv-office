"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getViewer } from "@/lib/data";
import { emailOk, phoneOk } from "@/lib/format";

type Result = { err?: string; userId?: string; existing?: boolean };

/**
 * Creates (or finds) a confirmed account with a temporary password. Needs the service role key, so it runs only here,
 * after checking that the caller is an admin. The caller then links the account to an office or promotes it.
 */
export async function createAccount(input: { email: string; name: string; phone: string; password: string; minPassword: number }): Promise<Result> {
  const viewer = await getViewer();
  if (viewer?.role !== "admin") return { err: "auth" };
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return { err: "service" };

  const email = input.email.trim().toLowerCase();
  if (!emailOk(email)) return { err: "email" };

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: found } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (found) return { userId: found.id, existing: true };

  if (!input.name.trim()) return { err: "name" };
  if (input.phone && !phoneOk(input.phone)) return { err: "phone" };
  if (input.password.length < input.minPassword) return { err: "weak" };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name.trim(), phone: input.phone.trim() },
  });
  if (error || !data.user) return { err: "gen" };
  return { userId: data.user.id };
}

/** Finds a registered account by email, for linking an existing person to an office or to the admin team. */
export async function findAccount(emailRaw: string): Promise<{ id?: string; name?: string; role?: string; err?: string }> {
  const viewer = await getViewer();
  if (viewer?.role !== "admin") return { err: "auth" };
  const email = emailRaw.trim().toLowerCase();
  if (!emailOk(email)) return { err: "email" };
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id,name,role").eq("email", email).maybeSingle();
  return data ? { id: data.id, name: data.name, role: data.role } : { err: "nf" };
}
