"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { PRIMARY_CORRIDOR } from "@/config/corridor";
import {
  ArrowLeft,
  ArrowRight,
  Scale,
  FileCheck2,
  AlertTriangle,
  FileText,
  FilePlus,
  BookOpen,
} from "lucide-react";

export default function CorridorGuidePage() {
  const [activeSection, setActiveSection] = useState("r1");

  useEffect(() => {
    const handleScroll = () => {
      const sections = ["r1", "r2", "r3", "r4", "r5"];
      for (const id of sections) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 140 && rect.bottom >= 140) {
            setActiveSection(id);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="space-y-8">
      {/* Back Link */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-mute hover:text-sea font-medium text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to overview</span>
        </Link>
      </div>

      {/* Guide 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8 lg:gap-10 items-start">
        {/* Sticky Table of Contents Sidebar */}
        <aside
          aria-label="On this page"
          className="toc sticky top-24 hidden lg:flex flex-col gap-1 p-2 bg-card border border-line rounded-[18px]"
        >
          <span className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-mute">
            On this page
          </span>
          <a
            href="#r1"
            onClick={() => setActiveSection("r1")}
            className={activeSection === "r1" ? "act" : ""}
          >
            US customs valuation
          </a>
          <a
            href="#r2"
            onClick={() => setActiveSection("r2")}
            className={activeSection === "r2" ? "act" : ""}
          >
            De minimis suspension
          </a>
          <a
            href="#r3"
            onClick={() => setActiveSection("r3")}
            className={activeSection === "r3" ? "act" : ""}
          >
            GSP status &amp; tariffs
          </a>
          <a
            href="#r4"
            onClick={() => setActiveSection("r4")}
            className={activeSection === "r4" ? "act" : ""}
          >
            Indian export documents
          </a>
          <a
            href="#r5"
            onClick={() => setActiveSection("r5")}
            className={activeSection === "r5" ? "act" : ""}
          >
            Official citations
          </a>
        </aside>

        {/* Main Content Column */}
        <div className="space-y-6">
          {/* Page Header */}
          <div className="space-y-3 pb-2 border-b border-line">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sea-soft text-sea text-xs font-semibold">
              <span>{PRIMARY_CORRIDOR.originFlag}</span>
              <span>{PRIMARY_CORRIDOR.originName}</span>
              <ArrowRight className="w-3 h-3 text-sea" />
              <span>{PRIMARY_CORRIDOR.destinationFlag}</span>
              <span>{PRIMARY_CORRIDOR.destinationName}</span>
            </span>

            <h1 className="font-heading text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-text tracking-tight leading-[1.1]">
              India to US export regulatory guide
            </h1>
            <p className="text-mute text-base sm:text-lg max-w-3xl leading-relaxed">
              Compliance basics for artisans, handicraft sellers and MSMEs: valuation principles, the de minimis suspension, GSP status, tariff schedules, and Indian paperwork.
            </p>
          </div>

          {/* Rule 1: Valuation Law */}
          <div className="rule space-y-4" id="r1">
            <span className="tag inline-flex items-center gap-2 text-xs font-semibold text-sea bg-sea-soft px-3 py-1 rounded-full">
              <Scale className="w-3.5 h-3.5" />
              <span>Rule 1: Valuation law</span>
            </span>

            <h3 className="font-heading text-xl sm:text-2xl font-bold text-text">
              US customs valuation: transaction value (19 U.S.C. § 1401a)
            </h3>

            <p className="text-mute text-sm sm:text-base leading-relaxed">
              In many jurisdictions (such as India and the EU), customs duties are calculated on a <strong className="text-text">CIF</strong> (Cost, Insurance, and Freight) basis. The United States legal framework works very differently.
            </p>

            <p className="text-mute text-sm sm:text-base leading-relaxed">
              Under <strong className="text-text">19 U.S.C. § 1401a</strong> (Section 402 of the Tariff Act of 1930, as amended), the primary method of customs valuation is <strong className="text-text">Transaction Value</strong>: defined as the price actually paid or payable for goods when sold for exportation to the United States, plus certain statutory additions (such as packing costs, selling commissions, assists, royalties, and license fees) when not already included.
            </p>

            <p className="text-mute text-sm sm:text-base leading-relaxed">
              Under <strong className="text-text">19 U.S.C. § 1401a(b)(4)(A)</strong>, that price <strong className="text-text">excludes</strong> costs, charges, and expenses incurred for transportation, insurance, and related services incident to international shipment from the country of exportation to the place of importation in the United States. This statutory exclusion is distinct from transport occurring after importation under <strong className="text-text">§ 1401a(b)(4)(B)</strong>.
            </p>

            <p className="text-mute text-sm sm:text-base leading-relaxed">
              A quoted price or FOB figure is not automatically the customs value. The transaction terms and commercial documentation must be verified.
            </p>

            <div className="formula">
              Customs value = price paid or payable + statutory additions (19 U.S.C. § 1401a)<br />
              Excludes: international freight and insurance to US port (§ 1401a(b)(4)(A))
            </div>
          </div>

          {/* Rule 2: Section 321 De Minimis Suspension */}
          <div className="rule space-y-4" id="r2">
            <span className="tag inline-flex items-center gap-2 text-xs font-semibold text-[#8A5200] bg-saffron-soft px-3 py-1 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5 text-saffron" />
              <span>Rule 2: De minimis suspension</span>
            </span>

            <h3 className="font-heading text-xl sm:text-2xl font-bold text-text">
              Suspension of general duty-free de minimis treatment (Section 321)
            </h3>

            <p className="text-mute text-sm sm:text-base leading-relaxed">
              Under 19 U.S.C. § 1321 (commonly known as Section 321), low-value commercial shipments previously entered duty-free and tax-free under informal procedures if the fair retail value was $800 USD or less per person per day.
            </p>

            <div className="p-4 rounded-[14px] bg-saffron-soft/60 border border-saffron/30 text-xs sm:text-sm text-text space-y-1.5">
              <strong className="block font-bold text-[#8A5200]">
                Important Regulatory Notice (Effective August 29, 2025):
              </strong>
              <p className="text-mute leading-relaxed">
                General duty-free de minimis treatment under Section 321 was suspended effective August 29, 2025, pursuant to Presidential Action (July 2025) and US Customs and Border Protection (CBP) guidance. The former general $800 duty-free exemption is no longer available for covered commercial shipments.
              </p>
            </div>

            <p className="text-mute text-sm sm:text-base leading-relaxed">
              Applicable customs duties, taxes, and fees (such as Merchandise Processing Fees) depend on entry rules, entry type, and product classification. BorderBrief AI does not assume zero duty for low-value shipments and avoids inventing substitute thresholds.
            </p>
          </div>

          {/* Rule 3: GSP Status & Column 1 General Rates */}
          <div className="rule space-y-4" id="r3">
            <span className="tag inline-flex items-center gap-2 text-xs font-semibold text-sea bg-sea-soft px-3 py-1 rounded-full">
              <FileText className="w-3.5 h-3.5" />
              <span>Rule 3: Tariff schedules &amp; GSP</span>
            </span>

            <h3 className="font-heading text-xl sm:text-2xl font-bold text-text">
              GSP ineligibility &amp; Column 1 General (MFN) tariffs
            </h3>

            <p className="text-mute text-sm sm:text-base leading-relaxed">
              Indian exporters often ask whether handicrafts or textiles enter the US duty-free under the Generalized System of Preferences (GSP / special rate indicator <code>A</code>).
            </p>

            <div className="space-y-2 p-4 rounded-[14px] bg-bg border border-line text-xs sm:text-sm text-text">
              <strong className="block font-bold text-text">Two Distinct Legal Events Govern GSP:</strong>
              <ol className="list-decimal pl-5 space-y-1 text-mute">
                <li>
                  <strong className="text-text">India Designation Terminated (June 5, 2019):</strong> Presidential Proclamation 9902 formally terminated India&apos;s designation as a beneficiary developing country under GSP, effective June 5, 2019.
                </li>
                <li>
                  <strong className="text-text">US GSP Program Expired (December 31, 2020):</strong> The entire US GSP program expired at midnight on December 31, 2020, and has not been reauthorized by Congress.
                </li>
              </ol>
            </div>

            <p className="text-mute text-sm sm:text-base leading-relaxed">
              These are two separate legal events that must not be confused. For goods of Indian origin, standard <strong className="text-text">Column 1 General (Most-Favored-Nation)</strong> rates apply.
            </p>

            <p className="text-mute text-sm sm:text-base leading-relaxed">
              BorderBrief AI grounds all duty calculations in the <strong className="text-text">USITC 2026 Harmonized Tariff Schedule (HTS) Revision 22 (published October 30, 2026)</strong>.
            </p>
          </div>

          {/* Rule 4: Indian Export Compliance */}
          <div className="rule space-y-4" id="r4">
            <span className="tag inline-flex items-center gap-2 text-xs font-semibold text-mint bg-mint-soft px-3 py-1 rounded-full">
              <FileCheck2 className="w-3.5 h-3.5 text-mint" />
              <span>Rule 4: Indian export formalities</span>
            </span>

            <h3 className="font-heading text-xl sm:text-2xl font-bold text-text">
              GST Letter of Undertaking (LUT) &amp; DGFT IEC code
            </h3>

            <p className="text-mute text-sm sm:text-base leading-relaxed">
              Under Indian GST legislation (Section 16 of the IGST Act, 2017), export of goods is treated as a zero-rated supply. Indian micro-exporters should file a <strong className="text-text">Letter of Undertaking (LUT)</strong> annually on the GST portal to export without paying Integrated GST upfront, preserving vital working capital.
            </p>

            <p className="text-mute text-sm sm:text-base leading-relaxed">
              Commercial invoices generated by BorderBrief AI incorporate the statutory declaration: <em className="text-text">&quot;Supply Meant For Export Under Letter Of Undertaking Without Payment Of Integrated Tax (IGST)&quot;</em> along with the seller&apos;s DGFT Importer-Exporter Code (IEC).
            </p>
          </div>

          {/* Rule 5: Citations */}
          <div className="p-5 rounded-[18px] border border-line bg-card space-y-2 text-xs sm:text-sm text-mute" id="r5">
            <span className="font-bold text-text block">Official Regulatory Citations:</span>
            <ul className="space-y-1.5 list-disc pl-5 text-xs text-mute">
              <li>19 U.S.C. § 1401a(b)(4)(A) &amp; (B) — Transaction value &amp; international shipment transportation exclusions</li>
              <li>White House Presidential Action (July 2025) &amp; CBP Fact Sheet (Aug 2025) — Suspension of duty-free de minimis</li>
              <li>Presidential Proclamation 9902 (May 31, 2019) — Termination of India GSP beneficiary designation</li>
              <li>USTR GSP Expiration Notice (Dec 31, 2020) — Statutory expiration of the US GSP program</li>
              <li>USITC Harmonized Tariff Schedule of the United States (2026 HTS Revision 22, Oct 30, 2026)</li>
              <li>CBIC Circular &amp; Section 16 IGST Act 2017 — Zero-rated supplies under LUT</li>
            </ul>
          </div>

          {/* Bottom CTA Banner */}
          <div className="rounded-[22px] bg-gradient-to-br from-ink to-ink2 text-white p-7 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-xl">
            <div className="space-y-1 text-center sm:text-left">
              <h3 className="font-heading text-xl font-bold text-white">
                Ready to prepare an India → USA export shipment?
              </h3>
              <p className="text-xs sm:text-sm text-[#9CC2B0]">
                Enter your product details and run an assessment in under 2 minutes.
              </p>
            </div>

            <Link
              href="/export/new"
              className="btn-p inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-[#1A1204] shrink-0 transition-all"
            >
              <FilePlus className="w-4 h-4 text-[#1A1204]" />
              <span>Start New Export</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
