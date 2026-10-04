# ADR 0001: Licensing

Status: accepted (4 October 2026)

## Decision

- Code: Apache-2.0.
- Specification and documentation: CC-BY-4.0.
- Model files: each `.olm` declares its own licence (SPDX identifier) in a
  `license` field. Project example models use CC-BY-4.0.
- The OpenLifeModel name and logo are reserved (`TRADEMARKS.md`).
- The commercial hosted product (accounts, history, integrations) lives in a
  separate private repository and is not open source.

## Rationale

- A permissive licence maximises adoption of the engine and the `.olm` format
  by researchers, companies and other implementations, which is the point of an
  open standard.
- Apache-2.0 over MIT: it is equally permissive and familiar to contributors,
  but adds an explicit patent grant and states that it grants no trademark
  rights, which protects the project name.
- Copyleft (AGPL) was rejected: it deters exactly the companies and
  institutions whose adoption would make the format valuable, and the
  commercial moat comes from the private hosted product, brand and ecosystem
  rather than from restricting the engine.
- Per-model licences let academic, commercial and creator models coexist.

## Consequences

- Anyone may host or embed the engine and reference app, under a different
  name. This is accepted.
- No contributor licence agreement is needed: inbound contributions are under
  Apache-2.0, which also allows their use in the private product.
