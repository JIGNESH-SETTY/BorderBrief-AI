import React from "react";
import { WORKFLOW_OVERVIEW_STEPS } from "@/config/modules";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Sparkles, ShieldCheck, Calculator, Receipt } from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText: FileText,
  Sparkles: Sparkles,
  ShieldCheck: ShieldCheck,
  Calculator: Calculator,
  Receipt: Receipt,
};

export function WorkflowOverview() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 w-full">
      {WORKFLOW_OVERVIEW_STEPS.map((step) => {
        const IconComponent = ICON_MAP[step.iconName] || FileText;

        return (
          <Card
            key={step.stepNumber}
            className="border-slate-200/90 hover:border-sky-300 hover:shadow-md transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100 group-hover:bg-sky-500 transition-colors" />
            <CardContent className="p-5 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-colors">
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-400 group-hover:text-sky-600 transition-colors">
                    0{step.stepNumber}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-slate-900 mb-1">
                  {step.title}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

