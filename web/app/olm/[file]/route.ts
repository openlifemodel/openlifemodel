import { bundledModels } from "@/lib/models";

// Serves the raw model files as static downloads.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return bundledModels().map(({ file }) => ({ file }));
}

export async function GET(_request: Request, { params }: RouteContext<"/olm/[file]">) {
  const { file } = await params;
  const found = bundledModels().find((m) => m.file === file);
  return new Response(found?.text ?? "Not found", {
    status: found ? 200 : 404,
    headers: { "Content-Type": "application/x-yaml; charset=utf-8" },
  });
}
