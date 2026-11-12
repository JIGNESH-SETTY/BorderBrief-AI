"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  Compass,
  FilePlus,
  BookOpen,
  Receipt,
  Menu,
  X,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { CorridorBadge } from "@/components/features/corridor-badge";

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDemoActive, setIsDemoActive] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Check demo authentication status
  useEffect(() => {
    let isMounted = true;
    async function checkAuth() {
      try {
        const res = await fetch("/api/demo/auth");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setIsDemoActive(Boolean(data.authenticated));
          }
        }
      } catch {
        // Fallback gracefully
      }
    }
    checkAuth();
    return () => {
      isMounted = false;
    };
  }, [pathname]);

  const navLinks = [
    { href: "/", label: "Overview", icon: Compass },
    { href: "/corridor/india-usa", label: "Corridor Guide", icon: BookOpen },
    { href: "/invoices", label: "Invoices & Receipts", icon: Receipt },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-line bg-card/90 backdrop-blur-md transition-colors">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 h-[68px] flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-[11px] bg-gradient-to-br from-sea to-ink text-white flex items-center justify-center shadow-md shadow-sea/20 group-hover:scale-105 transition-transform shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-baseline">
              <span className="font-heading font-extrabold text-[21px] tracking-tight text-text">
                BorderBrief<em className="text-sea not-italic">.AI</em>
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        <nav aria-label="Main" className="hidden lg:flex items-center gap-1.5 ml-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`px-4 py-2 rounded-full font-semibold text-[14.5px] transition-all flex items-center gap-2 ${
                  isActive
                    ? "bg-ink text-white shadow-sm"
                    : "text-mute hover:text-text hover:bg-sea-soft"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-mint" : "text-mute"}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Action Area */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Corridor Badge */}
          <div className="hidden xl:block">
            <CorridorBadge />
          </div>

          {/* Demo Mode Pill */}
          <Link
            href="/demo-login"
            className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              isDemoActive
                ? "bg-mint-soft text-[#0B7A5F] border-mint/40 hover:bg-mint-soft/80"
                : "bg-saffron-soft text-[#8A5200] border-saffron/40 hover:bg-saffron-soft/80"
            }`}
            title="View Demo Access & Authentication Status"
          >
            <Sparkles className="w-3.5 h-3.5 text-sea shrink-0" />
            <span>{isDemoActive ? "Demo Mode Active" : "Demo Account"}</span>
          </Link>

          {/* CTA: Start New Export (Pill Button) */}
          <Link
            href="/export/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-saffron text-[#1A1204] font-semibold text-sm shadow-[0_6px_18px_-6px_rgba(255,154,31,0.6)] hover:-translate-y-0.5 hover:shadow-[0_10px_22px_-6px_rgba(255,154,31,0.73)] active:translate-y-0 transition-all shrink-0"
          >
            <FilePlus className="w-4 h-4 shrink-0 text-[#1A1204]" />
            <span className="hidden xs:inline">New Export</span>
            <span className="xs:hidden">Export</span>
          </Link>

          {/* Mobile Menu Hamburger Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-mute hover:text-text hover:bg-sea-soft focus:outline-none transition-colors"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-line bg-card shadow-xl animate-in slide-in-from-top-2 duration-200 px-4 py-4 space-y-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-ink text-white"
                    : "text-mute hover:text-text hover:bg-sea-soft"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-mint" : "text-mute"}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}

          <div className="pt-2 border-t border-line flex flex-col gap-2">
            <Link
              href="/demo-login"
              className="flex items-center justify-between px-4 py-2 rounded-xl text-xs font-semibold bg-sea-soft text-sea"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isDemoActive ? "Demo Mode Active" : "Sign In / Demo Account"}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
