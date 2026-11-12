import React from "react";
import { FileText, Sparkles, ShieldCheck, Calculator, Scale } from "lucide-react";

export interface WorkflowStep {
  stepNumber: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: WorkflowStep[] = [
  {
    stepNumber: 1,
    title: "Describe your product",
    description: "Name, materials, and selling price.",
    icon: FileText,
  },
  {
    stepNumber: 2,
    title: "AI reads the details",
    description: "Pulls out materials and intended use.",
    icon: Sparkles,
  },
  {
    stepNumber: 3,
    title: "Match customs codes",
    description: "Candidate HTS codes grounded in USITC Rev 22.",
    icon: ShieldCheck,
  },
  {
    stepNumber: 4,
    title: "See landed cost",
    description: "Duty, Section 301 and fees, itemised.",
    icon: Calculator,
  },
  {
    stepNumber: 5,
    title: "Invoice and get paid",
    description: "Download the PDF and collect via PayPal.",
    icon: Scale,
  },
];

export function WorkflowOverview() {
  return (
    <div className="flow w-full my-6">
      {STEPS.map((step) => {
        const IconComponent = step.icon;
        return (
          <div key={step.stepNumber} className="fs group">
            <div className="ic shadow-sm group-hover:shadow-md transition-all">
              <IconComponent className="w-5 h-5 transition-transform group-hover:scale-110" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-text mb-1 group-hover:text-sea transition-colors">
                {step.title}
              </h3>
              <p className="text-[13.5px] text-mute leading-relaxed">
                {step.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
