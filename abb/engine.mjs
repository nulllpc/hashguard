export const DEFAULT_HASHPRICE_USD_PER_TH_DAY = 0.055;

export function calculateCohortMetrics(input = {}) {
  const minerCount = Number(input.minerCount) || 0;
  const powerW = Number(input.powerW) || 0;
  const physicalHashrateHps = Number(input.physicalHashrateHps) || 0;
  const protocolHashrateHps = Number(input.protocolHashrateHps) || 0;

  const sharesAccepted = Number(input.sharesAccepted) || 0;
  const sharesRejected = Number(input.sharesRejected) || 0;
  const sharesStale = Number(input.sharesStale) || 0;
  const sharesTotal = Number(input.sharesTotal) || (sharesAccepted + sharesRejected + sharesStale);

  const staleRate = sharesTotal > 0 ? sharesStale / sharesTotal : 0;
  const rejectionRate = sharesTotal > 0 ? sharesRejected / sharesTotal : 0;
  const acceptanceRate = sharesTotal > 0 ? sharesAccepted / sharesTotal : 0;

  const efficiency = physicalHashrateHps > 0 ? protocolHashrateHps / physicalHashrateHps : 0;
  const physicalThs = physicalHashrateHps / 1e12;
  const powerEfficiencyWPerTh = physicalThs > 0 ? powerW / physicalThs : 0;

  return {
    label: input.label || 'Cohort',
    protocol: input.protocol || 'unknown',
    minerCount,
    powerW,
    physicalHashrateHps,
    physicalThs,
    protocolHashrateHps,
    protocolThs: protocolHashrateHps / 1e12,
    sharesAccepted,
    sharesRejected,
    sharesStale,
    sharesTotal,
    staleRate,
    rejectionRate,
    acceptanceRate,
    efficiency,
    powerEfficiencyWPerTh,
  };
}

export function compareCohorts(cohortA, cohortB) {
  const staleRateDelta = cohortA.staleRate - cohortB.staleRate;
  const staleReductionPercentage = cohortA.staleRate > 0
    ? (staleRateDelta / cohortA.staleRate) * 100
    : 0;

  const efficiencyDelta = cohortB.efficiency - cohortA.efficiency;

  // Stale shares represent valid proof-of-work arrived too late due to propagation latency.
  // Reducing the stale rate by delta directly recovers that portion of the cohort's chip hashrate.
  const recoveredHashrateHps = Math.max(0, staleRateDelta * cohortB.physicalHashrateHps);
  const recoveredThs = recoveredHashrateHps / 1e12;

  return {
    cohortA,
    cohortB,
    staleRateDelta,
    staleReductionPercentage,
    efficiencyDelta,
    recoveredHashrateHps,
    recoveredThs,
  };
}

export function dollarizeGain(comparison, options = {}) {
  const hashpriceUsdPerThDay = Number(options.hashpriceUsdPerThDay) || DEFAULT_HASHPRICE_USD_PER_TH_DAY;
  const btcPriceUsd = Number(options.btcPriceUsd) || 0;

  const recoveredThs = comparison.recoveredThs;
  const dailyUsd = recoveredThs * hashpriceUsdPerThDay;
  const monthlyUsd = dailyUsd * 30.4375; // average month length
  const annualUsd = dailyUsd * 365;

  const minerCount = comparison.cohortB?.minerCount || 1;
  const annualPerMinerUsd = minerCount > 0 ? annualUsd / minerCount : 0;

  const dailySats = btcPriceUsd > 0 ? Math.round((dailyUsd / btcPriceUsd) * 1e8) : null;
  const monthlySats = dailySats !== null ? Math.round(dailySats * 30.4375) : null;

  return {
    hashpriceUsdPerThDay,
    btcPriceUsd,
    recoveredThs,
    dailyUsd,
    monthlyUsd,
    annualUsd,
    annualPerMinerUsd,
    dailySats,
    monthlySats,
  };
}
