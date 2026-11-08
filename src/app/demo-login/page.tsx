"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation.js";
import { Lock, ShieldCheck, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "../../components/ui/button.tsx";
import { Card } from "../../components/ui/card.tsx";

function DemoLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/";

  const [passcode, setPasscode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
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
        setError(data.error || "Failed to unlock demo session.");
        setIsSubmitting(false);
        return;
      }

      // Success: redirect to target page
      router.push(returnTo);
      router.refresh();
    } catch {
      setError("Network connection error. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <Lock className="w-6 h-6" />
          </div>
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">
          BorderBrief AI — Demo Access
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          This cloud prototype is protected for hackathon evaluation.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="py-8 px-6 sm:px-10 shadow-lg border-slate-200">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="passcode"
                className="block text-sm font-medium text-slate-700"
              >
                Demonstration Passcode
              </label>
              <div className="mt-1">
                <input
                  id="passcode"
                  name="passcode"
                  type="password"
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter evaluator passcode"
                  className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-rose-50 p-3 border border-rose-200 text-sm text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <Button
                type="submit"
                disabled={isSubmitting || !passcode}
                className="w-full flex justify-center py-2.5 px-4"
              >
                {isSubmitting ? "Verifying..." : "Unlock Demonstration"}
                {!isSubmitting && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            </div>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-4">
            <div className="flex items-start gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>
                Demonstration sessions are secured via HttpOnly browser cookies. Secrets are never passed in URLs.
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function DemoLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
          Loading verification form...
        </div>
      }
    >
      <DemoLoginForm />
    </Suspense>
  );
}
