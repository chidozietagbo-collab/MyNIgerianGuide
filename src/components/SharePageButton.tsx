"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

type SharePageButtonProps = {
  businessSlug: string;
};

export default function SharePageButton({ businessSlug }: SharePageButtonProps) {
  const [copied, setCopied] = useState(false);

  function handleClick() {
    const url = `${window.location.origin}/b/${businessSlug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-1.5 text-xs font-medium text-ink-500 transition hover:text-green-600"
    >
      <Share2 className="h-3.5 w-3.5" />
      {copied ? "Link copied!" : "Share page"}
    </button>
  );
}
