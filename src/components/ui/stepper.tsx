import React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface StepItem {
  number: number;
  title: string;
  subtitle?: string;
  status: "completed" | "current" | "upcoming";
}

export interface StepperProps {
  steps: StepItem[];
  className?: string;
}

export function Stepper({ steps, className }: StepperProps) {
  return (
    <div className={cn("w-full py-4", className)}>
      {/* Desktop Stepper */}
      <ol className="hidden md:flex items-center justify-between w-full">
        {steps.map((step, idx) => {
          const isCompleted = step.status === "completed";
          const isCurrent = step.status === "current";

          return (
            <li
              key={step.number}
              className={cn(
                "flex items-center relative",
                idx !== steps.length - 1 ? "w-full" : ""
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold shrink-0 transition-colors",
                    isCompleted
                      ? "bg-emerald-600 text-white"
                      : isCurrent
                      ? "bg-sky-600 text-white ring-4 ring-sky-100"
                      : "bg-slate-100 text-slate-500 border border-slate-200"
                  )}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : step.number}
                </span>
                <div className="flex flex-col">
                  <span
                    className={cn(
                      "text-xs font-medium leading-none",
                      isCurrent
                        ? "text-sky-700 font-semibold"
                        : isCompleted
                        ? "text-slate-800"
                        : "text-slate-400"
                    )}
                  >
                    {step.title}
                  </span>
                  {step.subtitle && (
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      {step.subtitle}
                    </span>
                  )}
                </div>
              </div>

              {idx !== steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-4",
                    isCompleted ? "bg-emerald-500" : "bg-slate-200"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile Adaptive Stepper */}
      <div className="md:hidden flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
        {steps.map((step) => {
          if (step.status === "current") {
            return (
              <div key={step.number} className="flex items-center gap-3 w-full">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-sky-600 text-white text-xs font-semibold shrink-0">
                  {step.number}
                </span>
                <div className="flex flex-col flex-1">
                  <span className="text-xs text-sky-600 font-medium">
                    Step {step.number} of {steps.length}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {step.title}
                  </span>
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

