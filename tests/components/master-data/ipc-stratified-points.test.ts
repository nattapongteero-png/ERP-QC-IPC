/**
 * Stratified sampling: how many points there are, and which ones apply, belong
 * to the author's SOP — not to the method.
 *
 * The method used to hand back three fixed points that were all switched on
 * with no way to change any of it. But a silo sampled at five depths and a
 * tablet press sampled at three time points are both stratified sampling, and
 * a plan that draws from the top and bottom of a drum but deliberately skips
 * the middle is a real plan someone has to be able to write down.
 */
import { describe, it, expect } from 'vitest';
import {
  SAMPLING_METHOD_OPTIONS,
  cadenceForSamplingMethod,
} from '@/lib/master-data/ipc-test-catalog';
import {
  defaultSharedExtras,
  parseSharedExtras,
  effectiveSamplingPoints,
  pointDrivenSampleSize,
  type SamplingPoint,
} from '@/lib/master-data/ipc-spec-payload';

const effectivePoints = (stored: SamplingPoint[], method: string) =>
  effectiveSamplingPoints(method, stored);

describe('stratified sampling points', () => {
  it('is offered without naming a fixed number of points', () => {
    const option = SAMPLING_METHOD_OPTIONS.find((o) => o.value === 'stratified');
    expect(option?.label).toBe('สุ่มแบ่งชั้น — ระบุตามจุด');
    // The old wording pinned the method to the clock and to a count of three.
    expect(option?.label).not.toMatch(/ต้น|ปลาย|3 จุด|SOP\)|Stratified/);
  });

  it('hands its points to the author, unlike √n + 1', () => {
    expect(cadenceForSamplingMethod('stratified').editablePoints).toBe(true);
    // "Once per batch" is a fact about the formula — there is nothing to pick.
    expect(cadenceForSamplingMethod('square_root').editablePoints).not.toBe(true);
  });

  it('starts from a three-point draft when nothing has been saved', () => {
    const extras = defaultSharedExtras();
    expect(extras.samplingPoints).toEqual([]);
    expect(effectivePoints(extras.samplingPoints, 'stratified')).toEqual([
      { label: 'จุดที่ 1', on: true },
      { label: 'จุดที่ 2', on: true },
      { label: 'จุดที่ 3', on: true },
    ]);
  });

  it('keeps points the author added beyond the draft three', () => {
    const stored: SamplingPoint[] = [
      { label: 'บนถุง', on: true },
      { label: 'กลางถุง', on: true },
      { label: 'ล่างถุง', on: true },
      { label: 'ก้นถุง', on: true },
      { label: 'ปากถุง', on: true },
    ];
    const back = parseSharedExtras(JSON.stringify({ samplingPoints: stored }));
    expect(back.samplingPoints).toEqual(stored);
    expect(effectivePoints(back.samplingPoints, 'stratified')).toHaveLength(5);
  });

  it('remembers a point that was switched off rather than dropping it', () => {
    const back = parseSharedExtras(
      JSON.stringify({
        samplingPoints: [
          { label: 'บน', on: true },
          { label: 'กลาง', on: false },
          { label: 'ล่าง', on: true },
        ],
      }),
    );
    expect(back.samplingPoints.map((p) => p.on)).toEqual([true, false, true]);
    expect(back.samplingPoints.map((p) => p.label)).toEqual(['บน', 'กลาง', 'ล่าง']);
  });

  it('treats a point with no on flag as part of the plan', () => {
    const back = parseSharedExtras(JSON.stringify({ samplingPoints: [{ label: 'บน' }] }));
    expect(back.samplingPoints).toEqual([{ label: 'บน', on: true }]);
  });

  it('ignores junk in the stored list', () => {
    const back = parseSharedExtras(
      JSON.stringify({ samplingPoints: [{ label: '' }, 'x', 7, null, { label: 'บน', on: true }] }),
    );
    expect(back.samplingPoints).toEqual([{ label: 'บน', on: true }]);
  });

  it('leaves a criterion saved before this existed reading correctly', () => {
    const back = parseSharedExtras(JSON.stringify({ stage: 'ipc', samplingUnit: '' }));
    expect(back.samplingPoints).toEqual([]);
    expect(effectivePoints(back.samplingPoints, 'stratified')).toHaveLength(3);
  });
});

describe('sample size under a plan that names its points', () => {
  it('is dictated by the points, so the form has no box to disagree with', () => {
    const points: SamplingPoint[] = [
      { label: 'บนถุง', on: true },
      { label: 'กลางถุง', on: true },
      { label: 'ล่างถุง', on: true },
      { label: 'ก้นถุง', on: true },
    ];
    expect(pointDrivenSampleSize('stratified', points)).toBe(4);
  });

  it('counts only the points that are switched on', () => {
    const points: SamplingPoint[] = [
      { label: 'บน', on: true },
      { label: 'กลาง', on: false },
      { label: 'ล่าง', on: true },
    ];
    expect(pointDrivenSampleSize('stratified', points)).toBe(2);
    // The switched-off point is still on record, just not sampled.
    expect(effectiveSamplingPoints('stratified', points)).toHaveLength(3);
  });

  it('follows the draft three before the author touches anything', () => {
    expect(pointDrivenSampleSize('stratified', [])).toBe(3);
  });

  it('reports zero when every point is off, so saving can be blocked', () => {
    expect(pointDrivenSampleSize('stratified', [{ label: 'บน', on: false }])).toBe(0);
  });

  it('leaves the count to the author under every other method', () => {
    for (const m of ['random', 'systematic', 'square_root', '', null, undefined]) {
      expect(pointDrivenSampleSize(m, [])).toBeNull();
    }
  });

  it('names the preview rows after the points that are on', () => {
    const points: SamplingPoint[] = [
      { label: 'บน', on: true },
      { label: 'กลาง', on: false },
      { label: 'ล่าง', on: true },
    ];
    const labels = effectiveSamplingPoints('stratified', points)
      .filter((pt) => pt.on)
      .map((pt) => pt.label);
    expect(labels).toEqual(['บน', 'ล่าง']);
    expect(labels).toHaveLength(pointDrivenSampleSize('stratified', points)!);
  });
});
