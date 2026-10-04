import type { Metadata } from "next";
import { EarlyAccessForm } from "@/components/EarlyAccess";

export const metadata: Metadata = {
  title: "Early access",
  description: "Join the early-access list for OpenLifeModel accounts: track your estimate over time, add lab results and connect wearables.",
  alternates: { canonical: "/early-access/" },
};

export default function EarlyAccessPage() {
  return (
    <div className="max-w-2xl py-4 sm:py-10">
      <EarlyAccessForm />
    </div>
  );
}
