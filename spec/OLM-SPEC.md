# OLM Specification 0.2 (draft)

Status: **draft**. Expect breaking changes before 1.0.
Licence: [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).

OLM (OpenLifeModel) is a file format for survival models that estimate
all-cause mortality and life expectancy. An OLM model file contains everything an
implementation needs to reproduce a model's results: its baseline mortality,
how personal factors adjust that baseline, where the numbers came from, and
test cases that any implementation must reproduce.

The key words MUST, SHOULD and MAY are used as in RFC 2119.

## 1. Goals

- **Portable.** Plain YAML, readable without special tools.
- **Reproducible.** The calculation is fully specified (section 6) and every
  model can carry reference test cases (section 7).
- **Transparent.** Every number points to a source.
- **Small.** 0.2 supports one model type. Further types are added only when a
  real model needs them.
- **Extensible.** Models can declare their own inputs (section 3.1), so a new
  risk factor does not have to wait for a new version of this specification.

## 2. Files

- An OLM model file is a UTF-8 YAML 1.2 document whose top level is a mapping.
- Files SHOULD use the extension `.olm.yaml`. Implementations SHOULD also
  accept `.olm`, but must check the content: Outlook for Mac uses `.olm` for
  unrelated mailbox archives.
- It MUST validate against [`olm-0.2.schema.json`](olm-0.2.schema.json) and
  satisfy the additional rules in section 5.
- `olm` is `"0.2"`. Files written for 0.1 (`olm: "0.1"`) remain valid: 0.2
  only adds custom inputs.
- Media type (provisional): `application/vnd.openlifemodel+yaml`.

## 3. The person profile

Models read inputs from a **PersonProfile**, defined by
[`person-profile-0.2.schema.json`](person-profile-0.2.schema.json):

| Field | Type | Unit / values | Required |
| --- | --- | --- | --- |
| `age` | integer 0–119 | completed years | yes |
| `sex` | `male` \| `female` | as recorded in the baseline data | yes |
| `smoking_status` | `never`, `former_quit_before_35`, `former_quit_35_44`, `former_quit_45_54`, `former_quit_55_plus`, `former` (quit age unknown), `current` | | no |
| `bmi` | number 10–80 | kg/m² | no |
| `systolic_bp` | number 60–260 | mmHg | no |
| `mvpa_minutes_per_week` | number 0–5000 | leisure-time moderate-equivalent minutes (vigorous minutes count twice) | no |
| `alcohol_drinks_per_week` | number 0–200 | standard drinks (≈14 g ethanol) | no |
| `custom` | object | answers to custom inputs, keyed by input `id` | no |

Standard fields have fixed names and units, so the same profile can be run
through any model. A profile MUST NOT contain other top-level fields.

### 3.1 Custom inputs

A model MAY declare inputs that are not in the standard profile, for example
air pollution exposure or a study's own smoking categories:

```yaml
inputs:
  - id: pm25                       # lowercase, digits and underscores
    label: Air pollution           # at most 40 characters
    question: Average PM2.5 where you live   # at most 80
    help: Your city's annual average is on its air quality website.  # at most 240
    type: number
    unit: µg/m³                    # at most 16
    min: 0
    max: 200
  - id: commute
    label: Commute
    type: choice
    choices:
      - {value: car, label: Car}
      - {value: active, label: Walk or cycle}
```

- `type: number` inputs MUST give `unit`, `min` and `max` (and MAY give
  `step`); `type: choice` inputs MUST give 2 to 12 `choices`.
- A custom input MUST NOT reuse the id of a standard field, and every declared
  input MUST be used by a factor.
- Answers go in the profile's `custom` object, e.g. `custom: {pm25: 8.5}`. An
  implementation MUST reject answers outside `min`/`max`, choices that are not
  listed, and answers to inputs the model does not declare.
- Implementations display custom inputs from the declaration. Text limits keep
  questions short enough for a form on a phone.
- Custom inputs are model-specific: two models may use the same id for
  different things. When a custom input becomes widely used, it should be
  proposed as a standard field so that models using it can be compared.

## 4. Model file structure

| Key | Required | Meaning |
| --- | --- | --- |
| `olm` | yes | Spec version, `"0.2"` (`"0.1"` is still accepted). |
| `id` | yes | Stable identifier (lowercase, digits, hyphens). |
| `name`, `description` | yes | Human-readable name and summary. |
| `version` | yes | Semantic version of the model. Changing any number is at least a minor version. |
| `status` | yes | `illustrative` (demonstrates the format; numbers are not evidence-based), `experimental` (evidence-based, not validated) or `published` (reproduces an authoritative published source). |
| `license` | yes | SPDX identifier for the model file, or `LicenseRef-…`. Each model chooses its own. |
| `authors` | yes | List of `{name, url?, orcid?}`. |
| `population` | no | Who the model is intended for. |
| `assumptions` | no | Plain-language list of assumptions. |
| `inputs` | no | Custom inputs the model asks for (section 3.1). |
| `sources` | yes | List of `{id, citation, doi?, url?, license?, notes?}`, referenced by `id` elsewhere. |
| `baseline` | yes | Baseline mortality (section 4.1). |
| `adjustment` | no | Personal adjustments (section 4.2). Without it, the model is the baseline. |
| `tests` | no, but SHOULD be present | Reference test cases (section 7). |

### 4.1 Baseline

0.2 supports one baseline type, `period-life-table`:

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

0.2 supports `proportional-hazards`: each **factor** maps one profile input to
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
      levels:                         # one per allowed value (abridged here)
        - {value: never,   hazard_ratio: 1.0, prevalence: 0.58}
        - {value: former_quit_45_54, hazard_ratio: 1.5, prevalence: 0.04}
        # (other quit-age levels omitted here)
        - {value: current, hazard_ratio: 2.9, prevalence: 0.17}
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

- `label` is a short display name of at most 40 characters. Implementations
  describe levels themselves from the input's standard name and unit, so
  model authors never need to supply level wording.
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

**Limitation (0.2):** factors multiply independently. When factors are
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
4. A factor's `input` is a standard field or a declared custom input. Choice
   inputs (`smoking_status`, custom `choice` inputs) use `categorical` factors
   that list exactly one level per allowed value; numeric inputs use `banded`
   factors.
5. Bands are in ascending order. Only the first band omits `min` and only the
   last omits `max`. Each band's `max` equals the next band's `min`.
6. With `population-average` normalization, every level or band has a
   `prevalence`, and each factor's prevalences sum to 1 (±0.011, to allow
   for rounding).
7. Every test profile is a valid PersonProfile, and its `custom` answers are
   valid for the model.
8. Custom inputs follow the rules in section 3.1.

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
7. **Equivalent age** is the age `x*` at which an average person of the same
   sex under this baseline (`H = 1`) has the same remaining life expectancy
   `e`. Compute the baseline remaining life expectancy `e₀(x)` at each whole
   age `x₀ … ω` and interpolate linearly between the two whole ages whose
   values bracket `e`. If `e` is above `e₀(x₀)` the result is `x₀`; if it is
   below `e₀(ω)` the result is `ω`. A person with average exposure therefore
   has an equivalent age equal to their age.
8. **Survival to age 80, 90 and 100** is `S` at that age (from the tail
   formula if beyond `ω + 1`), or undefined if the person is already at or
   past that age.
9. **Factor contribution** in life-years is `e` minus the remaining life
   expectancy recomputed with that factor's HR set to 1. Contributions are
   not additive: they need not sum to the total difference from the baseline.
   Implementations MAY also report each factor's best and worst possible
   contribution: the same quantity computed for every level of the factor,
   with the other factors unchanged.

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

An implementation conforms to OLM 0.2 for a model if every expected output
lies within `tolerance` of its computed value. Supported outputs:
`remaining_life_expectancy`, `median_age_at_death`, `equivalent_age`, `survival_to_80`,
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
