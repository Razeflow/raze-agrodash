import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  let body: { username?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const username = body.username?.trim().toLowerCase();
  const newPassword = body.newPassword;

  if (!username || !newPassword || newPassword.length < 4) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: callerProfile, error: callerErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (
    callerErr ||
    (callerProfile?.role !== "SUPER_ADMIN" && callerProfile?.role !== "ADMIN")
  ) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Server is missing Supabase service credentials." }, { status: 500 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: target, error: targetErr } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .single();

  if (targetErr || !target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const { error: updateErr } = await admin.auth.admin.updateUserById(target.id, {
    password: newPassword,
  });

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
