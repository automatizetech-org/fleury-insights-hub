import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
}

export function GlassCard({ children, className, hover = true, glow = false }: GlassCardProps) {
  return (
    <div className={cn(
      "glass-card rounded-xl",
      hover && "hover-lift",
      glow && "animate-pulse-glow",
      className
    )}>
      {children}
    </div>
  );
}
