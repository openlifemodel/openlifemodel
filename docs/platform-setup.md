# Platform setup

How OpenLifeModel's infrastructure is set up. Update this file in the same PR
as any change to it. No secrets, IP addresses or account IDs here.

## GitHub

- Repository `OpenLifeModel/openlifemodel` (public), owned by the
  `OpenLifeModel` organization.
- `main` is protected by the `protect-main` ruleset: no direct pushes,
  force-pushes or deletion; changes arrive through PRs that pass the `test`
  and `docker` checks. Only the owner (or an agent acting for the owner) can
  merge. Head branches are deleted automatically after merge.
- Actions: workflows from outside contributors' PRs always need the owner's
  approval to run.

## Domain and DNS

- `openlifemodel.com` is registered with Cloudflare Registrar and uses
  Cloudflare DNS.
- DNSSEC: enabled through Cloudflare (registrar adds the DS record automatically).
- `www.openlifemodel.com` 301-redirects to `https://openlifemodel.com` (same
  path and query) through a Cloudflare Single Redirect rule; the apex is the
  canonical host.
- DMARC: `p=reject`, because no mail is sent as this domain yet. Relax it when outbound email (SES) is added.
- Email: Cloudflare Email Routing forwards `info@openlifemodel.com` to the
  owner's mailbox. No outbound email is sent by the project yet.

## Hosting

- MVP: static site (`web/`, Next.js static export to `web/out`) on Cloudflare
  Pages with the custom domain `openlifemodel.com`. The `*.pages.dev`
  hostname is served with `X-Robots-Tag: noindex` (`web/public/_headers`) and
  every page declares its `openlifemodel.com` URL as canonical.
- Deploys: `.github/workflows/deploy.yml` runs on every push to `main` (and
  manually), re-runs the tests, builds the site and publishes it with Wrangler
  to the Pages project `openlifemodel`. It uses the GitHub `production`
  environment (protected branches only) and two repository secrets:
  `CLOUDFLARE_API_TOKEN` (token `openlifemodel-github-deploy`, Account →
  Cloudflare Pages → Edit only, expires May 2027) and `CLOUDFLARE_ACCOUNT_ID`.
- Pull requests from outside contributors need the owner's approval before
  any workflow runs, and never receive secrets.
- Self-hosting: the root `Dockerfile` builds the same site and serves it with
  unprivileged nginx on port 8080. CI builds and smoke-tests the image.
- The reference calculator runs entirely in the browser; no server receives
  user health data.
- A Hetzner Cloud server (Helsinki) is reserved for the later hosted product
  and is not in use.

## Agent credentials (owner's Mac)

- Stored in `~/.config/openlifemodel/` (mode 700, files mode 600).
- `cloudflare-api-token`: scoped to the `openlifemodel.com` zone (DNS, zone
  settings, email routing rules) and account-level Email Routing addresses and
  Pages. Expires May 2027. Backup copy in the owner's password manager.
- SSH admin key for the future server: `~/.ssh/id_ed25519_olm_admin`
  (passphrase-protected, backed up in the password manager, added to Hetzner).
