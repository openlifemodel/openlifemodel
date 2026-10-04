# Contributing to OpenLifeModel

Thanks for helping. OpenLifeModel is an experimental project: an open format
(OLM) for survival models, a reference engine, and a browser calculator. The
most valuable contributions are often not code: better evidence, sharper
critique of the method, and new models.

## Ways to help

| You want to… | Do this |
| --- | --- |
| Ask a question or discuss the method | Start a [Discussion](https://github.com/OpenLifeModel/openlifemodel/discussions) |
| Challenge a number in a model (a hazard ratio, a population share, a source) | Open a **Model evidence** issue |
| Report something broken | Open a **Bug report** issue |
| Suggest a feature or a change to the OLM format | Start a Discussion in **Ideas** first |
| Contribute a model | Open a pull request adding a `.olm.yaml` file (see below) |
| Report a security problem | Use [private vulnerability reporting](https://github.com/OpenLifeModel/openlifemodel/security/advisories/new), not a public issue (see [SECURITY.md](SECURITY.md)) |

## Contributing a model

Models live in [`models/`](models/) as OLM files; the format is described in
[`spec/OLM-SPEC.md`](spec/OLM-SPEC.md). The quickest way to make one is the
model editor on [openlifemodel.com](https://openlifemodel.com) (switch on
"Model editor"), then download the file.

A model is welcome when it:

- cites a source for every hazard ratio and population share (a DOI where one exists);
- states its intended population and its assumptions, including any likely double-counting between factors;
- includes reference tests (use `origin: published` for values reported by the source itself);
- passes `pnpm test`, which validates every file in `models/` and runs its tests.

Use `status: illustrative` for numbers that are not evidence-based. Each model
file carries its own `license`; choose one that lets others reuse it.

## Contributing code

Requirements: Node 24 and pnpm.

```bash
pnpm install
pnpm test                                  # engine, models and web tests
pnpm typecheck
pnpm --filter @openlifemodel/web dev       # http://localhost:3100
```

- Open an issue or Discussion before large changes, so we can agree on the approach.
- Keep the engine (`engine/`) free of UI code; it is used by the website and should be usable anywhere.
- New dependencies need a short justification (purpose, maintenance, licence) in the pull request; only licences compatible with Apache-2.0.
- Changes to the OLM format also update `spec/OLM-SPEC.md`, the JSON Schemas and the tests.
- Pull requests need passing CI. Keep them focused; one change per pull request is easiest to review.

## Licensing of contributions

By contributing you agree that your contribution is licensed under the licence
of the part of the repository it changes: Apache-2.0 for code, CC-BY-4.0 for
the specification and documentation, and the file's own `license` for model
files. The OpenLifeModel name and logo are not covered; see
[TRADEMARKS.md](TRADEMARKS.md).

## Conduct

Be kind and assume good faith. Disagree about evidence with evidence. See the
[Code of Conduct](CODE_OF_CONDUCT.md).
