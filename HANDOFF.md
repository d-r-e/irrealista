# HANDOFF.md — Idealista Personalized Property Scoring Extension

## 1. Objective

Build a Chromium browser extension that augments Idealista property listings with a personalized, explainable score based on configurable user preferences.

The extension must:

- Read property data visible on Idealista listing/search pages.
- Extract deterministic fields directly from the DOM whenever possible.
- Use an OpenAI-compatible LLM endpoint only for ambiguous/unstructured attributes.
- Enrich listings with geographic information such as walking distance to the nearest metro station.
- Normalize all features into a configurable utility model.
- Compute a personalized score from 0–100.
- Show the score and its detailed breakdown directly inside Idealista.
- Allow sorting visible listings by personalized score.
- Cache derived data to avoid repeated LLM/geospatial requests.
- Treat missing/unknown data explicitly instead of hallucinating values.
- Keep the scoring algorithm deterministic and independent from the LLM.

The LLM is only an extraction/classification component. It must never decide whether a property is "good" or "bad".

---

## 2. Target Platform

Initial target:

- Chromium browsers
- Manifest V3
- TypeScript
- Recommended build tooling: Vite
- Recommended UI framework: React or lightweight vanilla TypeScript
- Browser APIs:
  - `chrome.runtime`
  - `chrome.storage`
  - `chrome.scripting`
  - content scripts
  - background service worker

Potential later support:

- Firefox/WebExtensions

---

## 3. Provider Configuration

The OpenAI-compatible provider is configured at runtime from the extension's Options page and stored in `chrome.storage.local`. The extension does not read `.env` files or bundle provider credentials at build time.

The application exposes a typed configuration object similar to:

```ts
export interface OpenAIConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}
```

Validate all required values during initialization.

Support OpenAI-compatible APIs such as:

- OpenAI
- vLLM
- LiteLLM
- llama.cpp server
- LM Studio
- compatible self-hosted endpoints

Prefer `/chat/completions` initially unless the selected compatibility layer makes `/responses` straightforward.

---

## 4. High-Level Architecture

```text
Idealista page
    │
    ▼
Content Script
    │
    ├── Parse listing cards / property page
    │
    ├── Extract deterministic fields
    │
    ├── Inject score UI
    │
    └── Send enrichment requests
    │
    ▼
Background Service Worker
    │
    ├── Cache
    ├── LLM structured extraction
    ├── Geospatial enrichment
    └── Feature normalization
    │
    ▼
Scoring Engine
    │
    ├── Hard filters
    ├── Utility curves
    ├── Weighted scoring
    └── Confidence / data quality
    │
    ▼
Content Script
    │
    ├── Render score
    ├── Render explanations
    └── Reorder visible cards
```

Keep responsibilities separated.

Recommended modules:

```text
src/
  background/
    index.ts
    llm.ts
    cache.ts
    geo.ts

  content/
    index.ts
    idealista-parser.ts
    idealista-observer.ts
    renderer.ts
    sorter.ts

  scoring/
    engine.ts
    utility.ts
    filters.ts
    defaults.ts

  schemas/
    property.ts
    llm-output.ts
    preferences.ts

  storage/
    preferences.ts
    listings.ts

  options/
    App.tsx

  shared/
    config.ts
    messages.ts
    types.ts
```

---

# 5. Property Data Model

Use a normalized property representation.

```ts
export type FeatureSource =
  | "idealista_dom"
  | "idealista_text"
  | "llm"
  | "geospatial"
  | "computed";

export interface Feature<T> {
  value: T | null;
  source: FeatureSource;
  confidence: number;
}

export interface PropertyFeatures {
  listingId: string;
  url: string;

  price: Feature<number>;
  areaM2: Feature<number>;
  pricePerM2: Feature<number>;

  floor: Feature<number>;
  isGroundFloor: Feature<boolean>;
  elevator: Feature<boolean>;

  exterior: Feature<boolean>;
  orientation: Feature<Orientation[]>;
  crossVentilation: Feature<boolean>;

  constructionYear: Feature<number>;
  buildingAge: Feature<number>;

  energyRating: Feature<EnergyRating>;

  renovationState: Feature<RenovationState>;

  nearestMetroDistanceM: Feature<number>;
  nearestMetroWalkingMinutes: Feature<number>;
  nearestMetroName: Feature<string>;
}
```

Suggested enums:

```ts
export type Orientation =
  | "north"
  | "northeast"
  | "east"
  | "southeast"
  | "south"
  | "southwest"
  | "west"
  | "northwest";

export type RenovationState =
  | "new"
  | "excellent"
  | "good"
  | "minor"
  | "major"
  | "full"
  | "unknown";

export type EnergyRating =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "unknown";
```

All ambiguous properties must support `null` / `unknown`.

Never convert lack of evidence into a negative fact.

Example:

```ts
crossVentilation.value = null;
```

means:

> Unknown.

It does NOT mean:

> No cross ventilation.

---

# 6. Deterministic Extraction

Extract fields directly from Idealista HTML whenever available.

Candidate deterministic features:

- listing ID
- URL
- asking price
- square meters
- price per square meter
- floor
- elevator
- exterior/interior when explicitly structured
- construction year
- energy rating
- property condition when explicitly structured
- address/location text exposed to the user

Do not use the LLM for fields that can be parsed deterministically.

Implement DOM parsing defensively.

Avoid selectors based solely on generated CSS classes.

Prefer, in order:

1. semantic attributes
2. stable `data-*` attributes
3. item metadata
4. accessible labels
5. known textual structures
6. CSS selectors only as last resort

Create parser fixtures using saved/synthetic HTML fragments so that DOM extraction can be unit tested without accessing Idealista.

Example interface:

```ts
export interface IdealistaListingRaw {
  listingId: string;
  url: string;

  title?: string;
  description?: string;

  price?: number;
  areaM2?: number;
  floorText?: string;
  elevator?: boolean;
  exterior?: boolean;

  constructionYear?: number;
  energyRating?: string;

  locationText?: string;

  rawFeatureTexts: string[];
}
```

---

# 7. LLM Structured Extraction

Use the LLM only for features that require interpretation of natural language.

Primary candidates:

- exterior/interior if unclear
- orientation
- cross ventilation
- renovation requirement
- inferred condition
- possibly construction details when written only in description

The LLM must return structured output.

Recommended schema:

```ts
export interface LLMFeature<T> {
  value: T | null;
  confidence: number;
  evidence?: string[];
}

export interface PropertyLLMExtraction {
  exterior: LLMFeature<boolean>;
  crossVentilation: LLMFeature<boolean>;
  orientation: LLMFeature<Orientation[]>;
  renovationState: LLMFeature<RenovationState>;
}
```

Required behavior:

- Use only evidence explicitly contained in the supplied listing data.
- Return `null` if insufficient evidence exists.
- Never infer facts from generic marketing language.
- Do not interpret "luminoso" as south-facing.
- Do not interpret "dos ventanas" as cross ventilation.
- Do not infer exterior/interior without evidence.
- Confidence must describe extraction confidence, not attractiveness.

Suggested system prompt:

```text
You extract factual housing attributes from Spanish real-estate listings.

Your job is information extraction, not recommendation.

Rules:
- Use only information explicitly stated or strongly entailed by the provided listing.
- Never guess.
- When evidence is insufficient, return null.
- Marketing adjectives such as "luminoso", "fantástico", "ideal" or "acogedor"
  do not prove orientation, exterior status, cross ventilation or renovation condition.
- Cross ventilation requires evidence that air can flow through openings on different
  facades/orientations or an explicit statement equivalent to "ventilación cruzada".
- Return only values allowed by the provided JSON schema.
- Confidence ranges from 0 to 1 and represents certainty that the extracted fact is correct.
```

Send only the minimum necessary listing content.

Example request input:

```json
{
  "title": "Piso exterior reformado en...",
  "description": "...",
  "features": [
    "4ª planta exterior",
    "Con ascensor",
    "Orientación sur y este"
  ]
}
```

Example output:

```json
{
  "exterior": {
    "value": true,
    "confidence": 0.99,
    "evidence": ["4ª planta exterior"]
  },
  "crossVentilation": {
    "value": null,
    "confidence": 0
  },
  "orientation": {
    "value": ["south", "east"],
    "confidence": 0.99,
    "evidence": ["Orientación sur y este"]
  },
  "renovationState": {
    "value": "excellent",
    "confidence": 0.9,
    "evidence": ["reformado"]
  }
}
```

Validate LLM output using JSON Schema / Zod.

Never trust raw model output without validation.

---

# 8. Geospatial / Metro Enrichment

The extension should calculate proximity to metro.

For Madrid, avoid querying a third-party places API for every station.

Maintain a local static dataset:

```ts
export interface TransitStation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  lines: string[];
  type: "metro" | "cercanias";
}
```

Initial scope:

```text
data/madrid-metro.json
```

Possible later datasets:

```text
data/madrid-cercanias.json
data/madrid-bus.json
```

Workflow:

```text
Property location
    ↓
Coordinates
    ↓
Haversine distance to all metro stations
    ↓
Top N nearest candidates
    ↓
Optional walking route calculation
    ↓
Nearest station by walking distance
```

Recommended `N`:

```text
5
```

This minimizes route API calls.

Abstract geospatial providers behind interfaces:

```ts
export interface Geocoder {
  geocode(query: string): Promise<Coordinates | null>;
}

export interface WalkingRouter {
  route(
    origin: Coordinates,
    destination: Coordinates
  ): Promise<WalkingRoute | null>;
}
```

This makes Google Maps replaceable.

Google-specific implementation can later use:

- Geocoding API
- Routes API

Do not couple scoring code to Google APIs.

If walking routing is unavailable, fall back to Haversine distance and clearly mark its source.

---

# 9. User Preference Model

The scoring configuration must support:

1. criterion weight
2. utility function
3. hard filters
4. categorical preferences
5. interactions between features

Example:

```ts
export interface CriterionConfig {
  enabled: boolean;
  weight: number;
  utility: UtilityDefinition;
}
```

Weight range:

```text
0–10
```

Suggested configurable criteria:

- distance to metro
- square meters
- price
- price per square meter
- exterior/interior
- ground floor
- floor
- elevator
- high floor without elevator
- cross ventilation
- orientation
- construction year / age
- energy efficiency
- renovation requirement

---

# 10. Utility Curves

Do not implement scoring as simple binary values.

Each numerical criterion should support a piecewise-linear utility curve.

Example:

```ts
export interface UtilityPoint {
  x: number;
  score: number;
}

export interface PiecewiseLinearUtility {
  type: "piecewise";
  points: UtilityPoint[];
}
```

Example metro preference:

```json
{
  "type": "piecewise",
  "points": [
    { "x": 0, "score": 100 },
    { "x": 200, "score": 100 },
    { "x": 400, "score": 90 },
    { "x": 600, "score": 70 },
    { "x": 800, "score": 40 },
    { "x": 1000, "score": 10 },
    { "x": 1200, "score": 0 }
  ]
}
```

Example price:

```json
{
  "type": "piecewise",
  "points": [
    { "x": 200000, "score": 100 },
    { "x": 220000, "score": 100 },
    { "x": 230000, "score": 90 },
    { "x": 240000, "score": 70 },
    { "x": 250000, "score": 40 },
    { "x": 260000, "score": 0 }
  ]
}
```

Example area:

```json
{
  "type": "piecewise",
  "points": [
    { "x": 35, "score": 0 },
    { "x": 45, "score": 30 },
    { "x": 50, "score": 60 },
    { "x": 60, "score": 90 },
    { "x": 70, "score": 100 }
  ]
}
```

Interpolation between points must be deterministic.

Clamp outside the configured domain to the endpoint score unless explicitly configured otherwise.

---

# 11. Categorical Utilities

Categorical features should use explicit utility maps.

Example orientation:

```json
{
  "south": 100,
  "southeast": 95,
  "east": 90,
  "southwest": 85,
  "west": 60,
  "northeast": 50,
  "northwest": 40,
  "north": 20
}
```

For multiple orientations, define a deterministic aggregation strategy.

Recommended initial behavior:

```text
maximum configured orientation utility
```

Later optionally support:

- mean
- maximum
- weighted combination

Example exterior:

```json
{
  "true": 100,
  "false": 20
}
```

Example energy rating:

```json
{
  "A": 100,
  "B": 90,
  "C": 80,
  "D": 65,
  "E": 45,
  "F": 25,
  "G": 10
}
```

---

# 12. Interaction Rules

Some features should not be independent.

Example:

> A high floor is desirable with an elevator but strongly undesirable without one.

Support conditional modifiers.

```ts
export interface InteractionRule {
  id: string;
  condition: RuleCondition;
  multiplier?: number;
  scoreDelta?: number;
}
```

Example:

```json
{
  "id": "high-floor-no-elevator",
  "condition": {
    "all": [
      { "field": "floor", "operator": ">=", "value": 4 },
      { "field": "elevator", "operator": "==", "value": false }
    ]
  },
  "multiplier": 0.25
}
```

Another example:

```text
Ground floor + interior → additional penalty
```

Keep the rules engine generic.

---

# 13. Hard Filters

Preferences and hard constraints must be separate.

Examples:

```text
Price > 250000              → reject
Area < 45 m²                → reject
Metro distance > 1200 m     → reject
Floor >= 4 without elevator → reject
```

Data model:

```ts
export interface HardFilter {
  id: string;
  enabled: boolean;
  field: keyof PropertyFeatures;
  operator:
    | "<"
    | "<="
    | ">"
    | ">="
    | "=="
    | "!="
    | "in"
    | "not_in";
  value: unknown;
}
```

Result:

```ts
export interface FilterResult {
  passed: boolean;
  failedFilters: string[];
}
```

Listings rejected by hard filters should remain visible by default but marked:

```text
Does not meet filters
```

Provide an option to hide them.

---

# 14. Score Formula

For all enabled criteria with known values:

```text
utility_i ∈ [0, 100]
weight_i ∈ [0, 10]
```

Base score:

```text
score =
  Σ(weight_i × utility_i)
  ───────────────────────
       Σ(weight_i)
```

Then apply interaction rules.

Clamp final score:

```text
0 ≤ score ≤ 100
```

Unknown values should NOT automatically score zero.

Default behavior:

- omit unknown feature from the denominator
- separately reduce data-confidence score

This prevents an incomplete listing from being unfairly punished as if missing data implied a negative attribute.

---

# 15. Data Quality / Confidence Score

Provide two independent values:

```text
Property score: 87 / 100
Data confidence: 91%
```

Do not mix LLM confidence into desirability directly.

Suggested confidence model:

Each feature has:

```text
importance × confidence
```

Overall:

```text
confidence =
  Σ(weight_i × availability_i × confidence_i)
  ───────────────────────────────────────────
               Σ(weight_i)
```

Where:

```text
availability = 1 if known
availability = 0 if unknown
```

Confidence for deterministic sources:

```text
DOM structured field: 1.0
computed value:       1.0
geospatial API:       ~1.0
LLM extraction:       model-provided confidence after validation
```

Do not claim probabilistic calibration unless it is actually implemented.

Call this value:

```text
Data confidence
```

or:

```text
Data completeness/confidence
```

not statistical probability.

---

# 16. Explainability

Every score must be explainable.

Example:

```ts
export interface ScoreContribution {
  criterion: string;
  rawValue: unknown;
  utility: number;
  weight: number;
  weightedContribution: number;
  source: FeatureSource;
  confidence: number;
}
```

Render:

```text
SCORE 87 / 100

Metro
374 m / ~5 min
Utility: 94
Weight: 10

Orientation
South + East
Utility: 100
Weight: 8

Area
61 m²
Utility: 92
Weight: 8

Price
239,000 €
Utility: 72
Weight: 10

Renovation
Minor renovation
Utility: 60
Weight: 5
```

The user must be able to understand why property A outranks property B.

---

# 17. Idealista UI Injection

Enhance listing cards without destroying the original Idealista UI.

Example compact badge:

```text
┌───────────────┐
│ SCORE         │
│ 87 / 100      │
│ Confidence 91 │
└───────────────┘
```

Expanded view:

```text
87 / 100

+ Metro             94
+ Orientation      100
+ Ventilation       90
+ Area              92
- Price             72
- Renovation        60

Data confidence: 91%
```

Recommended interactions:

- click score badge → detailed breakdown
- hover criterion → source and original value
- icon for LLM-derived fields
- icon for unknown fields
- indicator for hard-filter failures

Do not obscure or replace Idealista information.

---

# 18. Sorting

Allow users to sort the currently visible Idealista cards by:

```text
Idealista order
Personal score
Price
Price / m²
Area
Metro distance
```

Do this only in the currently loaded DOM.

Do not implement a crawler.

Use a `MutationObserver` to process dynamically loaded results.

Pseudo-flow:

```ts
observeListingContainer();

for (const newlyAddedCard of detectedCards) {
  if (!alreadyProcessed(newlyAddedCard)) {
    processListing(newlyAddedCard);
  }
}
```

---

# 19. Cache

Cache by listing ID.

Suggested key:

```text
idealista:<listing-id>
```

Structure:

```ts
export interface CachedListing {
  listingId: string;
  url: string;

  sourceHash: string;

  raw: IdealistaListingRaw;
  normalized: PropertyFeatures;

  llm?: PropertyLLMExtraction;
  geo?: GeoEnrichment;

  cachedAt: string;
  schemaVersion: number;
}
```

Calculate a hash from relevant source data:

```text
title
description
feature strings
price
area
location
```

If:

```text
same listingId
AND
same sourceHash
```

reuse:

- LLM extraction
- geocoding
- routing
- derived features

If description or property data changes, invalidate the relevant cache.

Use:

- `chrome.storage.local` for initial implementation
- IndexedDB if cache size becomes substantial

Add cache TTL for geospatial/LLM data if desired, but source hash should be the primary invalidation mechanism.

---

# 20. Security

Important architectural constraints:

- Never expose provider credentials to page JavaScript.
- LLM/network requests should originate from the extension background/service worker where feasible.
- Do not inject secrets into DOM attributes.
- Do not log API keys.
- Do not include API keys in exception messages.
- Local environment files, if used for unrelated development scripts, must be ignored by Git.

The repository's `.gitignore` includes:

```gitignore
.env
.env.local
.env.*.local
dist/
node_modules/
```

Be aware that browser extensions are client-side software.

A secret embedded during a production extension build cannot be considered cryptographically protected from the end user.

For a personal/self-hosted development tool this may be acceptable.

For a publicly distributed extension, do not ship a shared privileged provider key inside the bundle.

Prefer either:

- user-specific configuration, or
- a backend proxy with proper authentication.

---

# 21. Messaging Boundary

Content scripts should not directly own enrichment logic.

Example messages:

```ts
export type ExtensionMessage =
  | {
      type: "ENRICH_PROPERTY";
      payload: IdealistaListingRaw;
    }
  | {
      type: "GET_PREFERENCES";
    }
  | {
      type: "SAVE_PREFERENCES";
      payload: UserPreferences;
    };
```

Response:

```ts
export interface EnrichedPropertyResponse {
  property: PropertyFeatures;
  score: PropertyScore;
}
```

Keep schemas serializable.

---

# 22. Preferences UI

Create an extension options page.

Recommended sections:

```text
General
Price
Space
Location
Building
Comfort
Condition
Energy
Advanced rules
```

Each criterion should expose:

```text
Enabled
Weight 0–10
Utility configuration
```

For numerical criteria, provide a visual editor for piecewise curves.

Initial MVP may use editable points instead of a graphical chart:

```text
Distance    Score
0 m         100
200 m       100
400 m        90
600 m        70
800 m        40
1200 m        0
```

Later enhance with drag handles.

Categorical fields should expose explicit scores.

Example:

```text
Orientation

South       100
East         90
West         60
North        20
```

---

# 23. Default Preference Presets

Provide presets:

```text
Balanced
Location
Value
Space
Custom
```

Presets should only initialize configuration.

After editing a preset:

```text
Custom
```

must become active.

Keep default profiles in:

```text
src/scoring/defaults.ts
```

---

# 24. Suggested MVP

Implement the MVP incrementally.

## Phase 1 — DOM + Local Score

Support:

- price
- area
- €/m²
- floor
- elevator
- exterior if directly exposed
- personalized weights
- piecewise utility functions
- hard filters
- score badge
- score breakdown
- sorting
- local cache

No LLM and no Maps required yet.

Acceptance criterion:

> On an Idealista results page, every parsable card receives a deterministic personalized score and can be reordered by score.

---

## Phase 2 — LLM Structured Extraction

Add:

- description extraction
- OpenAI-compatible endpoint
- structured output
- orientation
- cross ventilation
- renovation state
- confidence/evidence
- source hash cache

Acceptance criterion:

> Ambiguous textual features are extracted only when supported by evidence, otherwise remain unknown.

---

## Phase 3 — Metro Distance

Add:

- local Madrid Metro station dataset
- property geocoding
- Haversine candidate selection
- walking routing
- nearest metro
- distance/time scoring

Acceptance criterion:

> A property receives a nearest-metro distance and the result is cached.

---

## Phase 4 — Advanced UX

Add:

- utility curve editor
- interaction rules
- confidence UI
- comparison mode
- preset profiles
- bulk visible-page ranking

---

# 25. Testing

Use unit tests extensively.

Recommended stack:

```text
Vitest
jsdom
```

Test separately:

## Idealista parser

Fixtures:

```text
test/fixtures/idealista/
```

Cases:

- normal listing
- ground floor
- penthouse
- no elevator
- price missing
- area missing
- malformed text
- dynamically inserted card

## Utility curves

Test:

- exact points
- interpolation
- below minimum
- above maximum
- malformed curve
- zero-weight criterion

## Scoring

Test:

- weighted mean
- unknown criterion exclusion
- hard filter rejection
- conditional rules
- score clamping

## LLM validator

Test:

- valid JSON
- missing properties
- unsupported enum
- invalid confidence
- prose instead of JSON
- hallucinated extra fields

## Cache

Test:

- same hash → cache hit
- changed description → invalidation
- changed price → invalidation
- schema migration

---

# 26. Error Handling

The extension must degrade gracefully.

If LLM fails:

```text
Property still receives deterministic score.
AI-derived fields remain unknown.
```

If geocoding fails:

```text
Metro score is omitted.
```

If Maps/routing fails:

```text
Use straight-line distance where available.
Mark source appropriately.
```

If parsing fails:

```text
Do not break the Idealista page.
Log a sanitized diagnostic message.
```

Never make one failed listing prevent processing the rest.

Use concurrency limits for enrichment requests.

Example:

```text
maximum simultaneous LLM enrichments: 2–4
```

Make this configurable internally.

---

# 27. Observability / Debugging

Provide debug mode.

Useful structured logging fields:

```ts
{
  listingId,
  phase,
  cacheHit,
  llmCalled,
  geoCalled,
  durationMs,
  errorCode
}
```

Never log:

```text
OPENAI_API_KEY
Authorization headers
full secrets
```

Optional development panel:

```text
Listing ID
Source hash
Parsed fields
LLM fields
Geo fields
Score contributions
Cache state
```

---

# 28. Ethical / Product Boundaries

The extension should act as a browsing assistant.

Design it around:

```text
user opens Idealista page
        ↓
extension analyzes visible listings
```

Do not design the MVP as:

```text
crawler
bulk scraper
background harvesting system
```

Do not automatically crawl pagination or enumerate properties without direct user navigation.

Keep scraping/extraction limited to information presented to the user in the browser.

---

# 29. Future Features

Potential future extensions:

## Transit

- Cercanías
- bus
- multiple station weighting
- travel time to user-defined destinations

Example:

```text
Office: ≤ 35 min
Parents: ≤ 30 min
Atocha: ≤ 20 min
```

This could become a separate location score.

## Neighborhood

- noise
- parks
- supermarkets
- healthcare
- schools
- nightlife
- pedestrianization

## Financial

- estimated mortgage payment
- transfer tax / purchase expenses
- renovation estimate
- total acquisition cost
- €/usable m²

## Property intelligence

- detect suspiciously low €/m²
- duplicate listings
- listing age
- price reductions
- historical observations

## Comparison

Select several listings and display:

```text
Property A vs Property B vs Property C
```

with radar/table comparison.

Do not implement these before the MVP is stable.

---

# 30. Example Scoring Result

```json
{
  "listingId": "108734567",
  "score": 87.3,
  "dataConfidence": 0.91,
  "passedHardFilters": true,
  "contributions": [
    {
      "criterion": "metroDistance",
      "rawValue": 374,
      "utility": 94,
      "weight": 10,
      "weightedContribution": 940,
      "source": "geospatial",
      "confidence": 1
    },
    {
      "criterion": "areaM2",
      "rawValue": 61,
      "utility": 92,
      "weight": 8,
      "weightedContribution": 736,
      "source": "idealista_dom",
      "confidence": 1
    },
    {
      "criterion": "orientation",
      "rawValue": ["south", "east"],
      "utility": 100,
      "weight": 8,
      "weightedContribution": 800,
      "source": "llm",
      "confidence": 0.96
    }
  ]
}
```

---

# 31. Implementation Priorities

Prioritize in this order:

1. reliable property data model
2. robust DOM parser
3. deterministic scoring engine
4. preference persistence
5. Idealista UI injection
6. visible-page sorting
7. caching
8. LLM structured extraction
9. metro enrichment
10. advanced UX

Do not begin with the LLM.

The core product must remain useful even when the LLM endpoint is offline.

---

# 32. Definition of Done for Initial Release

The initial usable release is complete when:

- The extension installs successfully in Chromium as an unpacked MV3 extension.
- Idealista search cards are detected dynamically.
- Price, area, €/m², floor and elevator are extracted where available.
- Preferences can be edited.
- Numeric criteria support non-linear utility curves.
- Hard filters work.
- Every parsable visible listing receives a 0–100 score.
- Score breakdown is available.
- Listings can be reordered by score.
- LLM enrichment uses the provider settings saved from the extension Options page.
- LLM responses use validated structured output.
- Unknown values remain unknown.
- LLM failures do not break scoring.
- Cached listings do not repeatedly invoke the LLM.
- Metro enrichment can be added without modifying the scoring engine.
- Unit tests cover parser, utility functions and scoring logic.
- No API secrets are logged or committed.

---

# 33. First Codex Task

Start by scaffolding the repository and implementing Phase 1 only.

Deliver:

```text
manifest.json
package.json
tsconfig.json
vite.config.ts

src/
  background/
  content/
  scoring/
  schemas/
  storage/
  options/
  shared/

test/
  fixtures/
```

Implement first:

1. MV3 manifest
2. Idealista listing detection
3. DOM parser abstraction
4. property schema
5. preference schema
6. piecewise utility functions
7. hard-filter engine
8. weighted scoring engine
9. badge injection
10. score breakdown
11. sort-current-page-by-score
12. tests

Do not add LLM code until Phase 1 tests pass.

Then implement the LLM integration behind:

```ts
export interface PropertyTextExtractor {
  extract(raw: IdealistaListingRaw): Promise<PropertyLLMExtraction>;
}
```

so that the rest of the application remains provider-independent.
