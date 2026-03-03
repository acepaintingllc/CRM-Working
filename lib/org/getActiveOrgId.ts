import { supabaseBrowser } from "@/lib/supabase/client";
import { authedFetch } from "@/lib/auth/authedFetch";

async function fetchOrgMembership(token: string) {
  const res = await fetch("/api/bootstrap-org/api/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(payload?.error ?? "Failed to fetch org membership.");
  }
  return payload as { org_id: string | null; role?: string | null };
}

export async function getActiveOrgId(): Promise<string> {
  const { data: authData, error: authErr } = await supabaseBrowser.auth.getSession();
  if (authErr) throw authErr;
  const session = authData.session;
  const userId = session?.user?.id;
  const token = session?.access_token;
  if (!userId || !token) throw new Error("Not signed in.");

  let membership = await fetchOrgMembership(token);

  if (!membership?.org_id) {
    const bootRes = await authedFetch("/api/bootstrap-org", {
      method: "POST",
    });
    const bootPayload = await bootRes.json().catch(() => null);
    if (!bootRes.ok) {
      throw new Error(bootPayload?.error ?? "Failed to bootstrap org.");
    }

    membership = await fetchOrgMembership(token);
  }

  if (!membership?.org_id) throw new Error("No org membership found. Run bootstrap.");

  return membership.org_id;
}
