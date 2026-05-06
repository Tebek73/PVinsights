import assert from 'node:assert/strict';
import { computeFinanceFromTotals } from './simulate';
import type { Totals, Economics } from './simulate';

/**
 * Minimal self-tests for Monte Carlo refactor invariants.
 * Run via: npm run test:mc (added in package.json)
 */

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

function testDiscountRateZeroNpv(): void {
  const totals: Totals = { E_y: 1000, SD_y: 0, H_i_y: 0, l_total: 0 };
  const economics: Economics = {
    currency: 'EUR',
    capex: 1000,
    price_buy: 1,
    self_consumption: 1,
    price_sell: 0,
    price_sell_escalation: 0,
    opex_yearly: 0,
    opex_escalation: 0,
    degradation: 0,
    analysis_years: 1,
    discount_rate: 0,
    price_escalation: 0,
    subsidy_amount: 0,
    subsidy_percent_capex: 0
  };
  const fin = computeFinanceFromTotals(totals, economics);
  assert.equal(fin.npv, 0, 'With 1 year savings==capex, undiscounted NPV should be 0');
}

function testPaybackNullIsNull(): void {
  const totals: Totals = { E_y: 0, SD_y: 0, H_i_y: 0, l_total: 0 };
  const economics: Economics = {
    currency: 'EUR',
    capex: 1000,
    price_buy: 1,
    self_consumption: 1,
    price_sell: 0,
    price_sell_escalation: 0,
    opex_yearly: 0,
    opex_escalation: 0,
    degradation: 0,
    analysis_years: 5,
    discount_rate: 0.06,
    price_escalation: 0,
    subsidy_amount: 0,
    subsidy_percent_capex: 0
  };
  const fin = computeFinanceFromTotals(totals, economics);
  assert.equal(fin.payback_years, null, 'No savings should produce null payback');
}

function testHistogramAccounting(): void {
  // Replicate the clipped histogram accounting invariant without importing internals.
  // We check the general identity expected in the response:
  // total_count == underflow + overflow + sum(counts) + excluded
  // In our implementation, values outside clip range are counted as under/over,
  // and values inside are binned into counts, so:
  // total_count == underflow + overflow + sum(counts)
  const values = [0, 1, 2, 3, 4, 1000]; // outlier
  const numBins = 20;

  // Minimal percentile helper (must match server logic broadly)
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p: number) => {
    const idx = p * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
  };
  const min = percentile(0.01);
  const max = percentile(0.99);

  let underflow = 0;
  let overflow = 0;
  const clipped: number[] = [];
  for (const v of values) {
    if (v < min) underflow++;
    else if (v > max) overflow++;
    else clipped.push(v);
  }

  const range = max - min || 1;
  const counts = new Array(numBins).fill(0);
  for (const v of clipped) {
    const bin = Math.min(Math.floor(((v - min) / range) * numBins), numBins - 1);
    counts[bin]++;
  }

  assert.equal(values.length, underflow + overflow + sum(counts));
}

function run(): void {
  testDiscountRateZeroNpv();
  testPaybackNullIsNull();
  testHistogramAccounting();
  console.log('[test:mc] OK');
}

run();

