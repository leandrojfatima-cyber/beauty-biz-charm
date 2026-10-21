import React from "react";
import { cn } from "@/lib/utils";

interface NexadashLogoProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  variant?: "light" | "dark" | "color";
}

export function NexadashLogo({
  className,
  size = "md",
  showText = true,
  variant = "color",
}: NexadashLogoProps) {
  const sizeMap = {
    xs: { img: "h-6 w-6", text: "text-xs", sub: "text-[9px]" },
    sm: { img: "h-8 w-8", text: "text-sm", sub: "text-[10px]" },
    md: { img: "h-11 w-11", text: "text-base", sub: "text-[11px]" },
    lg: { img: "h-14 w-14", text: "text-xl", sub: "text-xs" },
    xl: { img: "h-20 w-20", text: "text-2xl", sub: "text-sm" },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative shrink-0 overflow-hidden rounded-xl bg-white shadow-xs border border-white/20 p-0.5">
        <img
          src="/assets/aistudio/avatar_9eef1d34.png"
          alt="NEXADASH — Sistemas Inteligentes"
          className={cn("object-contain rounded-lg", currentSize.img)}
          loading="eager"
        />
      </div>

      {showText && (
        <div className="flex flex-col leading-tight min-w-0">
          <span
            className={cn(
              "font-display font-extrabold tracking-wide uppercase truncate",
              currentSize.text,
              variant === "light"
                ? "text-white"
                : variant === "dark"
                  ? "text-[#0B192C]"
                  : "text-foreground",
            )}
          >
            NEXA<span className="text-[#FF6500]">DASH</span>
          </span>
          <span
            className={cn(
              "font-medium tracking-wider uppercase text-[10px] truncate",
              currentSize.sub,
              variant === "light"
                ? "text-white/80"
                : "text-muted-foreground",
            )}
          >
            Sistemas Inteligentes
          </span>
        </div>
      )}
    </div>
  );
}

export default NexadashLogo;
