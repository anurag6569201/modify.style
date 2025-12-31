import * as React from "react";
import { cn } from "@/lib/utils";

interface SegmentedControlProps {
  options: string[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function SegmentedControl({
  options,
  value,
  onValueChange,
  className,
}: SegmentedControlProps) {
  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-border bg-secondary/50 p-1",
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onValueChange(option)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
            value === option
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}



