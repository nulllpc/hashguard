import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCohortMetrics,
  compareCohorts,
  dollarizeGain,
  DEFAULT_HASHPRICE_USD_PER_TH_DAY
} from '../abb/engine.mjs';

describe('ABB Math & Comparison Engine', () => {
  test('calculateCohortMetrics computes expected rates and efficiency', () => {
    const metrics = calculateCohortMetrics({
      label: 'Rack 1 (SV1)',
      protocol: 'sv1',
      minerCount: 15,
      powerW: 49500,
      physicalHashrateHps: 3.45e15,
      protocolHashrateHps: 3.40e15,
      sharesAccepted: 49250,
      sharesRejected: 50,
      sharesStale: 700,
    });

    assert.equal(metrics.minerCount, 15);
    assert.equal(metrics.physicalThs, 3450);
    assert.equal(metrics.sharesTotal, 50000);
    assert.equal(metrics.staleRate, 700 / 50000); // 1.4%
    assert.equal(metrics.rejectionRate, 50 / 50000); // 0.1%
    assert.equal(metrics.acceptanceRate, 49250 / 50000);
    assert.ok(Math.abs(metrics.efficiency - (3.40 / 3.45)) < 1e-4);
    assert.ok(metrics.powerEfficiencyWPerTh > 0);
  });

  test('calculateCohortMetrics safely handles empty / zero inputs without NaN', () => {
    const empty = calculateCohortMetrics({});

    assert.equal(empty.minerCount, 0);
    assert.equal(empty.powerW, 0);
    assert.equal(empty.physicalHashrateHps, 0);
    assert.equal(empty.protocolHashrateHps, 0);
    assert.equal(empty.sharesTotal, 0);
    assert.equal(empty.staleRate, 0);
    assert.equal(empty.rejectionRate, 0);
    assert.equal(empty.acceptanceRate, 0);
    assert.equal(empty.efficiency, 0);
    assert.equal(empty.powerEfficiencyWPerTh, 0);
    assert.ok(!Number.isNaN(empty.staleRate));
    assert.ok(!Number.isNaN(empty.efficiency));
  });

  test('compareCohorts calculates stale reduction and recovered hashrate', () => {
    const cohortA = calculateCohortMetrics({
      physicalHashrateHps: 3.45e15,
      sharesAccepted: 49250,
      sharesRejected: 50,
      sharesStale: 700,
    });

    const cohortB = calculateCohortMetrics({
      physicalHashrateHps: 3.45e15,
      sharesAccepted: 49880,
      sharesRejected: 20,
      sharesStale: 100,
    });

    const comp = compareCohorts(cohortA, cohortB);

    assert.ok(comp.staleRateDelta > 0); // B has lower stales
    assert.ok(comp.staleReductionPercentage > 80); // ~85.7% reduction
    assert.ok(comp.recoveredThs > 40); // > 40 TH/s recovered
    assert.equal(comp.recoveredHashrateHps, comp.recoveredThs * 1e12);
  });

  test('compareCohorts handles zero or negative delta without returning negative hashrate', () => {
    const cohortA = calculateCohortMetrics({
      physicalHashrateHps: 3.45e15,
      sharesAccepted: 50000,
      sharesStale: 50,
    });

    // Cohort B has higher stale rate (worse performance)
    const cohortB = calculateCohortMetrics({
      physicalHashrateHps: 3.45e15,
      sharesAccepted: 50000,
      sharesStale: 200,
    });

    const comp = compareCohorts(cohortA, cohortB);

    assert.ok(comp.staleRateDelta < 0);
    assert.equal(comp.recoveredHashrateHps, 0);
    assert.equal(comp.recoveredThs, 0);
  });

  test('dollarizeGain accurately computes financial projections', () => {
    const comparison = {
      recoveredThs: 40,
      cohortB: { minerCount: 10 },
    };

    const fin = dollarizeGain(comparison, {
      hashpriceUsdPerThDay: 0.050,
      btcPriceUsd: 50000,
    });

    assert.equal(fin.recoveredThs, 40);
    assert.equal(fin.dailyUsd, 2.0); // 40 * 0.05
    assert.equal(fin.annualUsd, 730.0); // 2.0 * 365
    assert.equal(fin.annualPerMinerUsd, 73.0); // 730 / 10
    assert.equal(fin.dailySats, 4000); // (2 / 50000) * 1e8
  });
});
