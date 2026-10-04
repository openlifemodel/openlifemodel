import type { MetadataRoute } from "next";
import { EARLY_ACCESS_ENABLED } from "@/components/EarlyAccess";
import { bundledModels } from "@/lib/models";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/` },
    { url: `${SITE_URL}/about/` },
    { url: `${SITE_URL}/models/` },
    { url: `${SITE_URL}/privacy/` },
    ...(EARLY_ACCESS_ENABLED ? [{ url: `${SITE_URL}/early-access/` }] : []),
    ...bundledModels().map(({ model }) => ({ url: `${SITE_URL}/models/${model.id}/` })),
  ];
}
