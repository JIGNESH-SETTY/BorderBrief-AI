import React from "react";
import Link from "next/link";
import { PRIMARY_CORRIDOR } from "@/config/corridor";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  Scale,
  FileCheck2,
  AlertTriangle,
  FileText,
  ExternalLink,
} from "lucide-react";

export default function CorridorGuidePage() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Navigation */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Overview</span>
        </Link>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200/80 text-sky-800 text-xs font-semibold">
          <span>{PRIMARY_CORRIDOR.originFlag}</span>
          <span>{PRIMARY_CORRIDOR.originName}</span>
          <ArrowRight className="w-3 h-3 text-sky-500" />
          <span>{PRIMARY_CORRIDOR.destinationFlag}</span>
          <span>{PRIMARY_CORRIDOR.destinationName}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          India to United States Export Regulatory Guide
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
          Statutory compliance facts for Indian artisans, handicraft sellers, and MSMEs exporting to the United States — covering valuation principles, the suspension of Section 321 de minimis, GSP status, tariff schedules, and Indian export documentation.
        </p>
      </div>

      {/* Main 4 Pillars */}
      <div className="space-y-6">
        {/* Pillar 1: Valuation */}
        <Card className="border-slate-200">
          <CardHeader className="p-6 pb-3 flex flex-row items-start gap-4 space-y-0">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wider block">
                Rule 01 — Valuation Law
              </span>
              <CardTitle className="text-base sm:text-lg">
                US Customs Valuation: Transaction Value (19 U.S.C. § 1401a)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0 text-xs sm:text-sm text-slate-600 space-y-3">
            <p>
              In many jurisdictions (such as India and the EU), customs duties are calculated on a <strong>CIF</strong> (Cost, Insurance, and Freight) basis.
            </p>
            <p>
              <strong>The United States legal framework is distinct:</strong> Under <strong>19 U.S.C. § 1401a</strong> (Section 402 of the Tariff Act of 1930, as amended), the primary method of customs valuation is <strong>Transaction Value</strong> — defined generally as the price actually paid or payable for the merchandise when sold for exportation to the United States, plus specified statutory additions (including packing costs, selling commissions, assists, royalties, and license fees) when not already included.
            </p>
            <p>
              Under <strong>19 U.S.C. § 1401a(b)(4)(A)</strong>, the price actually paid or payable excludes costs, charges, and expenses incurred for transportation, insurance, and related services incident to international shipment from the country of exportation to the place of importation in the United States. This statutory exclusion must not be described simply as &quot;costs incurred after exportation,&quot; and is legally distinct from the separate statutory provision concerning transportation occurring after importation into the United States under <strong>19 U.S.C. § 1401a(b)(4)(B)</strong>.
            </p>
            <p>
              BorderBrief AI avoids assumptions about bundled shipping charges or individual transaction terms. Actual customs valuation requires careful examination of the transaction and supporting commercial documentation, as a seller&apos;s quoted product price or FOB figure is not automatically the legally conclusive customs value without verifying statutory additions and legal conditions.
            </p>
            <div className="p-3 bg-sky-50 rounded-lg border border-sky-100 text-xs text-sky-900 font-mono">
              Customs Valuation = Transaction Value (Price Paid or Payable + Statutory Additions under 19 U.S.C. § 1401a; Excludes costs incident to international shipment under § 1401a(b)(4)(A)). Examination of transaction terms and documentation required.
            </div>
          </CardContent>
        </Card>

        {/* Pillar 2: Section 321 De Minimis Suspension */}
        <Card className="border-slate-200">
          <CardHeader className="p-6 pb-3 flex flex-row items-start gap-4 space-y-0">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                Rule 02 — Exemption Status
              </span>
              <CardTitle className="text-base sm:text-lg">
                Suspension of General Duty-Free De Minimis Treatment (Section 321)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0 text-xs sm:text-sm text-slate-600 space-y-3">
            <p>
              Under 19 U.S.C. § 1321 (commonly known as Section 321), low-value commercial shipments previously qualified for duty-free and tax-free entry under informal procedures if the aggregate fair retail value was $800 USD or less per person per day.
            </p>
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
              <strong className="block font-semibold">Important Regulatory Notice (Effective August 29, 2025):</strong>
              <p>
                General duty-free de minimis treatment under Section 321 was suspended effective August 29, 2025, pursuant to Presidential Action (July 2025) and US Customs and Border Protection (CBP) guidance. The former general $800 duty-free exemption is no longer available for covered shipments.
              </p>
            </div>
            <p>
              Applicable customs duties, taxes, and fees (such as Merchandise Processing Fees) depend on current entry rules, entry type, and product classification. While limited statutory exceptions may exist under specific provisions, <strong>BorderBrief AI does not automatically assume zero duty or zero MPF for low-value shipments</strong>, and does not invent any substitute threshold.
            </p>
          </CardContent>
        </Card>

        {/* Pillar 3: GSP Revocation & Expiration */}
        <Card className="border-slate-200">
          <CardHeader className="p-6 pb-3 flex flex-row items-start gap-4 space-y-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">
                Rule 03 — Tariff Schedule & GSP Status
              </span>
              <CardTitle className="text-base sm:text-lg">
                GSP Ineligibility & Column 1 General (MFN) Tariffs
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0 text-xs sm:text-sm text-slate-600 space-y-3">
            <p>
              Indian sellers frequently question whether handicrafts or textiles enter the US duty-free under the Generalized System of Preferences (GSP / special rate indicator <code>A</code>).
            </p>
            <p>
              <strong>Two Distinct Legal Events Govern GSP:</strong>
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 text-xs text-slate-700">
              <li>
                <strong>India Designation Terminated (June 5, 2019):</strong> Presidential Proclamation 9902 formally terminated India&apos;s designation as a beneficiary developing country under the GSP program, effective June 5, 2019.
              </li>
              <li>
                <strong>US GSP Statutory Authorization Expired (December 31, 2020):</strong> The entire US GSP program expired at midnight on December 31, 2020, and has not been reauthorized by the US Congress.
              </li>
            </ol>
            <p>
              These are two separate legal events that must not be conflated. For goods of Indian origin, GSP preferential rates do not apply. Applicable duties must be determined under standard <strong>Column 1 General (Most-Favored-Nation / Normal Trade Relations)</strong> rates.
            </p>
            <p>
              <strong>Official Tariff Snapshot:</strong> BorderBrief AI uses the <strong>USITC 2026 Harmonized Tariff Schedule (HTS) Revision 22 (published October 30, 2026)</strong> as its official research baseline. Final applicable rates also depend on Chapter 99 provisions (such as trade remedies, Section 301, Section 232), statutory effective dates, and validated product classification.
            </p>
          </CardContent>
        </Card>

        {/* Pillar 4: Indian Export Compliance */}
        <Card className="border-slate-200">
          <CardHeader className="p-6 pb-3 flex flex-row items-start gap-4 space-y-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                Rule 04 — Indian Export Formalities
              </span>
              <CardTitle className="text-base sm:text-lg">
                GST Letter of Undertaking (LUT) & DGFT IEC Code
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0 text-xs sm:text-sm text-slate-600 space-y-3">
            <p>
              Under Indian GST legislation (Section 16 of the IGST Act, 2017), export of goods is treated as a zero-rated supply. Indian micro-exporters should file a <strong>Letter of Undertaking (LUT)</strong> annually on the GST portal to export without paying Integrated GST upfront, preserving operating liquidity.
            </p>
            <p>
              Commercial invoice drafts generated by BorderBrief AI incorporate the statutory declaration: <em>&quot;Supply Meant For Export Under Letter Of Undertaking Without Payment Of Integrated Tax (IGST)&quot;</em> along with the seller&apos;s DGFT Importer-Exporter Code (IEC) and Authorized Dealer (AD) Code.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Official References Box */}
      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs text-slate-600">
        <span className="font-semibold text-slate-800 block">Official Regulatory References:</span>
        <ul className="space-y-1 list-disc pl-4 text-[11px]">
          <li>19 U.S.C. § 1401a(b)(4)(A) & (B) — Value of imported merchandise (Transaction Value and international shipment transportation exclusions)</li>
          <li>White House Presidential Action (July 2025) & CBP Fact Sheet (Aug 2025) — Suspension of duty-free de minimis treatment</li>
          <li>Presidential Proclamation 9902 (May 31, 2019) — Termination of India GSP beneficiary designation</li>
          <li>USTR GSP Expiration Notice (Dec 31, 2020) — Statutory expiration of the US GSP program</li>
          <li>USITC Harmonized Tariff Schedule of the United States (2026 HTS Revision 22, Oct 30, 2026)</li>
          <li>CBIC Circular & Section 16 IGST Act 2017 — Zero-rated supplies under LUT</li>
        </ul>
      </div>

      {/* CTA Box */}
      <div className="rounded-2xl bg-slate-900 text-white p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-base font-bold text-white">
            Ready to prepare an India → USA export shipment?
          </h3>
          <p className="text-xs text-slate-400">
            Enter your product details and start your export assessment.
          </p>
        </div>

        <Link href="/export/new">
          <Button variant="primary" size="lg" className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold shrink-0">
            <span>Start New Export</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
