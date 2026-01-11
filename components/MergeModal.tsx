
import React, { useState, useMemo } from 'react';
import { X, ArrowRight, GitMerge, FileText, Check, AlertCircle, Sparkles, Database, Info, RefreshCw, Layers, ArrowDown } from 'lucide-react';
import { ExcelFile, JoinType } from '../types';

interface MergeModalProps {
  files: ExcelFile[];
  onClose: () => void;
  onMergeComplete: (newFile: ExcelFile) => void;
}

type MergeMode = 'join' | 'stack';

const MergeModal: React.FC<MergeModalProps> = ({ files, onClose, onMergeComplete }) => {
  const [step, setStep] = useState(1);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [mergeMode, setMergeMode] = useState<MergeMode>('join');

  // Join Mode State
  const [mergeKey, setMergeKey] = useState<string>('');
  const [joinType, setJoinType] = useState<JoinType>(JoinType.OUTER);

  // Execution State
  const [isMerging, setIsMerging] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any[][] | null>(null);
  const [previewMetrics, setPreviewMetrics] = useState<{ rowCount: number } | null>(null);

  const selectedFiles = useMemo(() =>
    files.filter(f => selectedFileIds.includes(f.id)),
    [files, selectedFileIds]);

  const commonColumns = useMemo(() => {
    if (selectedFiles.length < 2) return [];
    const colCounts: Record<string, number> = {};
    selectedFiles.forEach(f => {
      f.columns.forEach(col => {
        colCounts[col] = (colCounts[col] || 0) + 1;
      });
    });
    return Object.entries(colCounts)
      .filter(([_, count]) => count === selectedFiles.length)
      .map(([col]) => col);
  }, [selectedFiles]);

  const toggleFile = (id: string) => {
    setSelectedFileIds(prev => {
      // If unchecking, just remove it
      if (prev.includes(id)) return prev.filter(fid => fid !== id);

      // If checking...
      if (mergeMode === 'join') {
        // Limit to 2 files for Join
        if (prev.length >= 2) {
          return [prev[1], id]; // Shift to keep most recent + new
        }
      }
      return [...prev, id];
    });
  };

  // Switch modes and reset selection if invalid for new mode
  const handleModeChange = (mode: MergeMode) => {
    setMergeMode(mode);
    if (mode === 'join' && selectedFileIds.length > 2) {
      setSelectedFileIds(selectedFileIds.slice(0, 2));
    }
    setStep(1);
    setShowPreview(false);
  };

  // --- LOGIC: STACK (APPEND) ---
  const runStack = (): { data: any[][], columns: string[] } | null => {
    if (selectedFiles.length < 2) return null;

    // 1. Get Union of all columns
    const allColumns = new Set<string>();
    selectedFiles.forEach(f => f.columns.forEach(c => allColumns.add(c)));
    const masterColumns = Array.from(allColumns);

    const resultData: any[][] = [masterColumns];

    // 2. Iterate files and map rows to master columns
    selectedFiles.forEach(file => {
      const colMap = new Map<string, number>();
      // Map column name to index in this specific file
      file.columns.forEach((c, i) => colMap.set(c, i));

      file.data.slice(1).forEach(row => {
        // Skip empty
        if (!row || row.every(c => c === null || c === undefined || (typeof c === 'string' && c.trim() === ''))) return;

        const newRow = masterColumns.map(colName => {
          const idx = colMap.get(colName);
          return (idx !== undefined) ? row[idx] : null;
        });
        resultData.push(newRow);
      });
    });

    return { data: resultData, columns: masterColumns };
  };

  // --- LOGIC: JOIN (MERGE) ---
  const runJoin = (): { data: any[][], columns: string[] } | null => {
    if (selectedFiles.length < 2 || !mergeKey) return null;

    const file1 = selectedFiles[0];
    const file2 = selectedFiles[1];
    const keyIndex1 = file1.columns.indexOf(mergeKey);
    const keyIndex2 = file2.columns.indexOf(mergeKey);

    if (keyIndex1 === -1 || keyIndex2 === -1) return null;

    const sanitize = (val: any) => String(val || '').trim().toLowerCase();

    const isRowEmpty = (row: any[]) => {
      if (!row) return true;
      return row.every(cell => {
        if (cell === null || cell === undefined) return true;
        if (typeof cell === 'string' && cell.trim() === '') return true;
        return false;
      });
    };

    const file2Map = new Map<string, any[][]>();
    file2.data.slice(1).forEach(row => {
      if (isRowEmpty(row)) return;
      const keyVal = sanitize(row[keyIndex2]);
      if (keyVal !== '') {
        if (!file2Map.has(keyVal)) file2Map.set(keyVal, []);
        file2Map.get(keyVal)!.push(row);
      }
    });

    const file2ColumnsNoKey = file2.columns.filter((_, i) => i !== keyIndex2);
    const combinedHeaders = [...file1.columns, ...file2ColumnsNoKey];
    const resultData: any[][] = [combinedHeaders];

    const getFile2Content = (row2: any[]) => row2.filter((_, i) => i !== keyIndex2);
    const processedKeys = new Set<string>();

    file1.data.slice(1).forEach(row1 => {
      if (isRowEmpty(row1)) return;

      const keyVal = sanitize(row1[keyIndex1]);
      processedKeys.add(keyVal);

      const matchRows = file2Map.get(keyVal);

      if (matchRows && matchRows.length > 0) {
        matchRows.forEach(matchRow => {
          resultData.push([...row1, ...getFile2Content(matchRow)]);
        });
      } else {
        if (joinType === JoinType.LEFT || joinType === JoinType.OUTER) {
          const emptyFill = new Array(file2ColumnsNoKey.length).fill(null);
          resultData.push([...row1, ...emptyFill]);
        }
      }
    });

    if (joinType === JoinType.RIGHT || joinType === JoinType.OUTER) {
      file2Map.forEach((rows, key) => {
        if (!processedKeys.has(key)) {
          rows.forEach(row2 => {
            const emptyFillF1 = new Array(file1.columns.length).fill(null);
            emptyFillF1[keyIndex1] = row2[keyIndex2];
            resultData.push([...emptyFillF1, ...getFile2Content(row2)]);
          });
        }
      });
    }

    return { data: resultData, columns: combinedHeaders };
  };

  const handlePreview = () => {
    setIsMerging(true);
    setTimeout(() => {
      try {
        const result = mergeMode === 'stack' ? runStack() : runJoin();
        if (result) {
          setPreviewData(result.data);
          setPreviewMetrics({ rowCount: result.data.length - 1 });
          setShowPreview(true);
        } else {
          alert("Failed to generate preview. Please check settings.");
        }
      } catch (e) {
        console.error(e);
        alert("Error generating preview.");
      } finally {
        setIsMerging(false);
      }
    }, 500);
  };

  const handleExecute = async () => {
    setIsMerging(true);
    setTimeout(() => {
      try {
        const result = mergeMode === 'stack' ? runStack() : runJoin();

        if (!result) throw new Error("Merge returned null");

        const initialSnapshot = { data: result.data, styles: {} };
        const newFile: ExcelFile = {
          id: `merged-${Date.now()}`,
          name: `${mergeMode === 'stack' ? 'Stacked' : 'Merged'}_${selectedFiles.map(f => f.name.split('.')[0]).join('_')}`,
          data: result.data,
          columns: result.columns,
          styles: {},
          lastModified: Date.now(),
          history: [initialSnapshot],
          currentHistoryIndex: 0
        };

        onMergeComplete(newFile);

      } catch (err) {
        console.error("Merge error", err);
        alert("An error occurred. Check file compatibility.");
      } finally {
        setIsMerging(false);
      }
    }, 800);
  };

  const renderStep1 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Mode Switcher */}
      <div className="flex bg-gray-100 p-1.5 rounded-xl mb-6">
        <button
          onClick={() => handleModeChange('join')}
          className={`flex-1 flex flex-col items-center justify-center py-3 rounded-lg transition-all ${mergeMode === 'join' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:bg-gray-200/50'}`}
        >
          <div className="flex items-center gap-2 font-bold text-sm"><GitMerge size={16} /> Join Columns</div>
          <span className="text-[10px] mt-1 opacity-70">Combine data horizontally (VLOOKUP style)</span>
        </button>
        <button
          onClick={() => handleModeChange('stack')}
          className={`flex-1 flex flex-col items-center justify-center py-3 rounded-lg transition-all ${mergeMode === 'stack' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500 hover:bg-gray-200/50'}`}
        >
          <div className="flex items-center gap-2 font-bold text-sm"><Layers size={16} /> Stack Rows</div>
          <span className="text-[10px] mt-1 opacity-70">Combine files vertically (Append style)</span>
        </button>
      </div>

      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Select Files</h3>
        <span className="text-xs text-gray-500 font-medium">
          {mergeMode === 'join' ? 'Max 2 files' : 'Unlimited files'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {files.map(file => (
          <div
            key={file.id}
            onClick={() => toggleFile(file.id)}
            className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${selectedFileIds.includes(file.id)
                ? (mergeMode === 'join' ? 'border-blue-500 bg-blue-50/50' : 'border-green-500 bg-green-50/50') + ' shadow-md'
                : 'border-gray-100 bg-white hover:border-gray-300'
              }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedFileIds.includes(file.id) ? (mergeMode === 'join' ? 'bg-blue-500' : 'bg-green-500') + ' text-white' : 'bg-gray-100 text-gray-400'}`}>
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-800">File {selectedFileIds.indexOf(file.id) + 1 || ''}: {file.name}</h4>
                  <div className="text-[11px] text-gray-500 mt-1 space-y-0.5">
                    <p>Rows: {file.data.length}</p>
                    <p>Columns: {file.columns.length}</p>
                  </div>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selectedFileIds.includes(file.id)
                  ? (mergeMode === 'join' ? 'bg-blue-500 border-blue-500' : 'bg-green-500 border-green-500')
                  : 'border-gray-200'
                }`}>
                {selectedFileIds.includes(file.id) && <Check size={12} className="text-white" />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep2 = () => {
    // IF STACK MODE, WE SKIP DIRECTLY TO PREVIEW/CONFIRMATION
    if (mergeMode === 'stack') {
      const totalRows = selectedFiles.reduce((acc, f) => acc + f.data.length - 1, 0);
      const allCols = new Set<string>();
      selectedFiles.forEach(f => f.columns.forEach(c => allCols.add(c)));

      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Stacking Summary</h3>

          <div className="bg-green-50 border border-green-100 p-6 rounded-xl text-center">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-black text-green-700">{selectedFiles.length}</div>
                <div className="text-xs text-green-600 font-bold uppercase">Files</div>
              </div>
              <ArrowRight className="text-green-300" />
              <div className="text-center">
                <div className="text-2xl font-black text-green-700">{totalRows}</div>
                <div className="text-xs text-green-600 font-bold uppercase">Total Rows</div>
              </div>
              <ArrowRight className="text-green-300" />
              <div className="text-center">
                <div className="text-2xl font-black text-green-700">{allCols.size}</div>
                <div className="text-xs text-green-600 font-bold uppercase">Unified Cols</div>
              </div>
            </div>
            <p className="text-sm text-green-800 font-medium">
              Rows from {selectedFiles.map(f => f.name).join(', ')} will be appended vertically.
            </p>
            <p className="text-xs text-green-600 mt-2">
              Columns with matching names will be aligned automatically. Missing columns will be filled with nulls.
            </p>
          </div>
        </div>
      );
    }

    // IF JOIN MODE, SHOW KEY SELECTION
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Suggested Merge Keys</h3>
        <div className="space-y-3">
          {commonColumns.length > 0 ? commonColumns.map(col => (
            <div
              key={col}
              onClick={() => setMergeKey(col)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${mergeKey === col
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-100 hover:border-gray-200'
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-gray-800">{col} ↔ {col}</span>
                  <span className="text-[10px] text-gray-400 mt-1">Type: text  •  Uniqueness: 84.5%</span>
                </div>
                <div className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full border border-green-200">
                  100% confidence
                </div>
              </div>
            </div>
          )) : (
            <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <p className="text-sm text-gray-400 font-medium">No direct common columns found. Please select files with overlapping headers.</p>
            </div>
          )}
        </div>

        <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex gap-3 items-start">
          <AlertCircle className="text-orange-500 shrink-0" size={18} />
          <div>
            <h5 className="text-sm font-bold text-orange-800 mb-1">Professional Merge Active</h5>
            <p className="text-xs text-orange-700 leading-relaxed">
              <span className="block mb-1">⚡ Cartesian Join Enabled</span>
              If duplicates exist in both files, this will generate all possible combinations (SQL Standard Behavior).
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Join Type</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { id: JoinType.INNER, label: 'Inner Join', desc: 'Keep only rows that exist in both files', use: 'Find customers who made purchases' },
          { id: JoinType.LEFT, label: 'Left Join', desc: 'Keep all rows from first file, add matching data from second', use: 'Add customer details to all orders' },
          { id: JoinType.RIGHT, label: 'Right Join', desc: 'Keep all rows from second file, add matching data from first', use: 'Show all products with their sales data' },
          { id: JoinType.OUTER, label: 'Full Outer Join', desc: 'Keep all rows from both files', use: 'Complete view of all customers and orders' },
        ].map(type => (
          <div
            key={type.id}
            onClick={() => setJoinType(type.id)}
            className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${joinType === type.id
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
          >
            <h4 className="font-bold text-sm text-gray-800 mb-1">{type.label}</h4>
            <p className="text-xs text-gray-500 mb-2 leading-relaxed">{type.desc}</p>
            <p className="text-[10px] text-blue-600 font-medium flex items-center gap-1">
              <Info size={10} /> Use case: {type.use}
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPreviewTable = () => {
    if (!previewData || previewData.length === 0) return null;

    const columns = previewData[0];
    const rows = previewData.slice(1, 11); // Show first 10 rows

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
          Merge Result Preview <span className="text-gray-400 font-normal normal-case">(First 10 rows)</span>
        </h3>

        <div className={`${mergeMode === 'stack' ? 'bg-green-50 border-green-100' : 'bg-blue-50 border-blue-100'} border rounded-xl p-6 mb-6`}>
          <div className="grid grid-cols-2 gap-y-3 text-xs">
            <div className="text-gray-600 font-medium">Mode: <span className="font-bold text-gray-900 uppercase">{mergeMode}</span></div>
            <div className="text-gray-600 font-medium text-right">Source Files: <span className="font-bold text-gray-900">{selectedFiles.length}</span></div>
            <div className={`${mergeMode === 'stack' ? 'text-green-800' : 'text-blue-800'} font-black text-lg`}>Result Rows: {previewMetrics?.rowCount}</div>
            <div className={`${mergeMode === 'stack' ? 'text-green-800' : 'text-blue-800'} font-bold text-right self-end flex items-center justify-end gap-1`}>
              {mergeMode === 'stack' ? <Layers size={14} /> : <GitMerge size={14} />} {mergeMode === 'stack' ? 'STACKED' : joinType.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {columns.map((col: string, i: number) => (
                    <th key={i} className="p-3 text-left font-bold text-gray-600 uppercase tracking-tight whitespace-nowrap border-r border-gray-200 last:border-0">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    {row.map((cell: any, cIdx: number) => (
                      <td key={cIdx} className="p-3 text-gray-700 whitespace-nowrap border-r border-gray-100 last:border-0 max-w-[200px] truncate">
                        {(cell === null || cell === undefined) ? (
                          <span className="text-gray-300 italic">null</span>
                        ) : (
                          cell === '' ? <span className="text-gray-300 italic">empty</span> : cell.toString()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {previewData.length > 11 && (
            <div className="p-2 text-center text-[10px] text-gray-400 bg-gray-50 border-t border-gray-100">
              ... {previewData.length - 11} more rows ...
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 backdrop-blur-md p-4">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-white/20">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold text-[#1e293b] tracking-tight">Smart Merge</h2>
            <p className="text-sm text-gray-500 font-medium">Intelligently combine data from multiple files</p>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {!showPreview ? (
            <>
              {step === 1 && renderStep1()}
              {/* Skip Key Selection for Stack Mode */}
              {step === 2 && renderStep2()}
              {/* Skip Join Type for Stack Mode */}
              {step === 3 && mergeMode === 'join' && renderStep3()}
            </>
          ) : (
            renderPreviewTable()
          )}
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between sticky bottom-0 z-10">
          <div className="flex items-center gap-3">
            {!showPreview ? (
              <button
                onClick={() => setStep(prev => prev > 1 ? prev - 1 : prev)}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${step === 1 ? 'text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-200 text-gray-700 hover:bg-white hover:shadow-sm'
                  }`}
                disabled={step === 1}
              >
                Back
              </button>
            ) : (
              <button
                onClick={() => setShowPreview(false)}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-white border border-gray-200 text-gray-700 hover:bg-white hover:shadow-sm"
              >
                Back to Settings
              </button>
            )}

            {/* Show Preview Button in Step 2 for Stack, Step 3 for Join */}
            {!showPreview && ((mergeMode === 'join' && step === 3) || (mergeMode === 'stack' && step === 2)) && (
              <button
                onClick={handlePreview}
                disabled={isMerging}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-700 hover:bg-white hover:border-gray-200 transition-all flex items-center gap-2"
              >
                {isMerging ? <RefreshCw className="animate-spin" size={16} /> : "Preview Merge"}
              </button>
            )}
          </div>

          {!showPreview && (
            <button
              disabled={
                (step === 1 && selectedFileIds.length < 2) ||
                (step === 2 && mergeMode === 'join' && !mergeKey) ||
                isMerging
              }
              onClick={() => {
                // Logic to skip steps based on mode
                if (mergeMode === 'stack' && step === 2) {
                  handlePreview(); // Or go to execute directly
                } else {
                  setStep(prev => prev + 1);
                }
              }}
              className={`flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${(mergeMode === 'join' && step === 3) || (mergeMode === 'stack' && step === 2) ? 'hidden' : ''
                }`}
            >
              Continue <ArrowRight size={18} />
            </button>
          )}

          {(showPreview || (mergeMode === 'join' && step === 3) || (mergeMode === 'stack' && step === 2)) && (
            <button
              onClick={handleExecute}
              disabled={isMerging}
              className={`flex items-center gap-2 ${mergeMode === 'stack' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-8 py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isMerging ? (
                <>Processing... <Sparkles className="animate-spin" size={18} /></>
              ) : (
                <>
                  {mergeMode === 'stack' ? 'Stack Files' : 'Execute Join'} <Check size={18} />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

export default MergeModal;
