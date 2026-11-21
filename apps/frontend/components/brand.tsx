import { cn } from "@/lib/utils";

export const Wordmark = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "font-mono text-[0.95rem] font-semibold uppercase tracking-[0.18em]",
      className,
    )}
  >
    Fuse
  </span>
);

// [ LABEL ] section marker
export const Bracket = ({
  children,
  className,
  tone = "muted",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "muted" | "ember";
}) => (
  <p className={cn("label-mono", tone === "ember" && "text-ember", className)}>
    <span className="text-dim">[</span> {children} <span className="text-dim">]</span>
  </p>
);
