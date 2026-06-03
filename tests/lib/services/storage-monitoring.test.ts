/**
 * Storage Area Environmental Monitoring — alert engine tests
 * Audit Q6
 */
import { describe, it, expect } from 'vitest';
import { evaluateAlert } from '@/lib/services/storage-monitoring.service';

const dryStore = {
  temperatureMin: 15,
  temperatureMax: 30,
  humidityMin: 30,
  humidityMax: 65,
};

describe('evaluateAlert — in spec', () => {
  it('returns in_spec when both values inside range', () => {
    const r = evaluateAlert({ temperature: 22, humidity: 50 }, dryStore);
    expect(r.alertLevel).toBe('in_spec');
    expect(r.alertMessage).toBeNull();
  });

  it('returns in_spec when only one value present and inside range', () => {
    const r = evaluateAlert({ temperature: 22 }, dryStore);
    expect(r.alertLevel).toBe('in_spec');
  });

  it('treats boundary values as in spec (inclusive range)', () => {
    expect(evaluateAlert({ temperature: 15, humidity: 65 }, dryStore).alertLevel).toBe('in_spec');
    expect(evaluateAlert({ temperature: 30, humidity: 30 }, dryStore).alertLevel).toBe('in_spec');
  });
});

describe('evaluateAlert — single-axis alerts', () => {
  it('temp_high when temp > max', () => {
    const r = evaluateAlert({ temperature: 31, humidity: 50 }, dryStore);
    expect(r.alertLevel).toBe('temp_high');
    expect(r.alertMessage).toMatch(/อุณหภูมิ/);
  });

  it('temp_low when temp < min', () => {
    const r = evaluateAlert({ temperature: 10, humidity: 50 }, dryStore);
    expect(r.alertLevel).toBe('temp_low');
  });

  it('humidity_high when humidity > max', () => {
    const r = evaluateAlert({ temperature: 22, humidity: 70 }, dryStore);
    expect(r.alertLevel).toBe('humidity_high');
  });

  it('humidity_low when humidity < min', () => {
    const r = evaluateAlert({ temperature: 22, humidity: 20 }, dryStore);
    expect(r.alertLevel).toBe('humidity_low');
  });
});

describe('evaluateAlert — multiple axes', () => {
  it('returns multiple when both temp and humidity out of spec', () => {
    const r = evaluateAlert({ temperature: 35, humidity: 80 }, dryStore);
    expect(r.alertLevel).toBe('multiple');
    expect(r.reasons.length).toBe(2);
  });

  it('lists each violation in alertMessage', () => {
    const r = evaluateAlert({ temperature: 35, humidity: 80 }, dryStore);
    expect(r.alertMessage).toMatch(/อุณหภูมิ/);
    expect(r.alertMessage).toMatch(/ความชื้น/);
  });
});

describe('evaluateAlert — partial spec', () => {
  it('skips temp check when warehouse has no temperatureMin/Max', () => {
    const noTempSpec = { humidityMin: 30, humidityMax: 65 };
    const r = evaluateAlert({ temperature: 100, humidity: 50 }, noTempSpec);
    expect(r.alertLevel).toBe('in_spec');
  });

  it('treats null reading as not measured (no alert)', () => {
    const r = evaluateAlert({ temperature: null, humidity: null }, dryStore);
    expect(r.alertLevel).toBe('in_spec');
  });
});
