// Spreadsheet data validation utilities

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

// Maximum limits to prevent performance issues
const MAX_ROWS = 100000;
const MAX_COLS = 1000;
const MAX_CELL_VALUE_LENGTH = 100000; // 100KB per cell

// Validate spreadsheet data structure
export function validateSpreadsheetData(data: any[][]): ValidationResult {
  // Check if data exists
  if (!data || !Array.isArray(data)) {
    return {
      valid: false,
      error: 'Spreadsheet data must be a 2D array',
    };
  }

  // Check if data is empty
  if (data.length === 0) {
    return {
      valid: false,
      error: 'Spreadsheet cannot be empty',
    };
  }

  // Check row count
  if (data.length > MAX_ROWS) {
    return {
      valid: false,
      error: `Spreadsheet has too many rows (${data.length}). Maximum is ${MAX_ROWS} rows.`,
    };
  }

  const warnings: string[] = [];

  // Validate each row
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    
    if (!Array.isArray(row)) {
      return {
        valid: false,
        error: `Row ${i + 1} is not an array`,
      };
    }

    // Check column count
    if (row.length > MAX_COLS) {
      return {
        valid: false,
        error: `Row ${i + 1} has too many columns (${row.length}). Maximum is ${MAX_COLS} columns.`,
      };
    }

    // Validate cell values
    for (let j = 0; j < row.length; j++) {
      const cellValue = row[j];
      
      // Check cell value length
      if (cellValue !== null && cellValue !== undefined) {
        const cellStr = String(cellValue);
        if (cellStr.length > MAX_CELL_VALUE_LENGTH) {
          return {
            valid: false,
            error: `Cell at row ${i + 1}, column ${j + 1} is too large (${cellStr.length} characters). Maximum is ${MAX_CELL_VALUE_LENGTH} characters.`,
          };
        }
      }
    }
  }

  // Warn if spreadsheet is very large
  if (data.length > 10000) {
    warnings.push(`Large spreadsheet detected (${data.length} rows). Performance may be affected.`);
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// Validate formula syntax (basic check)
export function validateFormula(formula: string): ValidationResult {
  if (!formula || typeof formula !== 'string') {
    return {
      valid: false,
      error: 'Formula must be a non-empty string',
    };
  }

  // Must start with =
  if (!formula.trim().startsWith('=')) {
    return {
      valid: false,
      error: 'Formula must start with =',
    };
  }

  // Check for balanced parentheses
  let openParens = 0;
  for (const char of formula) {
    if (char === '(') openParens++;
    if (char === ')') openParens--;
    if (openParens < 0) {
      return {
        valid: false,
        error: 'Formula has unmatched closing parenthesis',
      };
    }
  }
  if (openParens > 0) {
    return {
      valid: false,
      error: 'Formula has unmatched opening parenthesis',
    };
  }

  // Check for dangerous patterns (basic XSS/injection prevention)
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(formula)) {
      return {
        valid: false,
        error: 'Formula contains potentially unsafe content',
      };
    }
  }

  // Check formula length
  if (formula.length > 10000) {
    return {
      valid: false,
      error: 'Formula is too long (maximum 10000 characters)',
    };
  }

  return { valid: true };
}

// Sanitize cell value
export function sanitizeCellValue(value: any): any {
  if (value === null || value === undefined) {
    return '';
  }

  // If it's a string, check length
  if (typeof value === 'string') {
    // Truncate if too long
    if (value.length > MAX_CELL_VALUE_LENGTH) {
      return value.substring(0, MAX_CELL_VALUE_LENGTH);
    }
    return value;
  }

  // Convert to string if it's an object (but not Date)
  if (typeof value === 'object' && !(value instanceof Date)) {
    try {
      const str = JSON.stringify(value);
      if (str.length > MAX_CELL_VALUE_LENGTH) {
        return str.substring(0, MAX_CELL_VALUE_LENGTH);
      }
      return str;
    } catch {
      return String(value).substring(0, MAX_CELL_VALUE_LENGTH);
    }
  }

  return value;
}

// Normalize data array (ensure all rows have same length, fill with empty strings)
export function normalizeData(data: any[][]): any[][] {
  if (!data || data.length === 0) {
    return [['']];
  }

  // Find max column count
  const maxCols = Math.max(...data.map(row => row?.length || 0));

  // Normalize each row
  return data.map(row => {
    if (!Array.isArray(row)) {
      return Array(maxCols).fill('');
    }
    // Pad row to maxCols
    const normalized = [...row];
    while (normalized.length < maxCols) {
      normalized.push('');
    }
    return normalized.map(cell => sanitizeCellValue(cell));
  });
}