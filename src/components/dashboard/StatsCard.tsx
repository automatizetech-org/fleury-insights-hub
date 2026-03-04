import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  description?: string;
  className?: string;
  delay?: number;
}

export function StatsCard({ title, value, change, changeType = "neutral", icon: Icon, description, className, delay = 0 }: StatsCardProps) {
  return (
    <div
      className={cn(
        "glass-card rounded-xl p-6 hover-lift group cursor-default",
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold font-display tracking-tight">{value}</p>
          {change && (
            <p className={cn(
              "text-xs font-medium",
              changeType === "positive" && "text-success",
              changeType === "negative" && "text-destructive",
              changeType === "neutral" && "text-muted-foreground"
            )}>
              {change}
            </p>
          )}
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        <div className="rounded-lg bg-primary/10 p-3 group-hover:bg-accent/20 transition-colors duration-300">
          <Icon className="h-5 w-5 text-primary group-hover:text-accent transition-colors duration-300" />
        </div>
      </div>
    </div>
  );
}
