import React from "react";
import Link from "next/link";
import { PRIMARY_CORRIDOR } from "@/config/corridor";
import { ArrowRight, Info } from "lucide-react";

export function CorridorBadge() {
  return (
    <Link
      href="/corridor/india-usa"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-50 border border-sky-200/80 text-sky-900 text-xs font-medium hover:bg-sky-100 transition-colors group"
      title="View India to USA trade corridor regulations"
    >
      <span className="flex items-center gap-1.5 font-semibold">
        <span>{PRIMARY_CORRIDOR.originFlag}</span>
        <span>{PRIMARY_CORRIDOR.originName}</span>
        <ArrowRight className="w-3 h-3 text-sky-500 group-hover:translate-x-0.5 transition-transform" />
        <span>{PRIMARY_CORRIDOR.destinationFlag}</span>
        <span>{PRIMARY_CORRIDOR.destinationName}</span>
      </span>
      <span className="w-1 h-1 rounded-full bg-sky-400" />
      <span className="text-sky-700 hidden sm:inline">Active Trade Corridor</span>
      <Info className="w-3.5 h-3.5 text-sky-500 ml-0.5" />
    </Link>
  );
}

