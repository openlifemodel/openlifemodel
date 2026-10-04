# OpenLifeModel

**Transparent, reproducible and customizable longevity models.**

> ⚠️ **Experimental, pre-release.** Nothing here is usable yet. Model outputs are
> educational statistical estimates, not medical advice or a prediction of any
> individual's lifespan.

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

## Repository layout (planned)

| Path | Contents | Licence |
| --- | --- | --- |
| `spec/` | The OLM specification and JSON Schema | CC-BY-4.0 |
| `engine/` | TypeScript calculation engine, no UI dependencies | Apache-2.0 |
| `models/` | Example `.olm` models with reference test cases | Per file (examples: CC-BY-4.0) |
| `web/` | Reference browser calculator | Apache-2.0 |

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
