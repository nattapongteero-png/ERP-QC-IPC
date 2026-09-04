/**
 * Result boxes for a √n + 1 plan.
 *
 * The plan and the test count different things. √n + 1 on a 40,000-unit lot
 * draws 201 units; the plant then takes a couple of grams off that sample and
 * gets a handful of readings out of it. Tying the boxes to the sample size
 * would ask the operator for 201 readings, which nobody measures.
 */
import { describe, it, expect } from 'vitest';
import {
  defaultSharedExtras,
  parseSharedExtras,
  effectiveSqrtResultFields,
  SQRT_RESULT_FIELD_DEFAULTS,
} from '@/lib/master-data/ipc-spec-payload';
import { sqrtPlusOneSampleSize } from '@/lib/master-data/ipc-sqrt-sampling';

describe('√n + 1 result fields', () => {
  it('starts at three boxes, the usual number', () => {
    expect(defaultSharedExtras().sqrtResultFields).toEqual([]);
    expect(effectiveSqrtResultFields([])).toEqual(['ผลที่ 1', 'ผลที่ 2', 'ผลที่ 3']);
    expect(effectiveSqrtResultFields([])).toEqual(SQRT_RESULT_FIELD_DEFAULTS);
  });

  it('keeps however many the author set, under whatever name', () => {
    const mine = ['ครั้งที่ 1', 'ครั้งที่ 2', 'ครั้งที่ 3', 'ครั้งที่ 4', 'ครั้งที่ 5'];
    const back = parseSharedExtras(JSON.stringify({ sqrtResultFields: mine }));
    expect(back.sqrtResultFields).toEqual(mine);
    expect(effectiveSqrtResultFields(back.sqrtResultFields)).toHaveLength(5);
  });

  it('counts nothing like the sample the plan draws', () => {
    // 40,000 units in the lot, 201 drawn — and still three readings written down.
    expect(sqrtPlusOneSampleSize(40000, null)?.sampleSize).toBe(201);
    expect(effectiveSqrtResultFields([])).toHaveLength(3);
  });

  it('ignores blanks and junk in the stored list', () => {
    const back = parseSharedExtras(
      JSON.stringify({ sqrtResultFields: ['ผลที่ 1', '', '   ', 7, null, { a: 1 }] }),
    );
    expect(back.sqrtResultFields).toEqual(['ผลที่ 1']);
  });

  it('leaves a criterion saved before this existed reading correctly', () => {
    const back = parseSharedExtras(JSON.stringify({ stage: 'ipc' }));
    expect(back.sqrtResultFields).toEqual([]);
    expect(effectiveSqrtResultFields(back.sqrtResultFields)).toHaveLength(3);
  });
});
