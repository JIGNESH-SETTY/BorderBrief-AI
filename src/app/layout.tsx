import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { CorridorBadge } from "@/components/features/corridor-badge";
import { ShieldCheck, Compass, FilePlus, BookOpen, Receipt } from "lucide-react";

export const metadata: Metadata = {
  title: "BorderBrief AI — Know the Rules. Know the Cost. Ship with Confidence.",
  description:
    "An AI-powered international export-preparation platform for small businesses, independent exporters, and handicraft sellers in India exporting to the USA.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 antialiased selection:bg-sky-100 selection:text-sky-900">
        {/* Top Corridor Bar */}
        <div className="bg-slate-900 text-slate-300 text-xs py-1.5 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-medium text-slate-200">
                Initial Trade Corridor:
              </span>
              <span className="text-slate-400">
                India 🇮🇳 to United States 🇺🇸 (19 U.S.C. § 1401a Valuation)
              </span>
            </div>
            <div className="hidden md:flex items-center gap-4 text-slate-400">
              <span>USITC 2026 HTS Rev 22 Baseline</span>
              <span>•</span>
              <span className="text-emerald-400 font-medium">₹0 Zero-Cost First</span>
            </div>
          </div>
        </div>

        {/* Global Navigation Header */}
        <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            {/* Brand Logo & Tagline */}
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-sky-600/20 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold tracking-tight text-slate-950">
                      BorderBrief<span className="text-sky-600 font-extrabold">.AI</span>
                    </span>
                    <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                      v1.0 Ready
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 hidden sm:inline leading-none">
                    Know the Rules. Know the Cost. Ship with Confidence.
                  </span>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1 text-sm font-medium text-slate-600">
              <Link
                href="/"
                className="px-3 py-2 rounded-lg hover:text-sky-600 hover:bg-slate-100/70 transition-colors flex items-center gap-1.5"
              >
                <Compass className="w-4 h-4 text-slate-400" />
                <span>Overview</span>
              </Link>
              <Link
                href="/corridor/india-usa"
                className="px-3 py-2 rounded-lg hover:text-sky-600 hover:bg-slate-100/70 transition-colors flex items-center gap-1.5"
              >
                <BookOpen className="w-4 h-4 text-slate-400" />
                <span>Corridor Guide</span>
              </Link>
              <Link
                href="/invoices"
                className="px-3 py-2 rounded-lg hover:text-sky-600 hover:bg-slate-100/70 transition-colors flex items-center gap-1.5"
              >
                <Receipt className="w-4 h-4 text-slate-400" />
                <span>Invoices & Receipts</span>
              </Link>
            </nav>

            {/* Right Action Area */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
                <CorridorBadge />
              </div>
              <Link
                href="/export/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 shadow-sm transition-all"
              >
                <FilePlus className="w-4 h-4" />
                <span>Start New Export</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Application Body */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {children}
        </main>

        {/* Global Footer */}
        <footer className="border-t border-slate-200 bg-white py-8 text-xs text-slate-500 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold">
                BB
              </div>
              <span className="font-semibold text-slate-800">
                BorderBrief AI
              </span>
              <span>—</span>
              <span>Empowering Indian Micro-Exporters and Small Businesses</span>
            </div>

            <div className="text-center md:text-right text-slate-400 max-w-md">
              <p>
                Informational trade compliance platform for export preparation. Not a licensed customs broker or legal counsel.
              </p>
              <p className="mt-0.5 text-slate-500 font-medium">
                Initial Trade Corridor: India 🇮🇳 → United States 🇺🇸
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

