import assert from 'node:assert/strict';
import { SimulateSchema } from './schema';
import { preprocessSimulateBody } from './preprocess';

function testMinimalPayload(): void {
  const r = SimulateSchema.safeParse({
    location: { lat: 44.4, lon: 26.1 },
    pv: { peakpower_kw: 3 },
    economics: { capex: 15000, price_buy: 0.25 }
  });
  assert.equal(r.success, true, r.success ? '' : JSON.stringify(r.error));
}

function testPreprocessStripsAreaType(): void {
  const { payload, warnings } = preprocessSimulateBody({
    location: { lat: 1, lon: 2, area_type: 'urban' },
    pv: { peakpower_kw: 2 },
    economics: { capex: 1000, price_buy: 1 }
  });
  assert.ok(warnings.some((w) => w.code === 'deprecated.field_removed'));
  const loc = (payload as { location: Record<string, unknown> }).location;
  assert.ok(!('area_type' in loc));
  const parsed = SimulateSchema.safeParse(payload);
  assert.equal(parsed.success, true);
}

function run(): void {
  testMinimalPayload();
  testPreprocessStripsAreaType();
  console.log('[test:schema] OK');
}

run();
