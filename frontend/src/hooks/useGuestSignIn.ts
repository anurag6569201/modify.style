/**
 * useGuestSignIn — one place for the "sign in with Google" popup used by the
 * guest-conversion nudges (Header, Dashboard, Render, UpgradeDialog).
 *
 * Because @react-oauth/google uses a popup, the calling page stays mounted, so
 * any in-memory recording is still available to migrate into the new account.
 */

import { useRef } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/lib/auth";
import { hasGuestDraft, migrateGuestDraft } from "@/lib/guest/guestSession";

export interface GuestSignInOptions {
  /** In-memory recorded video to migrate to the new account, if available. */
  videoBlob?: Blob | null;
  videoFilename?: string;
  /** Called after a successful sign-in (and draft migration attempt). */
  onSuccess?: (info: { migratedProjectId: string | null }) => void;
  onError?: () => void;
}

export function useGuestSignIn() {
  const { signIn } = useAuth();
  const optsRef = useRef<GuestSignInOptions | undefined>(undefined);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const opts = optsRef.current;
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/google/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: tokenResponse.access_token }),
        });
        if (!res.ok) throw new Error("Authentication failed");
        const data = await res.json();
        await signIn(data.access, data.refresh);

        let migratedProjectId: string | null = null;
        if (hasGuestDraft()) {
          migratedProjectId = await migrateGuestDraft(
            opts?.videoBlob ?? null,
            opts?.videoFilename
          );
        }

        toast.success("You're signed in", {
          description: migratedProjectId
            ? "Your demo has been saved to your account."
            : "Welcome to DemoForge!",
        });
        opts?.onSuccess?.({ migratedProjectId });
      } catch (err) {
        console.error("[GuestSignIn] failed:", err);
        toast.error("Sign in failed", {
          description: "Could not sign in with Google. Please try again.",
        });
        opts?.onError?.();
      }
    },
    onError: () => {
      toast.error("Sign in failed", {
        description: "Google sign in was cancelled or failed.",
      });
      optsRef.current?.onError?.();
    },
  });

  /** Trigger the Google sign-in popup. */
  return (opts?: GuestSignInOptions) => {
    optsRef.current = opts;
    login();
  };
}
