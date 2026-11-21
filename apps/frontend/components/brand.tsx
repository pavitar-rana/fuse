import { cn } from "@/lib/utils";

// Fuse mark: a fuse line burning into a spark, on a square tile.
export const FuseMark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("h-6 w-6", className)}>
    <rect width="24" height="24" className="fill-ember" />
    <path
      d="M5 18.5h4.5v-5h4v-4H17"
      fill="none"
      stroke="#0a0a0a"
      strokeWidth="2.2"
      strokeLinecap="square"
    />
    <rect x="17" y="5.5" width="3" height="3" fill="#0a0a0a" />
  </svg>
);

export const Wordmark = ({ className }: { className?: string }) => (
  <span className={cn("flex items-center gap-2.5", className)}>
    <FuseMark />
    <span className="font-mono text-[0.95rem] font-semibold uppercase tracking-[0.18em]">
      Fuse
    </span>
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
