
// This worker logic is embedded as a Blob to work without a specific bundler config for workers.
// It handles:
// 1. Secure AI Code Execution (Sandbox)
// 2. Heavy CSV Parsing
// 3. Heavy Data Processing

const workerCode = `
self.onmessage = async (e) => {
  const { type, payload, id } = e.data;

  try {
    if (type === 'PARSE_CSV') {
        const result = parseCSV(payload.text);
        self.postMessage({ type: 'PARSE_CSV_SUCCESS', id, result });
    } 
    else if (type === 'EXECUTE_CODE') {
        const { code, datasets, primaryData } = payload;
        const result = executeUserCode(code, datasets, primaryData);
        self.postMessage({ type: 'EXECUTE_CODE_SUCCESS', id, result });
    }
  } catch (err) {
    self.postMessage({ type: 'ERROR', id, error: err.message });
  }
};

// --- HELPER FUNCTIONS ---

function parseCSV(text) {
  const result = [];
  let row = [];
  let current = "";
  let inQuote = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i+1];
    
    if (inQuote) {
      if (char === '"') {
        if (next === '"') {
          current += '"';
          i++; 
        } else {
          inQuote = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuote = true;
      } else if (char === ',') {
        row.push(current);
        current = "";
      } else if (char === '\\n' || (char === '\\r' && next === '\\n')) {
        row.push(current);
        result.push(row);
        row = [];
        current = "";
        if (char === '\\r') i++; 
      } else if (char === '\\r') {
         row.push(current);
         result.push(row);
         row = [];
         current = "";
      } else {
        current += char;
      }
    }
  }
  if (current || row.length > 0) {
    row.push(current);
    result.push(row);
  }
  return result;
}

function executeUserCode(code, datasets, primaryData) {
    const headers = primaryData[0] || [];
    const rows = primaryData || []; 

    // Helper: Fuzzy Column Finder
    const findCol = (name, fileData = primaryData) => {
        const h = fileData[0] || [];
        if (!name) return -1;
        const n = String(name).toLowerCase().trim();
        let idx = h.findIndex(c => String(c).toLowerCase().trim() === n);
        if (idx === -1) idx = h.findIndex(c => String(c).toLowerCase().trim().includes(n));
        return idx;
    };

    // Helper: Number Cleaner
    const cleanNum = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        let s = String(val).trim();
        const isParens = s.startsWith('(') && s.endsWith(')');
        if (isParens) s = s.slice(1, -1);
        s = s.replace(/[$,\\u00A3\\u20AC\\u00A5a-zA-Z\\s]/g, '');
        let num = parseFloat(s);
        if (isParens && !isNaN(num)) num = -num;
        return isNaN(num) ? 0 : num;
    };

    // Helper: Get Cleaned Num Column
    const getNumCol = (colName, fileData = primaryData) => {
        const idx = findCol(colName, fileData);
        if (idx === -1) return [];
        return fileData.slice(1).map(r => cleanNum(r[idx]));
    };

    // Helper: Get Raw Data Column
    const getColData = (colName, fileData = primaryData) => {
        const idx = findCol(colName, fileData);
        if (idx === -1) return [];
        return fileData.slice(1).map(r => r[idx]);
    };

    // Safe execution context wrapper
    // We wrap in an IIFE to prevent variable leakage and ensure return
    const wrappedCode = \`
        (function() {
            try {
                \${code}
            } catch(e) {
                return { error: e.toString() };
            }
        })()
    \`;

    // Construct the function with restricted scope
    // Note: In a Worker, 'window' and 'document' are not available, improving security.
    // We pass helpers as arguments.
    const func = new Function(
          'datasets', 
          'rows', 
          'headers', 
          'findCol', 
          'cleanNum', 
          'getNumCol', 
          'getColData', 
          wrappedCode
    );
      
    return func(datasets, rows, headers, findCol, cleanNum, getNumCol, getColData);
}
`;

class WorkerManager {
    private worker: Worker | null = null;
    private callbacks: Map<string, (data: any) => void> = new Map();

    constructor() {
        if (typeof window !== 'undefined') {
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            this.worker = new Worker(URL.createObjectURL(blob));
            
            this.worker.onmessage = (e) => {
                const { type, id, result, error } = e.data;
                const callback = this.callbacks.get(id);
                if (callback) {
                    if (type === 'ERROR') {
                        // We handle error in the callback logic usually
                        callback({ error });
                    } else {
                        callback(result);
                    }
                    this.callbacks.delete(id);
                }
            };
        }
    }

    public parseCSV(text: string): Promise<any[][]> {
        return new Promise((resolve, reject) => {
            const id = crypto.randomUUID();
            this.callbacks.set(id, (res) => {
                if (res && res.error) reject(res.error);
                else resolve(res);
            });
            this.worker?.postMessage({ type: 'PARSE_CSV', id, payload: { text } });
        });
    }

    public executeCode(code: string, datasets: any, primaryData: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const id = crypto.randomUUID();
            this.callbacks.set(id, (res) => {
                if (res && res.error) reject(res.error);
                else resolve(res);
            });
            this.worker?.postMessage({ type: 'EXECUTE_CODE', id, payload: { code, datasets, primaryData } });
        });
    }
}

export const worker = new WorkerManager();
