# OpenLifeModel

**Transparent, reproducible and customizable longevity models.**

> ⚠️ **Experimental, pre-release.** Model outputs are educational statistical
> estimates, not medical advice or a prediction of any individual's lifespan.

Most life-expectancy calculators are black boxes: you enter some numbers and get
a single figure back. OpenLifeModel takes the opposite approach:

- **Open models.** Every model is a plain, human-readable `.olm` file that
  states its baseline mortality data, effect sizes, sources and assumptions.
- **One shared engine.** A small, deterministic, well-tested engine turns a
  profile and a model into a survival curve and life expectancy.
- **Compare and edit.** Run the same profile through different models, change an
  assumption and see the result change immediately.
- **Private by design.** The reference calculator runs entirely in your browser.
  Your inputs are never sent to a server.

## What the MVP will do

1. Enter a basic profile (age, sex, smoking, activity, blood pressure, BMI…).
2. Calculate remaining life expectancy, median survival age and the
   probability of reaching 80, 90 and 100.
3. Show the full survival curve and how much each factor contributes.
4. Switch between models, edit their assumptions, and import/export `.olm`
   files.

## Status

- [x] [OLM 0.1 specification draft](spec/OLM-SPEC.md) and JSON Schemas
- [x] Reference engine in TypeScript ([`engine/`](engine/)), tested against the
      US Social Security Administration's published life expectancies
- [x] Models: the [US SSA 2023 baseline](models/us-ssa-2023-period.olm) and an
      [evidence-based lifestyle model](models/us-lifestyle.olm) (smoking with quit
      age, BMI and exercise, each from a large published study)
- [x] Browser calculator with model editor and `.olm` import/export ([`web/`](web/))
- [x] Self-hosting Docker image

## Run it yourself

With Docker:

```bash
docker build -t openlifemodel .
docker run --rm -p 8080:8080 openlifemodel
```

Then open http://localhost:8080. Everything runs in the browser.

For development (Node 24 and pnpm):

```bash
pnpm install
pnpm test                                  # engine and model reference tests
pnpm --filter @openlifemodel/web dev       # http://localhost:3100
```

## Repository layout

| Path | Contents | Licence |
| --- | --- | --- |
| `spec/` | The OLM specification and JSON Schema | CC-BY-4.0 |
| `engine/` | TypeScript calculation engine, no UI dependencies | Apache-2.0 |
| `models/` | Example `.olm` models with reference test cases | Per file (`license` field) |
| `web/` | Reference browser calculator (Next.js, static export) | Apache-2.0 |

## The `.olm` format

`.olm` aims to be a portable, vendor-neutral format for publishing survival
models, so that a model described in a paper can be run and verified by any
compatible implementation. Each model file carries its own `license` field, so
authors choose the terms for their own models. The spec is at an early draft
stage and will change.

## Licensing

- Code (engine, reference app, tooling): [Apache License 2.0](LICENSE).
- Specification and documentation: [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).
- Model files: the licence declared inside each file.
- The OpenLifeModel name and logo are not covered by these licences; see
  [TRADEMARKS.md](TRADEMARKS.md).

## Contributing

Issues and discussion are welcome now. Code contributions will be easier once
the engine and spec skeleton land. By submitting a contribution you agree it is
licensed under the licence of the part of the repository it changes.

## Contact

info@openlifemodel.com · [openlifemodel.com](https://openlifemodel.com)
