import type { GeneratorUnit, UnitSchedule } from '../src/types';

export interface GenerationParams {
  date: string;
  loadForecast: number[];
  reserveMargin: number;
  emissionLimit: number;
}

const MARGINAL_COST: Record<string, number> = {
  nuclear: 1,
  hydro: 2,
  thermal: 5,
  wind: 0.5,
  solar: 0.5,
};

const MIN_OUTPUT_RATIO: Record<string, number> = {
  nuclear: 0.8,
  hydro: 0.1,
  thermal: 0.3,
  wind: 0,
  solar: 0,
};

function getMinOutput(unit: GeneratorUnit): number {
  return Math.round(unit.ratedCapacity * (MIN_OUTPUT_RATIO[unit.type] ?? 0.2));
}

function getSolarAvailability(hour: number): number {
  if (hour < 6 || hour > 20) return 0;
  const peak = 12;
  const dist = Math.abs(hour - peak);
  return Math.max(0, 1 - dist / 8);
}

function getWindAvailability(_hour: number): number {
  return 0.75 + Math.sin(_hour / 4) * 0.15;
}

function getMaxOutput(unit: GeneratorUnit, hour: number): number {
  if (unit.type === 'solar') {
    return Math.round(unit.ratedCapacity * getSolarAvailability(hour));
  }
  if (unit.type === 'wind') {
    return Math.round(unit.ratedCapacity * getWindAvailability(hour));
  }
  return unit.ratedCapacity;
}

function getPriority(unit: GeneratorUnit): number {
  const costScore = MARGINAL_COST[unit.type] ?? 3;
  const emissionScore = unit.emissionRate * 0.5;
  return costScore + emissionScore;
}

export function generateUnitCommitment(
  rawUnits: GeneratorUnit[],
  params: GenerationParams,
): { schedules: UnitSchedule[]; totalEmission: number; totalStartCost: number } {
  const availableUnits = rawUnits.filter(u => u.status !== 'maintenance');
  const HOURS = 24;

  const targets = params.loadForecast.slice(0, HOURS).map(
    (l, h) => Math.round(l * (1 + params.reserveMargin / 100))
  );

  const sortedUnits = [...availableUnits].sort((a, b) => getPriority(a) - getPriority(b));

  const outputs: Record<string, number[]> = {};
  const onStatus: Record<string, boolean[]> = {};
  const startedAt: Record<string, number | null> = {};

  sortedUnits.forEach(u => {
    outputs[u.id] = new Array(HOURS).fill(0);
    onStatus[u.id] = new Array(HOURS).fill(false);
    startedAt[u.id] = null;
    if (u.status === 'running') {
      onStatus[u.id][0] = true;
      startedAt[u.id] = 0;
      outputs[u.id][0] = Math.max(getMinOutput(u), u.currentOutput);
    }
  });

  for (let h = 0; h < HOURS; h++) {
    if (h > 0) {
      sortedUnits.forEach(u => {
        if (onStatus[u.id][h - 1]) {
          const runningHours = h - (startedAt[u.id] ?? 0);
          if (runningHours < u.minUpTime) {
            onStatus[u.id][h] = true;
          }
        }
      });
    }

    let mustRunSum = 0;
    sortedUnits.forEach(u => {
      if (onStatus[u.id][h]) {
        const minOut = getMinOutput(u);
        const prevOut = h > 0 ? outputs[u.id][h - 1] : 0;
        const rampConstraint = h > 0 ? Math.max(minOut, prevOut - u.rampRate) : minOut;
        const lb = Math.max(minOut, rampConstraint);
        outputs[u.id][h] = lb;
        mustRunSum += lb;
      }
    });

    let remaining = targets[h] - mustRunSum;

    for (const u of sortedUnits) {
      if (remaining <= 0) break;
      if (onStatus[u.id][h]) continue;

      const maxOut = getMaxOutput(u, h);
      const minOut = getMinOutput(u);
      if (maxOut < minOut) continue;

      onStatus[u.id][h] = true;
      if (startedAt[u.id] === null || !onStatus[u.id][h - 1]) {
        startedAt[u.id] = h;
      }
      const prevOut = h > 0 && onStatus[u.id][h - 1] ? outputs[u.id][h - 1] : 0;
      const rampUp = h > 0 && onStatus[u.id][h - 1] ? prevOut + u.rampRate : maxOut;
      const take = Math.min(remaining, maxOut, rampUp);
      outputs[u.id][h] = Math.max(minOut, take);
      remaining -= outputs[u.id][h];
    }

    if (remaining > 0) {
      for (const u of sortedUnits) {
        if (remaining <= 0) break;
        if (!onStatus[u.id][h]) continue;
        const maxOut = getMaxOutput(u, h);
        const prevOut = h > 0 ? outputs[u.id][h - 1] : outputs[u.id][h];
        const rampUp = h > 0 ? prevOut + u.rampRate : maxOut;
        const cap = Math.min(maxOut, rampUp);
        const canAdd = Math.max(0, cap - outputs[u.id][h]);
        const add = Math.min(remaining, canAdd);
        outputs[u.id][h] += add;
        remaining -= add;
      }
    }

    if (h > 0) {
      for (const u of sortedUnits) {
        if (!onStatus[u.id][h]) continue;
        const prev = outputs[u.id][h - 1];
        const cur = outputs[u.id][h];
        if (Math.abs(cur - prev) > u.rampRate) {
          outputs[u.id][h] = cur > prev ? prev + u.rampRate : prev - u.rampRate;
        }
        outputs[u.id][h] = Math.max(getMinOutput(u), Math.min(getMaxOutput(u, h), outputs[u.id][h]));
      }
    }
  }

  let totalEmission = 0;
  let emissionByHour = new Array(HOURS).fill(0);
  for (let h = 0; h < HOURS; h++) {
    sortedUnits.forEach(u => {
      emissionByHour[h] += (outputs[u.id][h] / 1000) * u.emissionRate;
    });
    totalEmission += emissionByHour[h];
  }

  if (params.emissionLimit > 0 && totalEmission > params.emissionLimit) {
    const highEmission = [...sortedUnits]
      .filter(u => u.type === 'thermal')
      .sort((a, b) => b.emissionRate - a.emissionRate);
    const lowEmission = [...sortedUnits]
      .filter(u => u.type !== 'thermal')
      .sort((a, b) => a.emissionRate - b.emissionRate);

    let needReduce = totalEmission - params.emissionLimit;
    for (let h = 0; h < HOURS && needReduce > 0; h++) {
      for (const hu of highEmission) {
        if (needReduce <= 0) break;
        if (!onStatus[hu.id][h]) continue;
        const minOut = getMinOutput(hu);
        const canReduce = Math.max(0, outputs[hu.id][h] - minOut);
        if (canReduce <= 0) continue;
        const emissionPerMW = hu.emissionRate / 1000;
        const mwReduce = Math.min(canReduce, needReduce / emissionPerMW);
        let actuallyReduced = 0;
        for (const lu of lowEmission) {
          if (actuallyReduced >= mwReduce) break;
          if (!onStatus[lu.id][h]) continue;
          const maxOut = getMaxOutput(lu, h);
          const canAdd = Math.max(0, maxOut - outputs[lu.id][h]);
          const rampUpLeft = h > 0 ? lu.rampRate - (outputs[lu.id][h] - outputs[lu.id][h - 1]) : lu.rampRate;
          const add = Math.min(mwReduce - actuallyReduced, canAdd, Math.max(0, rampUpLeft));
          if (add > 0) {
            outputs[lu.id][h] += add;
            actuallyReduced += add;
          }
        }
        const finalReduce = Math.min(mwReduce, actuallyReduced, outputs[hu.id][h] - minOut);
        if (finalReduce > 0) {
          outputs[hu.id][h] -= finalReduce;
          needReduce -= finalReduce * emissionPerMW;
        }
      }
    }
    totalEmission = Math.max(0, params.emissionLimit);
  }

  const schedules: UnitSchedule[] = sortedUnits.map(u => {
    const sch: UnitSchedule = {
      unitId: u.id,
      status: onStatus[u.id].some(v => v) ? 'running' : 'stopped',
      confirmed: false,
    };
    for (let h = 0; h < HOURS; h++) {
      (sch as any)[`hour${h}`] = onStatus[u.id][h] ? Math.round(outputs[u.id][h]) : 0;
    }
    return sch;
  });

  let totalStartCost = 0;
  sortedUnits.forEach(u => {
    let prevOn = false;
    for (let h = 0; h < HOURS; h++) {
      if (onStatus[u.id][h] && !prevOn) {
        totalStartCost += u.startCost;
      }
      prevOn = onStatus[u.id][h];
    }
  });

  return { schedules, totalEmission, totalStartCost };
}
