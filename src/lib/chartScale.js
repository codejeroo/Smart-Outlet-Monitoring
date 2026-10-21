// Charts must be scaled to the loads that exist, not to a hoped-for maximum.
// The previous fixed domains (0-1500 W, 0-2 A) put every real measurement in the
// bottom few percent of the plot.

// The firmware treats anything under 5 W as idle. That threshold is the
// classification boundary, so the power chart has to keep it visible.
export const IDLE_THRESHOLD_W = 5;

// A ladder of "nice" ceilings. Coarse steps beat the classic 1-2-5 alone because
// measured loads cluster at the low end of the range.
const LADDER = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

export const niceCeiling = (value, floor = 1) => {
  const target = Math.max(Number.isFinite(value) ? value : 0, floor);
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const normalized = target / magnitude;
  const step = LADDER.find((entry) => normalized <= entry) ?? 10;
  return step * magnitude;
};

export const roundDownTo = (value, step) => Math.floor(value / step) * step;
export const roundUpTo = (value, step) => Math.ceil(value / step) * step;

// Recharts happily renders 0.6000000000000001 on a tick.
export const cleanTick = (digits) => (value) => Number(value.toFixed(digits));
