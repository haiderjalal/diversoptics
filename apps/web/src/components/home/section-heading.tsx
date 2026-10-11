import { cn } from "@/lib/utils/cn";

export function SectionHeading({
  eyebrow,
  title,
  inverse = false,
  className,
}: {
  eyebrow: string;
  title: string;
  inverse?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", inverse && "text-porcelain", className)}>
      <p
        className={cn(
          "flex items-center gap-3 text-sm font-semibold tracking-[0.08em]",
          inverse && "text-orbit-gold",
        )}
      >
        {/* A hairline that draws in with its block, echoing the brand's rules. */}
        <span
          aria-hidden="true"
          className={cn(
            "dx-rule h-px w-10 shrink-0",
            inverse ? "bg-orbit-gold" : "bg-antique-brass",
          )}
        />
        {eyebrow}
      </p>
      <h2 className="max-w-[47.5rem] font-display text-[2.5rem] leading-[1.05] tracking-[-0.01em] sm:text-5xl">
        {title}
      </h2>
    </div>
  );
}
