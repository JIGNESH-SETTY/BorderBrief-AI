"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Lock,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Sparkles,
  UserCheck,
  CheckCircle2,
  Compass,
  FilePlus,
  Receipt,
  LogOut,
} from "lucide-react";
import { sanitizeReturnTo } from "@/lib/security/demo-auth";

function DemoLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawReturnTo = searchParams.get("returnTo");
  const returnTo = sanitizeReturnTo(rawReturnTo);

  const [passcode, setPasscode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGuestSubmitting, setIsGuestSubmitting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAlreadyAuthenticated, setIsAlreadyAuthenticated] = useState(false);

  // Check current authentication status
  useEffect(() => {
    let isMounted = true;
    async function checkAuth() {
      try {
        const res = await fetch("/api/demo/auth");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setIsAlreadyAuthenticated(Boolean(data.authenticated));
          }
        }
      } catch {
        // Fallback
      }
    }
    checkAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  // 1-Click Guest / Demo Account Access
  const handleContinueWithoutSignIn = async () => {
    setError(null);
    setIsGuestSubmitting(true);

    try {
      const res = await fetch("/api/demo/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to initialize guest demo session.");
        setIsGuestSubmitting(false);
        return;
      }

      setIsAlreadyAuthenticated(true);
      // Success: redirect directly to target page, or to /export/new if on root
      const target = returnTo === "/" ? "/export/new" : returnTo;
      router.push(target);
      router.refresh();
    } catch {
      setError("Network connection error. Please try again.");
      setIsGuestSubmitting(false);
    }
  };

  // Sign out / Reset Demo Session
  const handleSignOut = async () => {
    setError(null);
    setIsSigningOut(true);
    try {
      await fetch("/api/demo/auth", { method: "DELETE" });
      setIsAlreadyAuthenticated(false);
      router.refresh();
    } catch {
      setError("Failed to clear session.");
    } finally {
      setIsSigningOut(false);
    }
  };

  // Passcode-based Submission
  const handleSubmitPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/demo/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to unlock demo session with provided passcode.");
        setIsSubmitting(false);
        return;
      }

      setIsAlreadyAuthenticated(true);
      const target = returnTo === "/" ? "/export/new" : returnTo;
      router.push(target);
      router.refresh();
    } catch {
      setError("Network connection error. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-6 sm:py-10 max-w-xl mx-auto space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-[14px] bg-gradient-to-br from-sea to-ink text-white shadow-md shadow-sea/20 mb-2">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-text">
          BorderBrief AI — Demo Access
        </h1>
        <p className="text-sm text-mute max-w-md mx-auto">
          Explore our export preparation platform for Indian artisans, handicraft sellers, and MSMEs exporting to the United States.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-[14px] bg-rose-50 p-4 border border-rose-200 text-xs text-rose-800 flex items-start gap-3 shadow-sm animate-in fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block">Authentication Notice</span>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Already Authenticated Banner & Quick Actions */}
      {isAlreadyAuthenticated && (
        <div className="p-6 rounded-[22px] border border-mint/40 bg-mint-soft text-text space-y-4 shadow-sm animate-in fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-mint shadow-[0_0_0_4px_rgba(31,169,127,0.3)] animate-pulse" />
              <h2 className="font-heading text-lg font-bold text-[#0B7A5F]">
                Demo Session Active
              </h2>
            </div>
            <span className="text-[11px] font-mono text-[#0B7A5F] bg-white/70 px-2.5 py-0.5 rounded-full border border-mint/30 font-semibold">
              Evaluator Ready
            </span>
          </div>

          <p className="text-xs sm:text-sm text-mute leading-relaxed">
            You have unrestricted evaluator access. All calculation engines, official USITC 2026 tariff schedules, and invoice drafting features are unlocked.
          </p>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <Link
              href="/export/new"
              className="btn-p flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-bold text-xs shadow-sm"
            >
              <FilePlus className="w-4 h-4 text-[#1A1204]" />
              <span>Start New Export Assessment</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <Link
              href="/invoices"
              className="btn-g inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full font-semibold text-xs text-text"
            >
              <Receipt className="w-4 h-4 text-sea" />
              <span>View Saved Invoices</span>
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="btn-g inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full font-semibold text-xs text-mute hover:text-rose-600 hover:border-rose-200"
              title="Clear demo session cookie"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isSigningOut ? "Resetting..." : "Reset"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Primary Action Card: 1-Click Demo Account / Continue Without Sign In */}
      <div className="p-6 sm:p-7 rounded-[22px] border border-line bg-card shadow-lg space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-saffron-soft text-[#8A5200] font-semibold text-xs border border-saffron/30">
              <Sparkles className="w-3.5 h-3.5 text-saffron" />
              <span>Recommended for Fast Preview</span>
            </div>
            <h2 className="font-heading text-xl font-bold text-text pt-2">
              Demo Account (Instant Access)
            </h2>
            <p className="text-xs sm:text-sm text-mute leading-relaxed">
              Skip typing passwords. Click below to view the website fast with pre-calibrated export data, official USITC 2026 tariff schedules, and commercial invoice drafting.
            </p>
          </div>
        </div>

        {/* Demo Account Features */}
        <div className="p-4 rounded-[14px] bg-bg border border-line text-xs space-y-2.5">
          <div className="flex items-center justify-between text-text">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-sea" />
              <span className="font-bold text-text">Demo Evaluator Profile</span>
            </div>
            <span className="text-[10px] font-mono text-sea bg-sea-soft px-2.5 py-0.5 rounded-full font-semibold border border-sea/20">
              1-Click Pass
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11.5px] text-mute pt-1 border-t border-line">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-mint shrink-0" />
              <span>Full Access to Landed Cost Calculator</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-mint shrink-0" />
              <span>7 Sample Indian Artisan Profiles</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-mint shrink-0" />
              <span>Commercial Invoice Drafts &amp; PDFs</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-mint shrink-0" />
              <span>PayPal Sandbox Test Checkout</span>
            </div>
          </div>
        </div>

        {/* Big Call-to-Action Button */}
        <div>
          <button
            type="button"
            onClick={handleContinueWithoutSignIn}
            disabled={isGuestSubmitting || isSubmitting}
            className="btn-p w-full flex items-center justify-center gap-2 py-3 px-5 text-sm font-bold text-[#1A1204] rounded-full shadow-md shadow-saffron/30 transition-all hover:-translate-y-0.5"
          >
            {isGuestSubmitting ? (
              <span>Unlocking Demo Session...</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Continue without signing in</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
          <p className="text-[11px] text-mute text-center mt-2.5">
            No signup or credit card required • Instant ₹0 exploration
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="relative flex items-center justify-center">
        <div className="border-t border-line w-full" />
        <span className="bg-bg px-3 text-xs text-mute font-medium whitespace-nowrap">
          or enter evaluator passcode
        </span>
        <div className="border-t border-line w-full" />
      </div>

      {/* Secondary Card: Custom Passcode Entry */}
      <div className="p-6 sm:p-7 rounded-[22px] border border-line bg-card shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-text text-sm font-semibold">
          <Lock className="w-4 h-4 text-mute" />
          <span>Have a dedicated evaluator passcode?</span>
        </div>

        <form className="space-y-4" onSubmit={handleSubmitPasscode}>
          <div>
            <label
              htmlFor="passcode"
              className="block text-xs font-semibold text-text mb-1.5"
            >
              Demonstration Passcode
            </label>
            <input
              id="passcode"
              name="passcode"
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter passcode if provided"
              className="appearance-none block w-full px-4 py-2.5 border border-line rounded-full bg-bg text-text text-xs sm:text-sm placeholder:text-mute focus:outline-none focus:border-sea focus:ring-2 focus:ring-sea/20 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isGuestSubmitting || !passcode.trim()}
            className="btn-g w-full flex justify-center items-center py-2.5 px-4 text-xs font-semibold text-text rounded-full"
          >
            {isSubmitting ? "Verifying Passcode..." : "Unlock with Passcode"}
            {!isSubmitting && <ArrowRight className="w-3.5 h-3.5 ml-1.5" />}
          </button>
        </form>

        <div className="border-t border-line pt-3 flex items-center justify-between text-[11px] text-mute">
          <span className="flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-mute" />
            <span>Target Destination:</span>
            <span className="font-mono text-text">{returnTo}</span>
          </span>
          <Link href="/" className="text-sea hover:underline font-medium">
            Return to Homepage
          </Link>
        </div>
      </div>

      {/* Security Assurance Notice */}
      <div className="text-center text-xs text-mute flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-sea shrink-0" />
        <span>
          Demo sessions are secured via HttpOnly cookies. Secrets are never transmitted in URLs.
        </span>
      </div>
    </div>
  );
}

export default function DemoLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-xs text-mute">
          Loading verification form...
        </div>
      }
    >
      <DemoLoginForm />
    </Suspense>
  );
}
