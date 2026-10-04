"use client";

import { useEffect, useState } from "react";

// The address is put together in the browser, so it never appears whole in the
// page source or the data Next.js embeds, which is what spam scrapers read.
const USER = "info";
const DOMAIN = "openlifemodel.com";

export function ContactEmail({ className }: { className?: string }) {
  const [address, setAddress] = useState<string | null>(null);
  useEffect(() => setAddress(`${USER}@${DOMAIN}`), []);
  if (!address) return <span className={className}>{`${USER} at ${DOMAIN}`}</span>;
  return (
    <a href={`mailto:${address}`} className={className}>
      {address}
    </a>
  );
}
