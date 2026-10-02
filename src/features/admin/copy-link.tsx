"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/ui/button";

export function CopyLink({ intro, url }: { intro: string; url: string }) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-primary-soft p-4" role="status">
      <p className="font-semibold">{intro}</p>
      <code className="rounded-lg bg-surface px-3 py-2 text-sm break-all">{url}</code>
      <Button
        variant="secondary"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        }}
      >
        {copied ? t("copied") : t("copy")}
      </Button>
    </div>
  );
}
