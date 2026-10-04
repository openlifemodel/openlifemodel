# ADR 0003: Next.js and React for the web app

Status: accepted (4 October 2026)

## Decision

The reference web app (`web/`) uses Next.js (App Router) with React and
Tailwind CSS, built as a static export (`output: "export"`). The survival
chart is hand-written SVG, with no chart library.

## Rationale

- The same codebase can later run as a server on our own infrastructure
  (accounts, stored data) by dropping the static export, with no rewrite.
- React carries over to a future mobile app: either wrapping the web app
  (Capacitor) or a React Native/Expo app sharing logic and the engine.
- The owner already knows the stack; it is the most widely used and supported
  option, which also helps contributors.
- Astro + Preact was considered: lighter pages, but "almost React" adds
  friction for the server and mobile paths, and page weight matters less for
  this audience.

## Consequences

- Content pages are prerendered HTML (good for search); only the calculator
  is interactive.
- The engine stays framework-free and is consumed as a workspace package.
