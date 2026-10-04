# Agent rules

Rules for AI coding agents working in this repository.

## Workflow

- Work on a branch and open a PR against `main`. Never push to `main` directly,
  and never stack a PR on another PR's branch.
- The owner has delegated merging of the agent's own PRs once all checks pass.
  PRs from outside contributors are reviewed by the owner.
- Update `docs/platform-setup.md` in the same PR as any infrastructure or setup
  change. Record durable decisions as ADRs in `docs/adr/`.
- Ask the owner first before: DNS or domain changes, server infrastructure
  changes, anything that allows search indexing of a preview, anything
  involving money or real user data.

## Code

- TypeScript throughout. The engine and schema (`engine/`, `spec/`) must not
  import UI frameworks; the website consumes them like any other client.
- No new dependency without the owner's approval, stating its purpose,
  maintenance status and licence. Only permissively licensed dependencies
  compatible with Apache-2.0.
- The engine is deterministic: same profile and model in, same output out.
  Every model ships reference test cases that CI verifies.

## Public repository

- This repository is public. Never commit secrets, IP addresses, account IDs,
  personal data, or the owner's private business planning documents.
- Commercial hosted-product code (accounts, sync, integrations) does not belong
  here.
- Secrets are entered by the owner through hidden terminal prompts and stored
  outside the repo (`~/.config/openlifemodel/`, mode 600).
