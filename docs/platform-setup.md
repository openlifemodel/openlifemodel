# Platform setup

How OpenLifeModel's infrastructure is set up. Update this file in the same PR
as any change to it. No secrets, IP addresses or account IDs here.

## GitHub

- Repository `OpenLifeModel/openlifemodel` (public), owned by the
  `OpenLifeModel` organization.
- `main` is protected; changes arrive through PRs with passing CI. Head
  branches are deleted automatically after merge.

## Domain and DNS

- `openlifemodel.com` is registered with Cloudflare Registrar and uses
  Cloudflare DNS.
- DNSSEC: enabled through Cloudflare (registrar adds the DS record automatically).
- DMARC: `p=reject`, because no mail is sent as this domain yet. Relax it when outbound email (SES) is added.
- Email: Cloudflare Email Routing forwards `info@openlifemodel.com` to the
  owner's mailbox. No outbound email is sent by the project yet.

## Hosting

- MVP: static site (`web/`, Next.js static export to `web/out`) on Cloudflare
  Pages with the custom domain `openlifemodel.com`. The `*.pages.dev`
  hostname is served with `X-Robots-Tag: noindex` (`web/public/_headers`) and
  every page declares its `openlifemodel.com` URL as canonical. (Not yet
  deployed.)
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
