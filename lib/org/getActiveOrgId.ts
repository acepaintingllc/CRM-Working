import { supabaseBrowser } from "@/lib/supabase/client";

export async function getActiveOrgId(): Promise<string> {
  const { data: authData, error: authErr } = await supabaseBrowser.auth.getSession();
  if (authErr) throw authErr;
  const userId = authData.session?.user?.id;
  if (!userId) throw new Error("Not signed in.");

  // Assumption: solo right now => first membership
  const { data, error } = await supabaseBrowser
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.org_id) throw new Error("No org membership found. Run bootstrap.");

  return data.org_id;
}
