import type { MetadataRoute } from "next";
import { bundledModels } from "@/lib/models";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/` },
    { url: `${SITE_URL}/about/` },
    { url: `${SITE_URL}/models/` },
    ...bundledModels().map(({ model }) => ({ url: `${SITE_URL}/models/${model.id}/` })),
  ];
}
