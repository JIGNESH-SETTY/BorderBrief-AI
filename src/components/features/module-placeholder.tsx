import React from "react";
import { ArchitecturalModule } from "@/types/export";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, ShieldCheck, CheckCircle2 } from "lucide-react";

export function ModulePlaceholderCard({
  module,
}: {
  module: ArchitecturalModule;
}) {
  const isComplete = module.status === "COMPLETED" || module.status === "ACTIVE";
  const isFoundation = module.status === "FOUNDATION_READY";

  return (
    <Card className="border-slate-200/80 bg-white hover:border-slate-300 transition-all">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
            Stage 0{module.stageNumber}
          </span>
          <Badge
            variant={isComplete || isFoundation ? "success" : "default"}
            className="text-[10px]"
          >
            {isComplete ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                {module.sprintPhase}
              </span>
            ) : isFoundation ? (
              "Foundation Ready"
            ) : (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {module.sprintPhase}
              </span>
            )}
          </Badge>
        </div>
        <CardTitle className="text-sm font-semibold text-slate-900">
          {module.title}
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          {module.shortDescription}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 pt-2 text-xs">
        <div className="rounded bg-slate-50 p-2.5 border border-slate-100 text-slate-600 mb-2">
          <span className="font-medium text-slate-700 block mb-0.5">
            Technical Implementation:
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            {module.technicalRole}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>
            {isComplete
              ? "Implemented, grounded, and verified in test suite."
              : isFoundation
              ? "Base shell initialized."
              : "Architectural component."}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

