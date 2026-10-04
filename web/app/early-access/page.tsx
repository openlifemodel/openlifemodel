import type { Metadata } from "next";
import Link from "next/link";
import { EARLY_ACCESS_ENABLED, EarlyAccess } from "@/components/EarlyAccess";

export const metadata: Metadata = {
  title: "Early access",
  description: "Join the early-access list for OpenLifeModel accounts: track your estimate over time, add lab results and connect wearables.",
  alternates: { canonical: "/early-access/" },
};

export default function EarlyAccessPage() {
  return (
    <div className="max-w-3xl">
      {EARLY_ACCESS_ENABLED ? (
        <EarlyAccess variant="page" />
      ) : (
        <p className="text-muted">
          Early access is only available on openlifemodel.com. This copy of the calculator works fully without it.
        </p>
      )}
      <p className="mt-10 text-sm text-muted">
        The calculator itself stays free and needs no account. <Link href="/" className="font-medium text-accent-strong underline underline-offset-4">Back to the calculator</Link>
      </p>
    </div>
  );
}
