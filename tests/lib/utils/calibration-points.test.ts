/**
 * Calibration certificate points — parsing + derived error.
 *
 * The numbers here follow what a balance calibration certificate actually
 * reports (nominal standard weight vs indicated value per test point) and the
 * USP <41> accuracy criterion of 0.10% that the equipment's tolerancePercent
 * defaults to.
 */
import { describe, it, expect } from 'vitest';
import {
  parseCalibrationPoints,
  stringifyCalibrationPoints,
  summariseCalibration,
} from '@/lib/utils/calibration-points';

describe('parseCalibrationPoints', () => {
  it('returns [] for null / empty / malformed input', () => {
    expect(parseCalibrationPoints(null)).toEqual([]);
    expect(parseCalibrationPoints('')).toEqual([]);
    expect(parseCalibrationPoints('not json')).toEqual([]);
    expect(parseCalibrationPoints('{"nominalG":1}')).toEqual([]); // object, not array
  });

  it('keeps only rows with usable numeric nominal + indicated values', () => {
    const raw = JSON.stringify([
      { nominalG: 200, indicatedG: 199.8, uncertaintyG: 0.05 },
      { nominalG: 'abc', indicatedG: 10 },
      { indicatedG: 10 },
      { nominalG: 500, indicatedG: 499.5 },
    ]);
    expect(parseCalibrationPoints(raw)).toEqual([
      { nominalG: 200, indicatedG: 199.8, uncertaintyG: 0.05 },
      { nominalG: 500, indicatedG: 499.5, uncertaintyG: null },
    ]);
  });

  it('round-trips through stringify, and stores empty as ""', () => {
    const points = [{ nominalG: 200, indicatedG: 199.8, uncertaintyG: null }];
    expect(parseCalibrationPoints(stringifyCalibrationPoints(points))).toEqual(points);
    expect(stringifyCalibrationPoints([])).toBe('');
  });
});

describe('summariseCalibration', () => {
  it('derives signed error in g and % per point', () => {
    const { points } = summariseCalibration(
      [
        { nominalG: 200, indicatedG: 199.8 },
        { nominalG: 1000, indicatedG: 1000.3 },
      ],
      0.1,
    );
    expect(points[0].errorG).toBeCloseTo(-0.2, 10);
    expect(points[0].errorPercent).toBeCloseTo(-0.1, 10);
    expect(points[1].errorG).toBeCloseTo(0.3, 10);
    expect(points[1].errorPercent).toBeCloseTo(0.03, 10);
  });

  it('reports the largest ABSOLUTE error, regardless of sign', () => {
    const s = summariseCalibration(
      [
        { nominalG: 200, indicatedG: 199.5 }, // -0.5 g, -0.25%
        { nominalG: 1000, indicatedG: 1000.3 }, // +0.3 g, +0.03%
      ],
      0.1,
    );
    expect(s.maxAbsErrorG).toBeCloseTo(0.5, 10);
    expect(s.maxAbsErrorPercent).toBeCloseTo(0.25, 10);
  });

  it('passes when every point is inside the acceptance criterion', () => {
    // USP <41> accuracy = 0.10%; -0.05% and +0.03% both clear it.
    const s = summariseCalibration(
      [
        { nominalG: 200, indicatedG: 199.9 },
        { nominalG: 1000, indicatedG: 1000.3 },
      ],
      0.1,
    );
    expect(s.withinTolerance).toBe(true);
  });

  it('fails when any single point exceeds the criterion', () => {
    const s = summariseCalibration(
      [
        { nominalG: 200, indicatedG: 199.9 }, // -0.05% ok
        { nominalG: 500, indicatedG: 498.0 }, // -0.40% out
      ],
      0.1,
    );
    expect(s.withinTolerance).toBe(false);
  });

  it('cannot judge without an acceptance criterion', () => {
    expect(summariseCalibration([{ nominalG: 200, indicatedG: 199.8 }], null).withinTolerance).toBeNull();
    expect(summariseCalibration([{ nominalG: 200, indicatedG: 199.8 }], 0).withinTolerance).toBeNull();
  });

  it('returns an empty summary when there are no points', () => {
    expect(summariseCalibration([], 0.1)).toEqual({
      points: [],
      maxAbsErrorG: null,
      maxAbsErrorPercent: null,
      withinTolerance: null,
    });
  });

  it('does not divide by a zero nominal value', () => {
    const s = summariseCalibration([{ nominalG: 0, indicatedG: 0.02 }], 0.1);
    expect(s.points[0].errorG).toBeCloseTo(0.02, 10);
    expect(s.points[0].errorPercent).toBeNull();
    expect(s.maxAbsErrorPercent).toBeNull();
    expect(s.withinTolerance).toBeNull();
  });
});
