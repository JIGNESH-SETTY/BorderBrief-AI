import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";

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
      <body className="min-h-full flex flex-col bg-bg text-text antialiased selection:bg-sea-soft selection:text-ink">
        {/* Top Corridor Ticker Bar */}
        <div className="bg-ink text-[#B5CFC3] text-[13px] border-b border-[#14463A]">
          <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-mint shadow-[0_0_0_4px_rgba(31,169,127,0.2)] shrink-0" />
              <span className="font-semibold text-white">Active corridor:</span>
              <span className="text-[#D4ECE0]">
                India to United States (19 U.S.C. § 1401a valuation)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#9CC2B0]">
              <span>USITC 2026 HTS Rev 22</span>
              <span>&nbsp;|&nbsp;</span>
              <span className="font-bold text-[#7CE8B8]">Free to start</span>
            </div>
          </div>
        </div>

        {/* Global Responsive Navigation Header */}
        <Navbar />

        {/* Main Application Body */}
        <main className="flex-1 max-w-[1180px] w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {children}
        </main>

        {/* Global Footer */}
        <footer className="border-t border-line bg-card/60 py-7 text-[13.5px] text-mute mt-auto">
          <div className="max-w-[1180px] mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-text">
              <span className="font-heading font-bold text-sm tracking-tight text-ink">
                BorderBrief AI
              </span>
              <span className="text-mute">—</span>
              <span className="text-mute">
                Helping Indian micro-exporters and artisans sell abroad
              </span>
            </div>

            <div className="text-center md:text-right text-xs text-mute max-w-lg">
              <p>
                Information for export preparation only. Grounded in 19 U.S.C. § 1401a and USITC 2026 HTS Rev 22. Not a licensed customs broker or legal counsel.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
