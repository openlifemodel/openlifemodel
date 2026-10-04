import type { Metadata } from "next";
import { ContactEmail } from "@/components/ContactEmail";
import { REPO_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What openlifemodel.com does and does not collect.",
  alternates: { canonical: "/privacy/" },
};

export default function Privacy() {
  return (
    <article className="prose-olm max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
      <p className="text-sm text-muted">Last updated 4 October 2026</p>

      <p>
        The short version: the calculator works out your results in your own browser, and this site never
        sends your answers to a server. There are no accounts, no cookies and no ads. If you choose to join the
        early-access list, we keep your email to tell you when accounts open.
      </p>

      <h2>Your answers</h2>
      <ul>
        <li>
          Everything you enter in the calculator and the model editor is processed by code running in your
          browser. This site does not send it to us or to anyone else.
        </li>
        <li>
          To save you retyping, your answers and your theme choice are remembered in your browser&apos;s local
          storage on this device only. Clearing this site&apos;s data in your browser removes them.
        </li>
        <li>
          Model files you import or export stay on your device unless you choose to share them.
        </li>
      </ul>

      <h2 id="early-access">Early-access list</h2>
      <p>
        If you join the early-access list, we store your email address, the date, the boxes you ticked about what you
        would use accounts for, and the site that referred you (for example news.ycombinator.com). We do not store
        your IP address or anything you entered in the calculator. The list is kept in a Cloudflare database in
        Western Europe and used only to email you when accounts open. Every email will include a way to unsubscribe,
        and you can ask us to delete your entry at any time by writing to{" "}
        <ContactEmail />.
      </p>

      <h2>Visit statistics</h2>
      <p>
        We use Cloudflare Web Analytics to count visits. It sets no cookies and does not build a profile of
        you. It records the page viewed, the site that linked to it, your approximate country, your browser
        type and how quickly the page loaded. It never sees what you enter in the calculator.
      </p>

      <h2>Hosting</h2>
      <p>
        The site is served by Cloudflare. Like any web host, Cloudflare processes technical connection data
        such as IP addresses to deliver pages and protect the site from abuse.
      </p>

      <h2>What we cannot control</h2>
      <p>
        Browser extensions, AI assistants built into browsers, and other software on your device can read
        anything shown on any web page, including this one. Check what you have installed if that concerns you.
      </p>

      <h2>Accounts in the future</h2>
      <p>
        We may later offer optional accounts for saving your history. Signing up will always be optional, it
        will come with its own clear privacy terms before you share anything, and the calculator will keep
        working without an account.
      </p>

      <h2>Open source</h2>
      <p>
        The code for this site is <a href={REPO_URL}>public on GitHub</a>, so you can check what it does. If you
        run your own copy, it does not include our visit statistics.
      </p>

      <h2>Contact</h2>
      <p>
        Questions: <ContactEmail />
      </p>
    </article>
  );
}
