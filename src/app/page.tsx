import React from "react";
import Link from "next/link";
import { WorkflowOverview } from "@/components/features/workflow-overview";
import { ModulePlaceholderCard } from "@/components/features/module-placeholder";
import { ARCHITECTURAL_MODULES } from "@/config/modules";
import { PRIMARY_CORRIDOR, CORRIDOR_COMPLIANCE_NOTES } from "@/config/corridor";
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FilePlus,
  HelpCircle,
  Building2,
  Lock,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="space-y-10 sm:space-y-12">
      {/* Hero & Welcome Section */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-sky-900 via-slate-900 to-slate-950 text-white p-6 sm:p-10 lg:p-12 shadow-xl border border-sky-950">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-400/20 text-sky-300 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            <span>Built for Indian Artisans, MSMEs & Small Manufacturers</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
            Know the Rules. Know the Cost.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-300">
              Ship with Confidence.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed">
            BorderBrief AI helps small businesses in India navigate US customs requirements, calculate accurate landed costs, generate export invoice drafts, and prepare for international payments before accepting overseas orders.
          </p>

          {/* Primary Action Button */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Link
              href="/export/new"
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-base shadow-lg shadow-sky-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <FilePlus className="w-5 h-5 text-slate-950" />
              <span>Start New Export Assessment</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>

            <Link
              href="/corridor/india-usa"
              className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 font-medium text-sm transition-colors"
            >
              <span>Explore Corridor Guide (India → USA)</span>
            </Link>
          </div>

          {/* Key Trust Signals */}
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400 border-t border-slate-800/80">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>19 U.S.C. § 1401a Transaction Value</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>USITC 2026 Rev 22 Baseline</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Indian GST LUT Compliant Drafts</span>
            </div>
          </div>
        </div>
      </section>

      {/* Step-by-Step Overview Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              How BorderBrief AI Works
            </h2>
            <p className="text-sm text-slate-500">
              A simple 5-step preparation workflow designed for non-technical sellers.
            </p>
          </div>
          <span className="text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200/80 px-2.5 py-1 rounded-full self-start sm:self-auto">
            Zero Customs Jargon Required
          </span>
        </div>

        <WorkflowOverview />
      </section>

      {/* Corridor Intelligence Section: India to USA */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">{PRIMARY_CORRIDOR.originFlag}</span>
              <span className="text-sm font-bold text-slate-900">
                {PRIMARY_CORRIDOR.originName}
              </span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <span className="text-lg">{PRIMARY_CORRIDOR.destinationFlag}</span>
              <span className="text-sm font-bold text-slate-900">
                {PRIMARY_CORRIDOR.destinationName}
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              Initial Trade Corridor Regulations & Valuation Laws
            </h3>
            <p className="text-xs text-slate-500">
              Critical regulatory details every Indian micro-exporter must know before quoting prices to American customers.
            </p>
          </div>

          <Link
            href="/corridor/india-usa"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-100 self-start md:self-auto transition-colors"
          >
            <span>Full Regulatory Breakdown</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CORRIDOR_COMPLIANCE_NOTES.map((note) => (
            <div
              key={note.title}
              className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {note.title}
                </h4>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                  {note.tag}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {note.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Architectural Roadmap & Feature Boundaries */}
      <section className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-sky-600" />
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Architectural Roadmap & Module Boundaries
            </h2>
          </div>
          <p className="text-sm text-slate-500">
            Sprints 1–6 have established a complete, grounded export pipeline: cloud AI extraction, official USITC Rev 22 classification, 19 U.S.C. § 1401a landed-cost math, export commercial invoice drafting, and PayPal Sandbox payment collection.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {ARCHITECTURAL_MODULES.map((module) => (
            <ModulePlaceholderCard key={module.key} module={module} />
          ))}
        </div>

        {/* Sprint Boundary Guarantee Banner */}
        <div className="rounded-xl bg-slate-100 p-4 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              <strong>Regulatory Integrity Guarantee:</strong> Zero hallucinated customs tariffs, zero fake business analytics, and 100% grounded calculations under official trade statutes.
            </span>
          </div>
          <span className="font-semibold text-slate-700">
            Sprint 7: Integration Polish & End-to-End Verification
          </span>
        </div>
      </section>
    </div>
  );
}

