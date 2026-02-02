import { describe, it, expect } from 'vitest';
import { validateSpreadsheetData, validateFormula, normalizeData } from './spreadsheet-validation';

describe('validateSpreadsheetData', () => {
  it('rejects null or non-array', () => {
    expect(validateSpreadsheetData(null as any).valid).toBe(false);
    expect(validateSpreadsheetData(undefined as any).valid).toBe(false);
    expect(validateSpreadsheetData('not array' as any).valid).toBe(false);
  });

  it('rejects empty array', () => {
    const result = validateSpreadsheetData([]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('accepts valid 2D array', () => {
    const result = validateSpreadsheetData([['A', 'B'], [1, 2]]);
    expect(result.valid).toBe(true);
  });

  it('rejects row that is not array', () => {
    const result = validateSpreadsheetData([['A'], 'not array'] as any);
    expect(result.valid).toBe(false);
  });
});

describe('validateFormula', () => {
  it('rejects empty or non-string', () => {
    expect(validateFormula('').valid).toBe(false);
    expect(validateFormula(null as any).valid).toBe(false);
  });

  it('rejects formula without =', () => {
    const result = validateFormula('SUM(A1:A5)');
    expect(result.valid).toBe(false);
  });

  it('accepts valid formula', () => {
    const result = validateFormula('=SUM(A1:A5)');
    expect(result.valid).toBe(true);
  });
});

describe('normalizeData', () => {
  it('returns [[""]] for empty input', () => {
    expect(normalizeData([])).toEqual([['']]);
    expect(normalizeData(null as any)).toEqual([['']]);
  });

  it('pads rows to max column count', () => {
    const data = [['A', 'B'], ['1']];
    const result = normalizeData(data);
    expect(result[0].length).toBe(2);
    expect(result[1].length).toBe(2);
  });
});
