type LogoProps = {
  /** Which background the logo sits on — controls colour treatment */
  variant?: "light" | "dark" | "green";
  /** Show the wordmark next to the mark. Set false for compact spaces (favicon-style use). */
  withWordmark?: boolean;
  className?: string;
};

/**
 * MNG logomark: "M" in a rounded square (12px radius).
 * Wordmark: "MyNigerianGuide" — the "Nigerian" segment is always accented in brand green.
 * Three variants per the brief: on white, on dark (ink-900), on brand green (green-600).
 */
export default function Logo({
  variant = "light",
  withWordmark = true,
  className = "",
}: LogoProps) {
  const markBg =
    variant === "dark"
      ? "bg-green-500"
      : variant === "green"
        ? "bg-white"
        : "bg-green-600";

  const markText =
    variant === "green" ? "text-green-600" : "text-white";

  const wordmarkBase =
    variant === "dark"
      ? "text-white"
      : variant === "green"
        ? "text-white"
        : "text-ink-900";

  const accent =
    variant === "dark" || variant === "green" ? "text-green-400" : "text-green-600";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-[12px] font-display text-base font-extrabold ${markBg} ${markText}`}
        aria-hidden="true"
      >
        M
      </span>
      {withWordmark && (
        <span className={`font-display text-lg font-extrabold ${wordmarkBase}`}>
          My<span className={accent}>Nigerian</span>Guide
        </span>
      )}
    </div>
  );
}
