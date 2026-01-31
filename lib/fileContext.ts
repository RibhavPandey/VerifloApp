import type { ExcelFile } from '../types';

function cleanNum(val: unknown): number {
  if (typeof val === 'number') return val;
  if (val == null) return 0;
  let s = String(val).trim();
  const isParens = s.startsWith('(') && s.endsWith(')');
  if (isParens) s = s.slice(1, -1);
  s = s.replace(/[$,\u00A3\u20AC\u00A5a-zA-Z\s]/g, '');
  let num = parseFloat(s);
  if (isParens && !isNaN(num)) num = -num;
  return isNaN(num) ? 0 : num;
}

function isNumericColumn(values: unknown[]): boolean {
  const sample = values.slice(0, 50).map(v => String(v ?? '').trim()).filter(Boolean);
  if (sample.length < 2) return false;
  let numericCount = 0;
  for (const s of sample) {
    const n = cleanNum(s);
    if (!isNaN(n) && s.replace(/[$,\s%]/g, '').length > 0) numericCount++;
  }
  return numericCount >= sample.length * 0.5;
}

function truncate(val: unknown, maxLen = 50): string {
  const s = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');
  return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
}

const MAX_CONTEXT_CHARS = 8000;

export function buildFileContext(files: ExcelFile[]): string {
  const parts: string[] = [];
  let totalChars = 0;

  for (const f of files) {
    const data = f.data || [];
    const columns = f.columns || (data[0] ? data[0].map(String) : []);
    const rows = data[0] ? data.slice(1) : data;
    const rowCount = rows.length;

    let block = `File: "${f.name}"\nColumns: ${columns.join(', ')}\nRow count: ${rowCount}\n`;

    const colStats: string[] = [];
    for (let i = 0; i < columns.length; i++) {
      const colVals = rows.map(r => (r && r[i] !== undefined ? r[i] : '')).filter(v => v !== '' && v != null);
      if (colVals.length === 0) {
        colStats.push(`- ${columns[i]}: empty`);
        continue;
      }
      if (isNumericColumn(colVals)) {
        const nums = colVals.map(v => cleanNum(v));
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        const sum = nums.reduce((a, b) => a + b, 0);
        colStats.push(`- ${columns[i]}: numeric, min=${min}, max=${max}, sum=${sum.toFixed(2)}`);
      } else {
        const uniq = [...new Set(colVals.map(String))].slice(0, 10);
        colStats.push(`- ${columns[i]}: text, unique sample: ${uniq.join(', ')}`);
      }
    }
    block += `Column stats:\n${colStats.join('\n')}\n`;

    const sampleRows = rows.slice(0, 10).map(r =>
      Array.isArray(r) ? r.map(v => truncate(v)) : [truncate(r)]
    );
    block += `Sample (first ${Math.min(10, rows.length)} rows): ${JSON.stringify(sampleRows)}\n`;

    if (totalChars + block.length > MAX_CONTEXT_CHARS) {
      const remaining = MAX_CONTEXT_CHARS - totalChars - 50;
      if (remaining > 100) {
        block = block.slice(0, remaining) + '\n...[truncated]';
      } else {
        break;
      }
    }
    parts.push(block);
    totalChars += block.length;
  }

  return parts.join('\n\n');
}

export function getValidColumnsForPrompts(file: ExcelFile): { numericCol: string | null; categoryCol: string | null } {
  const data = file.data || [];
  const columns = file.columns || (data[0] ? data[0].map(String) : []);
  const rows = data[0] ? data.slice(1) : data;
  if (columns.length === 0 || rows.length === 0) return { numericCol: null, categoryCol: null };

  let numericCol: string | null = null;
  let categoryCol: string | null = null;

  for (let i = 0; i < columns.length; i++) {
    const colVals = rows.map(r => (r && r[i] !== undefined ? r[i] : '')).filter(v => v !== '' && v != null);
    if (colVals.length < 2) continue;
    if (isNumericColumn(colVals) && !numericCol) {
      numericCol = columns[i];
    } else if (!isNumericColumn(colVals) && !categoryCol) {
      categoryCol = columns[i];
    }
    if (numericCol && categoryCol) break;
  }
  return { numericCol, categoryCol };
}

/** Find a value column name across files (Revenue, Cost, Amount, Total, etc.) for multi-file prompts */
export function getValueColumnForMultiFile(files: ExcelFile[]): string | null {
  const preferred = ['revenue', 'cost', 'amount', 'total', 'value', 'sales', 'price'];
  for (const f of files) {
    const { numericCol } = getValidColumnsForPrompts(f);
    if (numericCol) {
      const lower = numericCol.toLowerCase();
      if (preferred.some(p => lower.includes(p))) return numericCol;
    }
  }
  const first = files[0];
  return first ? getValidColumnsForPrompts(first).numericCol : null;
}
