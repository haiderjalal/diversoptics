import { Slot } from "@radix-ui/react-slot";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils/cn";

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  asChild?: boolean;
  tone?: "gold" | "green" | "quiet";
};

const tones = {
  gold: "bg-orbit-gold text-obsidian hover:bg-[#ffd95f]",
  green: "bg-signal-green text-white hover:bg-[#19653d]",
  quiet: "bg-transparent text-current hover:bg-black/5",
} as const;

export function Button({
  asChild = false,
  className,
  tone = "gold",
  type,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold tracking-[0.04em] transition-[color,background-color,transform] duration-200 ease-out motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        tones[tone],
        className,
      )}
      type={asChild ? undefined : (type ?? "button")}
      {...props}
    />
  );
}
