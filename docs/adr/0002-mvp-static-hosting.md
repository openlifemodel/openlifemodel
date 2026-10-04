# ADR 0002: Static, client-side MVP

Status: accepted (4 October 2026)

## Decision

The MVP calculator is a static site that runs the engine in the browser. It is
hosted on Cloudflare Pages under `openlifemodel.com`; the `*.pages.dev`
hostname redirects there and is not indexed. The repository also ships a
Dockerfile that serves the same static build for self-hosting.

## Rationale

- No health data reaches a server, which is the simplest privacy and GDPR
  position and a clear message for launch.
- No server to patch or monitor; Pages absorbs traffic spikes.
- The hosted site and a self-hosted copy are the same build, so they never
  diverge.
- Search pages (landing, methodology, model pages, spec) are pre-rendered HTML
  so they can be indexed.

## Consequences

- Moving to the Hetzner server later only changes where the domain points.
- Accounts and stored data, when added, will be a separate service in a
  private repository; the public calculator remains usable without it.
