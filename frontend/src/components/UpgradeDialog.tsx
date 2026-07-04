/**
 * UpgradeDialog — the paywall nudge shown when a free/guest user hits a Pro
 * feature. Guests are asked to sign in first; signed-in free users get an
 * "Upgrade to Pro" button.
 *
 * NOTE: the upgrade currently flips the plan via a backend stub so Pro features
 * can be exercised end-to-end. Real checkout (Stripe) is a follow-up — wire it
 * into `handleUpgrade` when payment lands.
 */

import { useState } from "react";
import { Check, Sparkles, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestSignIn } from "@/hooks/useGuestSignIn";
import { FEATURE_LABELS, PLAN_FEATURES, type Feature } from "@/lib/entitlements";

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The feature that triggered the paywall (used for the headline). */
  feature?: Feature;
  title?: string;
  description?: string;
}

export function UpgradeDialog({
  open,
  onOpenChange,
  feature,
  title,
  description,
}: UpgradeDialogProps) {
  const { isAuthenticated, upgrade } = useAuth();
  const signIn = useGuestSignIn();
  const [upgrading, setUpgrading] = useState(false);

  const headline =
    title ??
    (feature
      ? `${FEATURE_LABELS[feature]} is a Pro feature`
      : "Upgrade to DemoForge Pro");

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      await upgrade();
      onOpenChange(false);
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle>{headline}</DialogTitle>
          <DialogDescription>
            {description ??
              "Unlock the full DemoForge toolkit and take your demos further."}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 py-2">
          {PLAN_FEATURES.pro.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 shrink-0 text-success" />
              <span>{FEATURE_LABELS[f]}</span>
            </li>
          ))}
        </ul>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {isAuthenticated ? (
            <Button
              variant="hero"
              className="w-full"
              onClick={handleUpgrade}
              disabled={upgrading}
            >
              {upgrading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Upgrade to Pro
            </Button>
          ) : (
            <Button
              variant="hero"
              className="w-full"
              onClick={() => signIn({ onSuccess: () => onOpenChange(false) })}
            >
              Sign in to upgrade
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
