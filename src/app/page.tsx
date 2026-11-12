import React from "react";
import Link from "next/link";
import { WorkflowOverview } from "@/components/features/workflow-overview";
import { ManifestCalculator } from "@/components/features/manifest-calculator";
import { ModulePlaceholderCard } from "@/components/features/module-placeholder";
import { ARCHITECTURAL_MODULES } from "@/config/modules";
import { PRIMARY_CORRIDOR, CORRIDOR_COMPLIANCE_NOTES } from "@/config/corridor";
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FilePlus,
  Building2,
  Lock,
  Sparkles,
  BookOpen,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="space-y-12 sm:space-y-16">
      {/* Redesigned Hero Section */}
      <section className="relative overflow-hidden rounded-[32px] bg-[radial-gradient(900px_400px_at_85%_0,#2FBF8C55,transparent_60%),linear-gradient(160deg,var(--ink2),var(--ink)_70%)] text-white p-7 sm:p-12 lg:p-14 shadow-2xl border border-[#1F3E31]">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-12 items-center">
          {/* Left Hero Column */}
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-[#D4ECE0] text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 text-mint shrink-0" />
              <span>Built for Indian artisans, MSMEs and small manufacturers</span>
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl lg:text-[58px] font-extrabold tracking-tight leading-[1.06] text-white">
              Know the rules. Know the cost.{" "}
              <span className="block text-saffron">Ship with confidence.</span>
            </h1>

            <p className="text-[#B7D2C5] text-base sm:text-lg max-w-[520px] font-normal leading-relaxed">
              Check US customs requirements, see your true landed cost, and draft your export invoice before you accept an overseas order.
            </p>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link
                href="/export/new"
                className="btn-p inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm sm:text-base shadow-lg transition-all"
              >
                <FilePlus className="w-4 h-4 shrink-0 text-[#1A1204]" />
                <span>Start an export assessment</span>
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </Link>

              <Link
                href="/corridor/india-usa"
                className="btn-d inline-flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-sm transition-all"
              >
                <BookOpen className="w-4 h-4 text-white/80" />
                <span>Read India to USA guide</span>
              </Link>

              <Link
                href="/demo-login"
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-full bg-white/10 hover:bg-white/15 text-[#D4ECE0] border border-white/20 font-semibold text-sm transition-all"
                title="Instant access without password"
              >
                <Sparkles className="w-3.5 h-3.5 text-mint" />
                <span>Demo Account</span>
              </Link>
            </div>

            {/* Trust Signals */}
            <div className="pt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs sm:text-[13.5px] text-[#9CC2B0] border-t border-white/10">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-mint shrink-0" />
                <span>19 U.S.C. § 1401a valuation</span>
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-mint shrink-0" />
                <span>HTS Rev 22 baseline</span>
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-mint shrink-0" />
                <span>GST LUT-ready drafts</span>
              </span>
            </div>
          </div>

          {/* Right Hero Column: Interactive Manifest Calculator */}
          <div className="w-full flex justify-center lg:justify-end">
            <div className="w-full max-w-md">
              <ManifestCalculator />
            </div>
          </div>
        </div>
      </section>

      {/* Step-by-Step Workflow Section */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-text tracking-tight">
              From product to paperwork in five steps
            </h2>
            <p className="text-sm sm:text-base text-mute mt-1">
              No customs jargon needed. We handle the codes.
            </p>
          </div>
          <span className="text-xs font-semibold text-sea bg-sea-soft border border-sea/20 px-3 py-1 rounded-full self-start sm:self-auto">
            Zero Customs Jargon Required
          </span>
        </div>

        <WorkflowOverview />
      </section>

      {/* Bento Highlights from Design */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 p-7 rounded-[22px] border border-line bg-gradient-to-br from-sea-soft to-card space-y-2">
          <span className="inline-block text-[11px] font-bold text-sea uppercase tracking-wider bg-sea/10 px-2.5 py-0.5 rounded-full mb-1">
            US Customs Valuation
          </span>
          <h3 className="font-heading text-xl sm:text-2xl font-bold text-text">
            Transaction value, explained in plain English
          </h3>
          <p className="text-mute text-sm sm:text-[15px] leading-relaxed max-w-2xl">
            The US does not price customs duty on CIF like India or the European Union. Under 19 U.S.C. § 1401a, duty is based on transaction value and statutorily excludes international freight and insurance to the US port (§ 1401a(b)(4)(A)). We show exactly which costs count and which are excluded, with the statute next to each line item.
          </p>
        </div>

        <div className="p-7 rounded-[22px] border border-line bg-card space-y-2">
          <span className="inline-block text-[11px] font-bold text-sea uppercase tracking-wider bg-sea-soft px-2.5 py-0.5 rounded-full mb-1">
            Local Security & Privacy
          </span>
          <h3 className="font-heading text-xl sm:text-2xl font-bold text-text">
            Drafts that stay on your device
          </h3>
          <p className="text-mute text-sm sm:text-[15px] leading-relaxed">
            Invoices save locally to your database. No payment credentials or credit cards are ever stored. Single-user demo mode with instant sign-in.
          </p>
        </div>
      </section>

      {/* Corridor Intelligence Section: India to USA */}
      <section className="rounded-[22px] border border-line bg-card p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">{PRIMARY_CORRIDOR.originFlag}</span>
              <span className="text-sm font-bold text-text">
                {PRIMARY_CORRIDOR.originName}
              </span>
              <ArrowRight className="w-4 h-4 text-mute" />
              <span className="text-lg">{PRIMARY_CORRIDOR.destinationFlag}</span>
              <span className="text-sm font-bold text-text">
                {PRIMARY_CORRIDOR.destinationName}
              </span>
            </div>
            <h3 className="font-heading text-lg font-bold text-text">
              Active Trade Corridor Regulations & Valuation Laws
            </h3>
            <p className="text-xs sm:text-sm text-mute">
              Critical regulatory details every Indian micro-exporter must know before quoting prices to American customers.
            </p>
          </div>

          <Link
            href="/corridor/india-usa"
            className="inline-flex items-center gap-2 text-xs font-semibold text-sea hover:text-ink bg-sea-soft px-3.5 py-2 rounded-full border border-sea/20 self-start md:self-auto transition-colors"
          >
            <span>Full Regulatory Breakdown</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CORRIDOR_COMPLIANCE_NOTES.map((note) => (
            <div
              key={note.title}
              className="p-5 rounded-[14px] bg-bg border border-line space-y-2 hover:border-sea/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-text uppercase tracking-wider">
                  {note.title}
                </h4>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-card text-mute border border-line">
                  {note.tag}
                </span>
              </div>
              <p className="text-xs sm:text-[13px] text-mute leading-relaxed">
                {note.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Architectural Roadmap & Feature Boundaries */}
      <section className="space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-sea" />
            <h2 className="font-heading text-xl sm:text-2xl font-bold text-text tracking-tight">
              Architectural Roadmap & Module Boundaries
            </h2>
          </div>
          <p className="text-sm text-mute">
            Sprints 1–6 have established a complete, grounded export pipeline: cloud AI extraction, official USITC Rev 22 classification, 19 U.S.C. § 1401a landed-cost math, export commercial invoice drafting, and PayPal Sandbox payment collection.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {ARCHITECTURAL_MODULES.map((module) => (
            <ModulePlaceholderCard key={module.key} module={module} />
          ))}
        </div>

        {/* Sprint Boundary Guarantee Banner */}
        <div className="rounded-[14px] bg-card p-4 border border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-mute">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-sea shrink-0" />
            <span>
              <strong className="text-text">Regulatory Integrity Guarantee:</strong> Zero hallucinated customs tariffs, zero fake business analytics, and 100% grounded calculations under official trade statutes.
            </span>
          </div>
          <span className="font-semibold text-text whitespace-nowrap">
            Sprint 8: Full Demo Access & Cloud Readiness
          </span>
        </div>
      </section>
    </div>
  );
}
