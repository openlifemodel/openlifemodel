import type { Metadata } from "next";
import Link from "next/link";
import { REPO_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How OpenLifeModel turns a life table and hazard ratios into a personal survival curve, what the results mean and what they cannot tell you.",
  alternates: { canonical: "/about/" },
};

export default function About() {
  return (
    <article className="prose-olm max-w-3xl">
      <h1 className="text-2xl font-semibold">How it works</h1>

      <p>
        OpenLifeModel estimates life expectancy the way actuaries and epidemiologists do, and shows
        every step. Nothing is hidden in a server or a proprietary formula: the models are plain
        files and the engine is open source.
      </p>

      <h2>1. Start from a life table</h2>
      <p>
        A national life table gives the chance that a person of a given age and sex dies within the
        next year. The default baseline is the US Social Security Administration&apos;s 2023 period
        life table. On its own, it reproduces SSA&apos;s published life expectancies to within 0.02
        years.
      </p>

      <h2>2. Adjust for personal factors</h2>
      <p>
        Studies report how much a factor such as smoking changes the risk of dying at any given
        age, as a <em>hazard ratio</em>: 2.0 means twice the yearly risk. A model multiplies the
        baseline risk by the hazard ratio for each of your answers. Because the life table already
        includes smokers and non-smokers, active and inactive people, the ratios are rescaled so
        that someone with population-average habits lands exactly on the national figure.
      </p>

      <p>
        The default model, <Link href="/models/us-lifestyle/">US adults: smoking, weight and exercise</Link>,
        takes its hazard ratios from three large studies: smoking and quitting from the US National
        Health Interview Survey (Jha et al., NEJM 2013), body mass index from a meta-analysis of 239
        cohorts (Global BMI Mortality Collaboration, Lancet 2016) and exercise from a pooled analysis
        of 661,000 adults (Arem et al., JAMA Internal Medicine 2015). The population averages come
        from the US NHANES survey.
      </p>

      <h2>3. Build the survival curve</h2>
      <p>
        Applying the adjusted yearly risks age by age gives your survival curve: the chance of
        still being alive at each future age. Life expectancy is the area under that curve, and
        the median age at death is where it crosses 50%. The exact formulas are in the{" "}
        <a href={`${REPO_URL}/blob/main/spec/OLM-SPEC.md`}>OLM specification</a>.
      </p>

      <h2 id="equivalent-age">Equivalent age</h2>
      <p>
        Your equivalent age is the age of an average person of your sex who has the same remaining life
        expectancy as you under the model. If the model gives a 29-year-old man 57.7 more years, and an average
        man has 57.7 years left at about 19, his equivalent age is 19. With average answers, it equals your
        real age.
      </p>
      <p>
        It is a way of expressing the same estimate, read straight from the national life table. It is not a
        measurement of your body, and it is not a &quot;biological age&quot; from blood tests or DNA.
      </p>

      <h2>What the results cannot tell you</h2>
      <ul>
        <li>
          They are averages for people who share your answers, not a prediction for you. Two
          people with identical profiles can live very different lives.
        </li>
        <li>
          Period life tables assume today&apos;s death rates continue. If medicine keeps improving,
          real lifespans will be longer.
        </li>
        <li>
          Factors are treated as independent. Many are linked (weight, blood pressure and activity,
          for instance), so combining them can overstate their joint effect.
        </li>
        <li>The models do not know your medical history, family history or anything you did not enter.</li>
      </ul>
      <p>This is not medical advice. Talk to a clinician about your own health.</p>

      <h2>Your privacy</h2>
      <p>
        The calculator runs in your browser, and this site never sends your answers to a server;
        they are remembered only in this browser so you do not have to retype them. There are no
        accounts and no cookies. We count visits with cookieless Cloudflare Web Analytics, which
        never sees what you enter. Details are on the <Link href="/privacy/">privacy page</Link>.
      </p>

      <h2>Open models, open format</h2>
      <p>
        Each model is an OLM file (<code>.olm.yaml</code>): a human-readable YAML document listing its baseline,
        factors, sources, assumptions and reference test cases. You can{" "}
        <Link href="/models/">browse the models</Link>, edit one in the calculator, export it, and
        share it. Researchers can publish a model alongside a paper so that anyone can run and
        verify it.
      </p>
      <p>
        The engine and calculator are open source under Apache-2.0, and the specification under
        CC-BY-4.0. Contributions and critique of the methodology are welcome on{" "}
        <a href={REPO_URL}>GitHub</a>.
      </p>
    </article>
  );
}
