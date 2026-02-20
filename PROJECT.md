# Solar PV Feasibility Web App — Full Project Context (PVGIS PVcalc)

This document is written to give an AI coding assistant (Cursor/Codex) **maximum context** about the project: what the app does, the full user flow, the exact PVGIS endpoint to call, which parameters to send, what the response looks like, and what business logic you should implement on top (KPIs + economics).

The goal is that a junior developer can build the project efficiently, step-by-step, with minimal ambiguity.

---

## 0) One-sentence idea

A user picks a point on a map (lat/lon), enters a few PV system + economic inputs, and the app uses **PVGIS PVcalc** to estimate PV energy yield (monthly + yearly), then turns that into **clear KPIs, charts, and a “worth it” decision** (payback, savings, ROI/NPV optional).

---

## 1) Scope, assumptions, and non-goals

### 1.1 MVP scope (keep it simple)
**MVP uses PVGIS `PVcalc` only**, and shows:
- yearly energy (kWh/year)
- monthly energy (kWh/month)
- a few derived KPIs (specific yield, capacity factor, best/worst month, uncertainty)
- a simple economic model (savings, payback, cashflow chart)

### 1.2 Nice-to-have scope (optional)
- advanced PV settings (tilt/azimuth manual, PV tech choice, mounting type)
- scenario comparison (e.g., self-consumption 30/50/70%)
- PVGIS `pvprice=1` to get PVGIS-calculated LCOE (optional KPI)
- PVGIS `seriescalc` (hourly) later to improve self-consumption realism (advanced)

### 1.3 Non-goals (to avoid overengineering)
- Not a professional engineering tool or a legally binding financial report
- Not a full utility tariff optimizer
- Not a battery sizing optimizer (unless you later add PVGIS off-grid endpoints)

---

## 2) Why a backend is required (important!)

PVGIS non-interactive APIs:
- accept **GET only**
- have rate limits and can return overload codes
- explicitly **do not allow browser AJAX calls (CORS)**

**So: the frontend must call your backend, and your backend calls PVGIS**.

---

## 3) User experience (UX) — full flow (wizard)

Recommended: a 4-step wizard. Each step should have:
- clean defaults
- a minimal mode + an “Advanced” accordion
- tooltips for PV jargon

### Step 1 — Location
**User does**
- selects a pin on the map
- (optional) searches an address

**You implement**
- map UI + pin
- store `lat`, `lon`
- show a small summary card: “Selected location: [lat, lon]”

**Output**
- `lat`, `lon` (+ optional human-readable address label)

### Step 2 — PV system
**User does (MVP)**
- chooses system size: **kWp**
- chooses total losses: **loss %**
- leaves “optimize angles” ON (default)

**You implement**
- input validation + defaults
- toggle: “Optimize tilt & azimuth automatically” → `optimalangles=1`

**Output**
- PV config: `peakpower`, `loss`, `optimalangles` (or manual `angle` + `aspect`)

### Step 3 — Economics
**User does (MVP)**
- energy price (buy): `price_buy`
- PV system cost (CAPEX): `capex`
- self-consumption slider: `self_consumption` (default 50%)
- export price `price_sell` optional (default 0)

**You implement**
- simple form with defaults
- optional “Advanced economics” section (OPEX, degradation, discount rate)

**Output**
- economic config for backend calculations

### Step 4 — Results dashboard
**User sees**
- headline: “Worth it?” + payback
- KPI cards (yearly kWh, specific yield, etc.)
- charts (monthly production, cashflow)
- insights + warnings

**You implement**
- backend simulation endpoint (calls PVGIS + derives KPIs + economics)
- frontend dashboard components

---

## 4) Inputs: mandatory vs optional (what you must collect)

### 4.1 PVGIS PVcalc — mandatory inputs
These are required for PVGIS PVcalc to run:
- `lat` (float) — latitude in decimal degrees (south negative)
- `lon` (float) — longitude in decimal degrees (west negative)
- `peakpower` (float) — PV nominal power in **kW** (kWp)
- `loss` (float) — total system losses in **%**

### 4.2 PVGIS PVcalc — recommended defaults (MVP)
Send these defaults unless the user changes them:
- `usehorizon=1` (include terrain horizon shading)
- `optimalangles=1` (let PVGIS find best tilt + azimuth)
- `pvtechchoice=crystSi` (PV tech)
- `mountingplace=free` (free-standing)
- `outputformat=json`

### 4.3 Optional PVGIS PVcalc inputs (Advanced)
- `angle` (float, degrees) — fixed tilt (ignored if `optimalangles=1`)
- `aspect` (float, degrees) — fixed azimuth (ignored if `optimalangles=1`)
  - PVGIS convention: `0 = South`, `90 = West`, `-90 = East`
- `raddatabase` (text) — radiation database (advanced users only)
- `userhorizon` (list of numbers) — manual horizon profile (rare)
- tracking options:
  - `inclined_axis=1`, plus `inclinedaxisangle` or `inclined_optimum=1`
  - `vertical_axis=1`, plus `verticalaxisangle` or `vertical_optimum=1`
  - `twoaxis=1`
- PVGIS LCOE calculation (optional KPI):
  - `pvprice=1`
  - `systemcost` (float) — total system cost (currency units)
  - `interest` (float) — annual interest rate in %/year
  - `lifetime` (int) — default 25

### 4.4 Your app (business) inputs (not from PVGIS)
These drive **economics**:
- `price_buy` (currency/kWh) — mandatory for savings
- `capex` (currency) — mandatory for payback
- `self_consumption` (0..1) — recommended
- optional:
  - `price_sell` (currency/kWh)
  - `opex_yearly` (currency/year) or % of capex
  - `degradation` (%/year)
  - `analysis_years` (years)
  - `discount_rate` (%/year)
  - `price_escalation` (%/year) optional

---

## 5) PVGIS API usage — endpoint, constraints, and best practices

### 5.1 Entry points (versioning)
PVGIS has explicit API versions:
- PVGIS 5.3: `/api/v5_3/<tool_name>?...`
- PVGIS 5.2: `/api/v5_2/<tool_name>?...`

**Recommendation:** use **v5_3** explicitly for stable behavior.

Tool names include: `PVcalc`, `seriescalc`, `tmy`, `printhorizon`, `MRcalc`, `DRcalc`, etc.

### 5.2 PVGIS service constraints (you must handle)
- **GET only** (POST returns 405)
- rate limit: **~30 calls/second per IP**
- overload code possible: **529 Site is overloaded**
- too many requests: **429**
- if inputs out of range: PVGIS returns **JSON error** with expected range

### 5.3 CORS restriction
PVGIS does **not** allow browser AJAX calls. Always call PVGIS server-side.

### 5.4 Caching recommendation (MVP-friendly)
PVGIS results are multi-year averages; they do not change every day.
You can safely cache by a key like:

```
cache_key = f"{lat:.4f}:{lon:.4f}:{peakpower}:{loss}:{usehorizon}:{optimalangles}:{angle}:{aspect}:{pvtechchoice}:{mountingplace}:{raddatabase}"
```

TTL can be long (days/weeks) for MVP.

---

## 6) PVGIS PVcalc — request parameters (exact names)

### 6.1 Minimal PVcalc request (MVP)
Example:

```http
GET https://re.jrc.ec.europa.eu/api/v5_3/PVcalc
  ?lat=44.43
  &lon=26.10
  &peakpower=3
  &loss=14
  &outputformat=json
```

### 6.2 Recommended PVcalc request (still MVP)
```http
GET https://re.jrc.ec.europa.eu/api/v5_3/PVcalc
  ?lat=44.43
  &lon=26.10
  &peakpower=3
  &loss=14
  &usehorizon=1
  &optimalangles=1
  &pvtechchoice=crystSi
  &mountingplace=free
  &outputformat=json
```

### 6.3 Parameter table (grid-connected & tracking PV systems)

Below are the **important PVcalc parameters** you may support.

| Parameter | Type | Required | Default | Meaning / notes |
|---|---:|---:|---:|---|
| `lat` | float | ✅ | — | latitude (decimal degrees), south negative |
| `lon` | float | ✅ | — | longitude (decimal degrees), west negative |
| `peakpower` | float | ✅ | — | nominal PV system power in kW |
| `loss` | float | ✅ | — | total system loss in % |
| `usehorizon` | int | ⛔ | 1 | include horizon shading |
| `userhorizon` | list | ⛔ | — | custom horizon heights (degrees), starting north clockwise |
| `raddatabase` | text | ⛔ | (auto) | radiation DB (advanced) |
| `pvtechchoice` | text | ⛔ | `crystSi` | `crystSi`, `crystSi2025`, `CIS`, `CdTe`, `Unknown` |
| `mountingplace` | text | ⛔ | `free` | `free` (free-standing) or `building` |
| `fixed` | int | ⛔ | 1 | compute fixed system output |
| `angle` | float | ⛔ | 0 | fixed tilt (degrees). Ignored if `optimalangles=1` |
| `aspect` | float | ⛔ | 0 | fixed azimuth (0=S, 90=W, -90=E). Ignored if `optimalangles=1` |
| `optimalinclination` | int | ⛔ | 0 | compute optimum tilt only (fixed) |
| `optimalangles` | int | ⛔ | 0 | compute optimum tilt + azimuth (fixed) |
| `inclined_axis` | int | ⛔ | 0 | compute single inclined-axis tracking |
| `inclined_optimum` | int | ⛔ | 0 | compute optimum tracking angle for inclined-axis |
| `inclinedaxisangle` | float | ⛔ | 0 | tracking inclination (ignored if `inclined_optimum=1`) |
| `vertical_axis` | int | ⛔ | 0 | compute vertical-axis tracking |
| `vertical_optimum` | int | ⛔ | 0 | optimum tracking angle for vertical-axis |
| `verticalaxisangle` | float | ⛔ | 0 | tracking inclination (ignored if `vertical_optimum=1`) |
| `twoaxis` | int | ⛔ | 0 | compute two-axis tracking |
| `pvprice` | int | ⛔ | 0 | if 1, PVGIS will calculate PV electricity LCOE |
| `systemcost` | float | ⚠️ | — | required if `pvprice=1` |
| `interest` | float | ⚠️ | — | required if `pvprice=1` |
| `lifetime` | int | ⛔ | 25 | PV system lifetime (years) |
| `outputformat` | text | ⛔ | csv | use `json` for integration |
| `browser` | int | ⛔ | 0 | use 1 if downloading as file in a browser |

**Rules to remember**
- If `optimalangles=1`, PVGIS ignores `angle` and `aspect`.
- If tracking is enabled, PVGIS can return extra outputs for each tracking type.

---

## 7) PVGIS PVcalc — JSON response structure (what you parse)

A typical PVcalc JSON response is:

```json
{
  "inputs": { ... },
  "outputs": {
    "monthly": { "fixed": [ ... 12 items ... ] },
    "totals": { "fixed": { ... } }
  },
  "meta": { ... descriptions + units ... }
}
```

### 7.1 `inputs` section (useful for display + debugging)
Common fields:
- `inputs.location.latitude`, `inputs.location.longitude`, `inputs.location.elevation`
- `inputs.meteo_data.radiation_db`, `year_min`, `year_max`, `use_horizon`
- `inputs.mounting_system.fixed.slope.value` and `.optimal`
- `inputs.mounting_system.fixed.azimuth.value` and `.optimal`
- `inputs.pv_module.technology`, `peak_power`, `system_loss`

Use this to:
- show “data coverage years” to the user
- confirm PVGIS applied optimal angles or not
- show which radiation DB was used

### 7.2 `outputs.monthly.fixed[]` (your monthly chart data)
Array length is usually 12 items with keys:

| Field | Units | Meaning | Typical UI usage |
|---|---|---|---|
| `month` | — | month index (1..12) | x-axis label |
| `E_d` | kWh/d | avg daily PV energy that month | optional tooltip |
| `E_m` | kWh/mo | avg monthly PV energy | **main bar chart** |
| `H(i)_d` | kWh/m²/d | plane-of-array irradiation daily | educational chart/tooltip |
| `H(i)_m` | kWh/m²/mo | plane-of-array irradiation monthly | optional line chart |
| `SD_m` | kWh | std deviation of monthly PV output (year-to-year) | uncertainty band / ± text |

### 7.3 `outputs.totals.fixed` (your main KPI source)
Common fields:

| Field | Units | Meaning | Use |
|---|---|---|---|
| `E_y` | kWh/y | avg annual PV energy | **KPI #1**, economics |
| `E_m` | kWh/mo | avg monthly PV energy | sanity check |
| `H(i)_y` | kWh/m²/y | annual plane-of-array irradiation | “solar resource” KPI |
| `SD_y` | kWh | std deviation annual output | uncertainty KPI |
| `l_aoi` | % | angle-of-incidence loss | optional loss breakdown |
| `l_spec` | % | spectral “loss” (can be gain) | optional |
| `l_tg` | % | temperature + low irradiance loss | optional |
| `l_total` | % | total combined loss incl. system loss | optional validation |
| `LCOE_pv` | currency/kWh | (only if pvprice=1) levelized cost | optional KPI |

**Important parsing note:** in some responses, `l_spec` may come as a string (e.g., `"0.93"`). Parse defensively.

### 7.4 `meta` section (super useful!)
`meta` contains descriptions and units for variables. You can:
- use it for tooltips automatically
- ignore it for MVP, but it’s nice because it is self-documenting

---

## 8) Derived technical KPIs (what you compute on top of PVGIS)

Let:
- `E_y = outputs.totals.fixed.E_y` (kWh/year)
- `P = peakpower` (kW)

### 8.1 Core KPIs (MVP)
- **Annual production:** `E_y` (kWh/year)
- **Monthly production:** `E_m[1..12]` (kWh/month)
- **Specific yield:** `specific_yield = E_y / P` (kWh/kWp/year)
- **Capacity factor (approx):**
  - `CF = E_y / (P * 8760)` (unitless)
  - `%CF = CF * 100`
- **Best month / worst month:** max/min of monthly `E_m`
- **Seasonality ratio:** `max(E_m) / min(E_m)`
- **Uncertainty (simple):**
  - annual: `± SD_y`
  - monthly: `± SD_m`

### 8.2 Simple “Worth it score” (optional, explain it!)
A simple score 0–100 can combine:
- payback (best driver)
- specific yield (solar resource)
- uncertainty penalty (high SD)

Example concept (not strict):
- 50% payback component
- 30% yield component
- 20% stability component

Always show the breakdown so it is transparent.

---

## 9) Economics model (MVP-friendly, explainable in a thesis)

PVGIS gives energy. You convert energy → money.

### 9.1 Inputs
- `capex` (currency)
- `price_buy` (currency/kWh)
- `self_consumption = s` (0..1)
- `price_sell` (currency/kWh, optional, default 0)
- optional:
  - `opex_yearly` (currency/year)
  - `degradation = d` (%/year) default 0.5% → 0.005
  - `analysis_years = N` default 25
  - `discount_rate = r` (%/year) default 6% → 0.06
  - `price_escalation = g` (%/year) optional

### 9.2 Yearly savings formula
Let:
- `E1 = E_y` = PV energy in year 1 (kWh)
- PV degradation `d`
- electricity price escalation `g` (optional)

For year `t` (1..N):
- `E(t) = E1 * (1 - d)^(t-1)`
- `price_buy(t) = price_buy * (1 + g)^(t-1)` (if you model escalation)
- `E_self(t) = E(t) * s`
- `E_export(t) = E(t) - E_self(t)`

Savings:
- `Savings(t) = E_self(t)*price_buy(t) + E_export(t)*price_sell - opex_yearly`

### 9.3 Payback
Compute cumulative savings:
- `cum += Savings(t)`
Payback year is the first `t` where `cum >= capex`.

### 9.4 ROI (simple)
- `ROI = (sum_{t=1..N} Savings(t) - capex) / capex`

### 9.5 NPV (optional but great for a thesis)
- `NPV = sum_{t=1..N} Savings(t) / (1 + r)^t - capex`

### 9.6 What you show in UI (financial)
- savings year 1
- payback (years)
- cumulative cashflow chart
- optionally NPV and ROI

### 9.7 Scenario comparison (recommended)
For MVP:
- compare **self-consumption** scenarios 30%, 50%, 70%
- keep `price_sell=0` initially
- show payback and NPV per scenario

---

## 10) Business logic insights (simple rules that feel “smart”)

Generate short insights based on rules:
- If `loss > 20%` → “High system losses; check inverter/cables/shading.”
- If manual `aspect` far from south (e.g., `abs(aspect) > 90`) → warn about orientation impact.
- If `SD_y / E_y > 0.05` → “Higher year-to-year variability.”
- If `specific_yield` above a threshold → “Great solar resource for PV.”

Keep insights deterministic and explainable.

---

## 11) API contract for your own backend (stack-agnostic)

### 11.1 Suggested endpoint
`POST /api/simulate`

Request JSON:

```json
{
  "location": { "lat": 44.43, "lon": 26.10 },
  "pv": {
    "peakpower_kw": 3.0,
    "loss_percent": 14.0,
    "usehorizon": true,
    "optimalangles": true,
    "angle_deg": null,
    "aspect_deg": null,
    "pvtechchoice": "crystSi",
    "mountingplace": "free",
    "raddatabase": null
  },
  "economics": {
    "capex": 15000,
    "price_buy": 1.0,
    "self_consumption": 0.5,
    "price_sell": 0.0,
    "opex_yearly": 150,
    "degradation": 0.005,
    "analysis_years": 25,
    "discount_rate": 0.06,
    "price_escalation": 0.0
  }
}
```

Response JSON (recommended shape):

```json
{
  "pvgis": {
    "inputs": { "...": "..." },
    "monthly": [ { "month": 1, "E_m": 123.4, "SD_m": 5.0, "H(i)_m": 50.0 }, "... 12 ..." ],
    "totals": { "E_y": 3456.7, "SD_y": 123.4, "H(i)_y": 1500.0, "l_total": -23.7 }
  },
  "kpis": {
    "annual_kwh": 3456.7,
    "specific_yield_kwh_per_kwp": 1152.2,
    "capacity_factor_pct": 13.1,
    "best_month": { "month": 7, "kwh": 420.0 },
    "worst_month": { "month": 12, "kwh": 120.0 },
    "uncertainty_annual_kwh": 123.4
  },
  "finance": {
    "savings_year1": 1800.0,
    "payback_years": 8,
    "roi": 1.2,
    "npv": 5200.0,
    "cashflow_yearly": [ 1800.0, 1780.0, "..."],
    "cashflow_cumulative": [ -13200.0, -11420.0, "..."]
  },
  "charts": {
    "monthly_energy_kwh": [ { "month": 1, "kwh": 120.0 }, "... 12 ..." ],
    "cashflow_cumulative": [ { "year": 0, "value": -15000 }, { "year": 1, "value": -13200 } ]
  },
  "insights": [
    { "type": "warning", "text": "High system losses..." },
    { "type": "info", "text": "Great solar resource..." }
  ]
}
```

---

## 12) Implementation checklist (junior-friendly)

1. **Map selection** (lat/lon) + validation
2. **PV form** (kWp, losses, optimize angles)
3. **Economics form** (price_buy, capex, self-consumption)
4. Backend `/simulate`:
   - build PVGIS PVcalc URL
   - call PVGIS server-side
   - parse JSON (monthly + totals)
5. Compute derived KPIs
6. Compute finance (savings/payback/cashflow)
7. Build dashboard UI:
   - KPI cards
   - monthly bar chart
   - cashflow chart
   - insights list
8. Add caching + error handling (nice-to-have)
9. Add “Advanced” settings (optional)

---

## 13) Error handling + edge cases (don’t skip)

### 13.1 Input validation
- lat range: -90..90
- lon range: -180..180
- peakpower > 0
- loss between 0..100 (practically 5..25 typical)

### 13.2 PVGIS errors to handle
- 405 → wrong HTTP method (you used POST to PVGIS)
- 429 → too many requests (rate limit)
- 529 → overloaded (retry with backoff)
- JSON error message (inputs out of range)

### 13.3 Defensive parsing
- missing keys (e.g., no `fixed` output if user disabled it)
- numeric fields sometimes strings (e.g., `l_spec`)
- months array may not be exactly 12 if PVGIS changes (rare) → handle by sorting by `month`

---

## 14) Physics mini-glossary (very short)

- **kW / kWp**: system power rating (capacity)
- **kWh**: energy produced/consumed
- **Irradiation (kWh/m²)**: energy from sun received on a surface area
- **Tilt (angle)**: panel inclination from horizontal
- **Azimuth (aspect)**: panel direction; PVGIS uses 0=south, 90=west, -90=east
- **Loss (%)**: combined system losses (inverter, temperature, wiring, etc.)
- **Specific yield**: kWh produced per kWp per year
- **Capacity factor**: how much of the theoretical max energy the system produces

---

## 15) Reference links (for the developer / thesis)

(Paste these into a browser; they are included here as plain references.)

```text
PVGIS API non-interactive service (GET only, rate limits, CORS restriction, inputs list):
https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/getting-started-pvgis/api-non-interactive-service_en

PVGIS tool description: Grid-connected PV (explains E_m, H(i)_m, SD_m, losses, LCOE):
https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/pvgis-tools/grid-connected-pv_en

PVGIS 5.3 release notes (datasets updated to 2005–2023, SARAH-3, ERA5+Land):
https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/pvgis-releases/pvgis-53_en
```

---

## 16) Quick MVP decision logic (what “worth it” means)

For MVP, “worth it” can be:

- **YES** if `payback_years <= user_threshold` (e.g., <= 10–12 years)
- **MAYBE** if payback is moderate (12–16) but yield is high
- **NO** if payback is too long or savings are tiny

Always show:
- the assumptions (prices, self-consumption, capex)
- a scenario comparison (30/50/70%) to be transparent

---

## 17) Optional next step after MVP

If you want more realistic self-consumption:
- Add PVGIS `seriescalc` (hourly PV output), then combine with a user load profile.
- This allows “how much of your PV do you use vs export” from real hourly overlap.
- This is a Phase 2 feature; don’t block MVP on it.

---

**End of context.**
