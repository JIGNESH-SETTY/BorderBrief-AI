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
    <Card className="border-line bg-card hover:border-sea/40 transition-all rounded-[18px]">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-bold text-sea bg-sea-soft px-2.5 py-0.5 rounded-full">
            Stage 0{module.stageNumber}
          </span>
          <Badge
            variant={isComplete || isFoundation ? "mint" : "default"}
            className="text-[10px]"
          >
            {isComplete ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-mint" />
                {module.sprintPhase}
              </span>
            ) : isFoundation ? (
              "Foundation Ready"
            ) : (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-mute" />
                {module.sprintPhase}
              </span>
            )}
          </Badge>
        </div>
        <CardTitle className="font-heading text-sm font-bold text-text">
          {module.title}
        </CardTitle>
        <CardDescription className="text-xs text-mute mt-0.5">
          {module.shortDescription}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 pt-2 text-xs">
        <div className="rounded-[10px] bg-bg p-2.5 border border-line text-text mb-2.5">
          <span className="font-medium text-xs block mb-0.5 text-text">
            Technical Implementation:
          </span>
          <span className="text-[11px] font-mono text-mute break-all">
            {module.technicalRole}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-mute">
          <ShieldCheck className="w-3.5 h-3.5 text-sea shrink-0" />
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
