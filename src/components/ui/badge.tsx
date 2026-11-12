import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "primary" | "success" | "warning" | "outline" | "saffron" | "mint" | "ink";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: "bg-sea-soft text-sea border-line",
    primary: "bg-sea-soft text-sea border-sea/30",
    success: "bg-mint-soft text-[#0B7A5F] border-mint/40",
    warning: "bg-saffron-soft text-[#8A5200] border-saffron/40",
    outline: "bg-transparent text-mute border-line",
    saffron: "bg-saffron-soft text-[#8A5200] border-saffron/40 font-semibold",
    mint: "bg-mint-soft text-[#0B7A5F] border-mint/40 font-semibold",
    ink: "bg-ink text-white border-transparent",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}
