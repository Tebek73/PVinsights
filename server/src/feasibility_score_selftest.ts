import assert from 'node:assert/strict';
import { buildFeasibilityScore } from './feasibility_score';

function testClampedScore(): void {
  const s = buildFeasibilityScore(
    { specific_yield_kwh_per_kwp: 500, annual_kwh: 1000, uncertainty_annual_kwh: 50 },
    {
      npv: -1e9,
      effective_capex: 10000,
      simple_payback_years: null,
      payback_years: null,
      irr: null
    },
    { analysis_years: 25, discount_rate: 0.06 },
    undefined,
    false
  );
  assert.ok(s.score >= 0 && s.score <= 100);
  assert.equal(s.band, 'poor');
}

function testStrongScenarioHighBand(): void {
  const s = buildFeasibilityScore(
    { specific_yield_kwh_per_kwp: 1400, annual_kwh: 5000, uncertainty_annual_kwh: 100 },
    {
      npv: 25000,
      effective_capex: 10000,
      simple_payback_years: 4,
      payback_years: 4,
      irr: 0.14
    },
    { analysis_years: 25, discount_rate: 0.06 },
    undefined,
    false
  );
  assert.ok(s.score >= 70, `expected high score, got ${s.score}`);
  assert.ok(['good', 'excellent'].includes(s.band));
}

function testMonteCarloAddsRiskWeight(): void {
  const withoutMc = buildFeasibilityScore(
    { specific_yield_kwh_per_kwp: 1000, annual_kwh: 3000, uncertainty_annual_kwh: 80 },
    {
      npv: 1000,
      effective_capex: 10000,
      simple_payback_years: 12,
      payback_years: 12,
      irr: 0.08
    },
    { analysis_years: 25, discount_rate: 0.06 },
    undefined,
    false
  );
  const withMc = buildFeasibilityScore(
    { specific_yield_kwh_per_kwp: 1000, annual_kwh: 3000, uncertainty_annual_kwh: 80 },
    {
      npv: 1000,
      effective_capex: 10000,
      simple_payback_years: 12,
      payback_years: 12,
      irr: 0.08
    },
    { analysis_years: 25, discount_rate: 0.06 },
    { prob_npv_positive: 1, prob_payback_within_analysis: 1 },
    true
  );
  assert.ok(withMc.components.risk != null);
  assert.ok(Math.abs(withMc.components.economics.weight - 0.45) < 1e-9);
  assert.equal(withMc.components.risk!.score, 100);
}

function run(): void {
  testClampedScore();
  testStrongScenarioHighBand();
  testMonteCarloAddsRiskWeight();
  console.log('[test:feasibility_score] OK');
}

run();
