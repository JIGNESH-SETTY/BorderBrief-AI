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
  const currentStep = steps.find((s) => s.status === "current")?.number || 1;

  return (
    <div className={cn("w-full py-1", className)}>
      {/* Redesigned Pill Stepper Container */}
      <div className="steps shadow-sm" role="list">
        {steps.map((step) => {
          const isCompleted = step.status === "completed";
          const isCurrent = step.status === "current";

          return (
            <div
              key={step.number}
              role="listitem"
              className={cn(
                "step",
                isCurrent && "on shadow-sm",
                isCompleted && "done"
              )}
            >
              <i>
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : (
                  step.number
                )}
              </i>
              <span className="truncate">{step.title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
