# OLM Specification 0.1 (draft)

Status: **draft**. Expect breaking changes before 1.0.
Licence: [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).

OLM (OpenLifeModel) is a file format for survival models that estimate
all-cause mortality and life expectancy. An `.olm` file contains everything an
implementation needs to reproduce a model's results: its baseline mortality,
how personal factors adjust that baseline, where the numbers came from, and
test cases that any implementation must reproduce.

The key words MUST, SHOULD and MAY are used as in RFC 2119.

## 1. Goals

- **Portable.** Plain YAML, readable without special tools.
- **Reproducible.** The calculation is fully specified (section 6) and every
  model can carry reference test cases (section 7).
- **Transparent.** Every number points to a source.
- **Small.** 0.1 supports one model type. Further types are added only when a
  real model needs them.

## 2. Files

- An `.olm` file is a UTF-8 YAML 1.2 document whose top level is a mapping.
- It MUST validate against [`olm-0.1.schema.json`](olm-0.1.schema.json) and
  satisfy the additional rules in section 5.
- Media type (provisional): `application/vnd.openlifemodel+yaml`.

## 3. The person profile

Models read inputs from a **PersonProfile**, defined by
[`person-profile-0.1.schema.json`](person-profile-0.1.schema.json):

| Field | Type | Unit / values | Required |
| --- | --- | --- | --- |
| `age` | integer 0–119 | completed years | yes |
| `sex` | `male` \| `female` | as recorded in the baseline data | yes |
| `smoking_status` | `never` \| `former` \| `current` | | no |
| `bmi` | number 10–80 | kg/m² | no |
| `systolic_bp` | number 60–260 | mmHg | no |
| `mvpa_minutes_per_week` | number 0–5000 | minutes of moderate-to-vigorous activity | no |
| `alcohol_drinks_per_week` | number 0–200 | standard drinks (≈14 g ethanol) | no |

Fields have fixed names and units, so the same profile can be run through any
model. New fields are added in later versions of the profile schema; a profile
MUST NOT contain fields that the schema does not define.

## 4. Model file structure

| Key | Required | Meaning |
| --- | --- | --- |
| `olm` | yes | Spec version, `"0.1"`. |
| `id` | yes | Stable identifier (lowercase, digits, hyphens). |
| `name`, `description` | yes | Human-readable name and summary. |
| `version` | yes | Semantic version of the model. Changing any number is at least a minor version. |
| `status` | yes | `illustrative` (demonstrates the format; numbers are not evidence-based), `experimental` (evidence-based, not validated) or `published` (reproduces an authoritative published source). |
| `license` | yes | SPDX identifier for the model file, or `LicenseRef-…`. Each model chooses its own. |
| `authors` | yes | List of `{name, url?, orcid?}`. |
| `population` | no | Who the model is intended for. |
| `assumptions` | no | Plain-language list of assumptions. |
| `sources` | yes | List of `{id, citation, doi?, url?, license?, notes?}`, referenced by `id` elsewhere. |
| `baseline` | yes | Baseline mortality (section 4.1). |
| `adjustment` | no | Personal adjustments (section 4.2). Without it, the model is the baseline. |
| `tests` | no, but SHOULD be present | Reference test cases (section 7). |

### 4.1 Baseline

0.1 supports one baseline type, `period-life-table`:

```yaml
baseline:
  type: period-life-table
  source: ssa-2023          # a sources[].id
  start_age: 0
  qx:
    male:   [0.006015, 0.000479, ...]
    female: [0.005125, 0.000392, ...]
```

`qx[sex][i]` is the probability that a person alive at exact age
`start_age + i` dies before age `start_age + i + 1`. Each value is in [0, 1).

### 4.2 Adjustment

0.1 supports `proportional-hazards`: each **factor** maps one profile input to
a hazard ratio (HR), and the person's hazard at every age is the baseline
hazard multiplied by the product of the factors' HRs.

```yaml
adjustment:
  method: proportional-hazards
  normalization: population-average   # or: none
  factors:
    - id: smoking
      label: Smoking
      input: smoking_status
      type: categorical
      missing: neutral                # or: required
      source: some-study
      levels:
        - {value: never,   hazard_ratio: 1.0, prevalence: 0.55}
        - {value: former,  hazard_ratio: 1.3, prevalence: 0.30}
        - {value: current, hazard_ratio: 2.5, prevalence: 0.15}
    - id: bmi
      label: Body mass index
      input: bmi
      type: banded
      missing: neutral
      bands:                          # [min, max)
        - {max: 18.5, hazard_ratio: 1.5, prevalence: 0.02}
        - {min: 18.5, max: 25, hazard_ratio: 1.0, prevalence: 0.30}
        - {min: 25, hazard_ratio: 1.2, prevalence: 0.68}
```

- **categorical** factors list one `level` per allowed input value.
- **banded** factors divide a numeric input into contiguous ranges. A value
  `x` falls in the band where `min ≤ x < max`.
- **normalization**
  - `population-average`: a baseline life table describes the *whole*
    population, including smokers and non-smokers. Each factor's HRs are
    divided by their prevalence-weighted mean, `Σ prevalenceₖ · HRₖ`, so that
    a person with average exposure reproduces the baseline. This requires a
    `prevalence` for every level or band.
  - `none`: HRs are applied as written. Use it when the baseline already
    describes the reference group.
- **missing**
  - `neutral`: if the input is absent, the factor's HR is 1 (after
    normalization, this means "population average"). Implementations SHOULD
    tell the user.
  - `required`: if the input is absent, the calculation MUST fail.

**Limitation (0.1):** factors multiply independently. When factors are
correlated (for example BMI and blood pressure), multiplying HRs from
separate studies double-counts their shared effect. Model authors SHOULD use
mutually adjusted HRs where available and MUST state the issue in
`assumptions` otherwise. Interactions and age-varying effects are planned for
later versions.

## 5. Rules beyond the JSON Schema

A valid model MUST also satisfy:

1. Every `source` reference names an entry in `sources`, and source `id`s are
   unique.
2. All `baseline.qx` tables have the same length.
3. Factor `id`s are unique, and no two factors read the same input.
4. `smoking_status` factors are `categorical` and list exactly the values
   `never`, `former` and `current`; numeric inputs use `banded` factors.
5. Bands are in ascending order. Only the first band omits `min` and only the
   last omits `max`. Each band's `max` equals the next band's `min`.
6. With `population-average` normalization, every level or band has a
   `prevalence`, and each factor's prevalences sum to 1 (±0.011, to allow
   for rounding).
7. Every test profile is a valid PersonProfile.

## 6. Calculation

Given a model and a profile with age `a` and sex `s`:

1. Let `q = baseline.qx[s]`, `x₀ = start_age` and `ω = x₀ + len(q) − 1` (the
   last age in the table). The calculation fails if the table for `s` is
   missing or `a` is outside `[x₀, ω]`.
2. Compute each factor's HR (section 4.2) and their product `H`.
3. For each age `x`, the baseline force of mortality is
   `μₓ = −ln(1 − qₓ)`, constant within the year. The person's force is `H·μₓ`.
   After age `ω + 1`, the force stays at `H·μ_ω`.
4. Survival from age `a` is `S(a) = 1` and `S(x+1) = S(x) · exp(−H·μₓ)`.
5. **Remaining life expectancy** is the exact area under the survival curve:
   `e = Σₓ S(x) · (1 − exp(−H·μₓ)) / (H·μₓ)` for `x = a … ω`, plus
   `S(ω+1) / (H·μ_ω)` for the tail. (Use 1 for the fraction when `H·μₓ = 0`.)
6. **Median age at death** is the age `t` where `S(t) = 0.5`, found exactly
   within the year where survival crosses one half:
   `t = x + ln(S(x) / 0.5) / (H·μₓ)`.
7. **Survival to age 80, 90 and 100** is `S` at that age (from the tail
   formula if beyond `ω + 1`), or undefined if the person is already at or
   past that age.
8. **Factor contribution** in life-years is `e` minus the remaining life
   expectancy recomputed with that factor's HR set to 1. Contributions are
   not additive: they need not sum to the total difference from the baseline.

With no adjustment (`H = 1`), this reproduces a standard life table's life
expectancy. The bundled US SSA 2023 model matches SSA's published values to
within 0.02 years at ages 0–80.

## 7. Reference test cases

```yaml
tests:
  - name: Favourable profile, male aged 40
    profile: {age: 40, sex: male, smoking_status: never}
    expect:
      remaining_life_expectancy: {value: 45.9059, tolerance: 0.001}
      survival_to_90: {value: 0.4509, tolerance: 0.0001}
```

An implementation conforms to OLM 0.1 for a model if every expected output
lies within `tolerance` of its computed value. Supported outputs:
`remaining_life_expectancy`, `median_age_at_death`, `survival_to_80`,
`survival_to_90`, `survival_to_100` and `combined_hazard_ratio`.

Authors SHOULD use independently published values where they exist (for
example, a statistics agency's published life expectancies) and SHOULD
otherwise pin values produced by the reference engine.

## 8. Interpretation

Model outputs are statistical estimates for a population with a person's
characteristics. They are not predictions of any individual's lifespan,
diagnoses or medical advice. Implementations SHOULD display a model's
`status`, sources and assumptions alongside its results.

## 9. Planned for later versions

Age-varying effects, interactions between factors, continuous (spline) effects,
cohort life tables and mortality improvement, uncertainty intervals,
parametric survival models, competing risks, model composition (reusing a
baseline from another file) and more profile fields.
