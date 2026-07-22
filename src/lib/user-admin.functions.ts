import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; active: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;

    // Verify caller is admin (via RLS-safe RPC)
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

    if (data.userId === callerId && !data.active) {
      throw new Error("No puedes desactivar tu propio usuario");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Flip flag in profiles (clients subscribe to this to auto-logout)
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ active: data.active })
      .eq("id", data.userId);
    if (upErr) throw new Error(upErr.message);

    // Ban / unban in auth to block new logins and refresh
    const banDuration = data.active ? "none" : "876000h";
    // @ts-expect-error - ban_duration is a valid admin API field
    const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(
      data.userId,
      { ban_duration: banDuration }
    );
    if (banErr) throw new Error(banErr.message);

    // Revoke existing sessions when deactivating so active tokens die immediately
    if (!data.active) {
      try {
        await supabaseAdmin.auth.admin.signOut(data.userId, "global");
      } catch {
        // best effort — some SDK versions don't accept the scope arg
      }
    }

    return { ok: true };
  });
