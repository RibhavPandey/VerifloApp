import React, { useState, useMemo } from 'react';
import { X, GitMerge, FileText, Check, Layers, ChevronDown, ChevronUp, RefreshCw, AlertCircle } from 'lucide-react';
import { ExcelFile, JoinType } from '../types';

interface MergeModalProps {
  files: ExcelFile[];
  onClose: () => void;
  onMergeComplete: (newFile: ExcelFile) => void;
}

type MergeMode = 'join' | 'stack';

const MergeModal: React.FC<MergeModalProps> = ({ files, onClose, onMergeComplete }) => {
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [mergeMode, setMergeMode] = useState<MergeMode>('join');
  const [mergeKey, setMergeKey] = useState<string>('');
  const [joinType, setJoinType] = useState<JoinType>(JoinType.OUTER);
  const [isMerging, setIsMerging] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any[][] | null>(null);
  const [expandedSection, setExpandedSection] = useState<'files' | 'settings' | 'preview'>('files');

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
      if (prev.includes(id)) return prev.filter(fid => fid !== id);
      if (mergeMode === 'join' && prev.length >= 2) {
        return [prev[1], id];
      }
      return [...prev, id];
    });
    setShowPreview(false);
    setPreviewData(null);
  };

  const handleModeChange = (mode: MergeMode) => {
    setMergeMode(mode);
    if (mode === 'join' && selectedFileIds.length > 2) {
      setSelectedFileIds(selectedFileIds.slice(0, 2));
    }
    setShowPreview(false);
    setPreviewData(null);
    setMergeKey('');
  };

  // Stack logic
  const runStack = (): { data: any[][], columns: string[] } | null => {
    if (selectedFiles.length < 2) return null;
    const allColumns = new Set<string>();
    selectedFiles.forEach(f => f.columns.forEach(c => allColumns.add(c)));
    const masterColumns = Array.from(allColumns);
    const resultData: any[][] = [masterColumns];

    selectedFiles.forEach(file => {
      const colMap = new Map<string, number>();
      file.columns.forEach((c, i) => colMap.set(c, i));
      file.data.slice(1).forEach(row => {
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

  // Join logic
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
      return row.every(cell => cell === null || cell === undefined || (typeof cell === 'string' && cell.trim() === ''));
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
      } else if (joinType === JoinType.LEFT || joinType === JoinType.OUTER) {
        const emptyFill = new Array(file2ColumnsNoKey.length).fill(null);
        resultData.push([...row1, ...emptyFill]);
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
          setShowPreview(true);
          setExpandedSection('preview');
        } else {
          alert("Failed to generate preview. Please check settings.");
        }
      } catch (e) {
        console.error(e);
        alert("Error generating preview.");
      } finally {
        setIsMerging(false);
      }
    }, 300);
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
    }, 500);
  };

  const canPreview = selectedFileIds.length >= 2 && (mergeMode === 'stack' || mergeKey);
  const canExecute = canPreview;

  const totalRows = selectedFiles.reduce((acc, f) => acc + f.data.length - 1, 0);
  const allColsCount = new Set(selectedFiles.flatMap(f => f.columns)).size;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/20 dark:bg-black/40 backdrop-blur-[2px] md:absolute">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />
      
      {/* Panel */}
      <div className="relative w-full md:w-[58%] md:min-w-[500px] md:max-w-[900px] h-full bg-background shadow-2xl border-l border-border flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="px-4 md:px-6 py-4 border-b border-border flex items-center justify-between bg-background">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <GitMerge size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base md:text-lg font-bold text-foreground truncate">Smart Merge</h2>
              <p className="text-xs text-muted-foreground hidden md:block">Combine data from multiple files</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="px-4 md:px-6 py-3 border-b border-border bg-muted/50">
          <div className="flex bg-muted/50 border border-border rounded-lg p-1 w-full md:w-fit">
            <button
              onClick={() => handleModeChange('join')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-3 md:py-2 rounded-md text-sm font-medium transition-all min-h-[44px] md:min-h-0 ${
                mergeMode === 'join' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              <GitMerge size={14} />
              <span className="hidden sm:inline">Join Columns</span>
              <span className="sm:hidden">Join</span>
            </button>
            <button
              onClick={() => handleModeChange('stack')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-3 md:py-2 rounded-md text-sm font-medium transition-all min-h-[44px] md:min-h-0 ${
                mergeMode === 'stack' 
                  ? 'bg-green-600 text-white shadow-sm' 
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              <Layers size={14} />
              <span className="hidden sm:inline">Stack Rows</span>
              <span className="sm:hidden">Stack</span>
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 hidden md:block">
            {mergeMode === 'join' 
              ? 'Combine columns horizontally using a common key (like VLOOKUP)' 
              : 'Append rows vertically from multiple files'}
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          
          {/* Files Section */}
          <div className="border-b border-border">
            <button 
              onClick={() => setExpandedSection(expandedSection === 'files' ? 'settings' : 'files')}
              className="w-full px-4 md:px-6 py-3 flex items-center justify-between hover:bg-muted transition-colors min-h-[44px]"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">1. Select Files</span>
                {selectedFileIds.length >= 2 && (
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-700 dark:text-green-400 text-[10px] font-bold rounded-full">
                    {selectedFileIds.length} selected
                  </span>
                )}
              </div>
              {expandedSection === 'files' ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </button>
            
            {expandedSection === 'files' && (
              <div className="px-4 md:px-6 pb-4 space-y-2">
                <p className="text-xs text-muted-foreground mb-3">
                  {mergeMode === 'join' ? 'Select exactly 2 files to join' : 'Select 2 or more files to stack'}
                </p>
                {files.map(file => (
                  <label
                    key={file.id}
                    className={`flex items-center gap-3 p-3 md:p-3 rounded-lg border cursor-pointer transition-all min-h-[64px] md:min-h-0 ${
                      selectedFileIds.includes(file.id)
                        ? mergeMode === 'join' 
                          ? 'border-blue-500/50 bg-blue-500/10 dark:bg-blue-500/20' 
                          : 'border-green-500/50 bg-green-500/10 dark:bg-green-500/20'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFileIds.includes(file.id)}
                      onChange={() => toggleFile(file.id)}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedFileIds.includes(file.id)
                        ? mergeMode === 'join' ? 'bg-blue-600 border-blue-600' : 'bg-green-600 border-green-600'
                        : 'border-border'
                    }`}>
                      {selectedFileIds.includes(file.id) && <Check size={12} className="text-white" />}
                    </div>
                    <FileText size={16} className="text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{file.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {file.data.length - 1} rows · {file.columns.length} columns
                      </div>
                    </div>
                    {selectedFileIds.includes(file.id) && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        mergeMode === 'join' ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300' : 'bg-green-500/20 text-green-700 dark:text-green-300'
                      }`}>
                        #{selectedFileIds.indexOf(file.id) + 1}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Settings Section */}
          <div className="border-b border-border">
            <button 
              onClick={() => setExpandedSection(expandedSection === 'settings' ? 'files' : 'settings')}
              className="w-full px-4 md:px-6 py-3 flex items-center justify-between hover:bg-muted transition-colors min-h-[44px]"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">2. Configure</span>
                {mergeMode === 'join' && mergeKey && (
                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded-full">
                    Key: {mergeKey}
                  </span>
                )}
              </div>
              {expandedSection === 'settings' ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </button>

            {expandedSection === 'settings' && (
              <div className="px-4 md:px-6 pb-4">
                {mergeMode === 'stack' ? (
                  // Stack Summary
                  <div className="bg-green-500/10 dark:bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-6 text-sm text-foreground">
                      <div>
                        <span className="text-green-600 dark:text-green-400">Files:</span>
                        <span className="font-bold ml-1">{selectedFiles.length}</span>
                      </div>
                      <div>
                        <span className="text-green-600 dark:text-green-400">Total Rows:</span>
                        <span className="font-bold ml-1">{totalRows}</span>
                      </div>
                      <div>
                        <span className="text-green-600 dark:text-green-400">Columns:</span>
                        <span className="font-bold ml-1">{allColsCount}</span>
                      </div>
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                      Columns will be aligned by name. Missing values filled with null.
                    </p>
                  </div>
                ) : (
                  // Join Settings
                  <div className="space-y-4">
                    {/* Merge Key */}
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-2">Merge Key (common column)</label>
                      {commonColumns.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {commonColumns.map(col => (
                            <button
                              key={col}
                              onClick={() => setMergeKey(col)}
                              className={`px-3 py-2.5 md:py-1.5 rounded-lg text-sm font-medium border transition-all min-h-[44px] md:min-h-0 ${
                                mergeKey === col
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-background text-foreground border-border hover:border-blue-500/50'
                              }`}
                            >
                              {col}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground italic">
                          {selectedFiles.length < 2 
                            ? 'Select 2 files to see common columns' 
                            : 'No common columns found between selected files'}
                        </div>
                      )}
                    </div>

                    {/* Join Type */}
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-2">Join Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: JoinType.INNER, label: 'Inner', desc: 'Only matching rows' },
                          { id: JoinType.LEFT, label: 'Left', desc: 'All from first file' },
                          { id: JoinType.RIGHT, label: 'Right', desc: 'All from second file' },
                          { id: JoinType.OUTER, label: 'Full Outer', desc: 'All rows from both' },
                        ].map(type => (
                          <button
                            key={type.id}
                            onClick={() => setJoinType(type.id)}
                            className={`p-3 md:p-3 rounded-lg border text-left transition-all min-h-[64px] md:min-h-0 ${
                              joinType === type.id
                                ? 'border-blue-500/50 bg-blue-500/10 dark:bg-blue-500/20'
                                : 'border-border hover:bg-muted'
                            }`}
                          >
                            <div className="text-sm font-medium text-foreground">{type.label}</div>
                            <div className="text-[10px] text-muted-foreground">{type.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {mergeKey && (
                      <div className="flex items-start gap-2 p-3 bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 rounded-lg">
                        <AlertCircle size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Duplicate keys will create multiple rows (Cartesian product).
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Preview Section */}
          {showPreview && previewData && (
            <div className="border-b border-border">
              <button 
                onClick={() => setExpandedSection(expandedSection === 'preview' ? 'settings' : 'preview')}
                className="w-full px-4 md:px-6 py-3 flex items-center justify-between hover:bg-muted transition-colors min-h-[44px]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">3. Preview</span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    mergeMode === 'stack' ? 'bg-green-500/20 text-green-700 dark:text-green-300' : 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                  }`}>
                    {previewData.length - 1} rows
                  </span>
                </div>
                {expandedSection === 'preview' ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
              </button>

              {expandedSection === 'preview' && (
                <div className="px-4 md:px-6 pb-4">
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto touch-pan-x touch-pan-y">
                      <table className="w-full text-xs">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            {previewData[0].map((col: string, i: number) => (
                              <th key={i} className="px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap border-b border-border">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {previewData.slice(1, 21).map((row, idx) => (
                            <tr key={idx} className="hover:bg-muted/50">
                              {row.map((cell: any, cIdx: number) => (
                                <td key={cIdx} className="px-3 py-2 text-foreground whitespace-nowrap max-w-[180px] truncate">
                                  {cell === null || cell === undefined ? (
                                    <span className="text-muted-foreground italic">null</span>
                                  ) : cell === '' ? (
                                    <span className="text-muted-foreground italic">empty</span>
                                  ) : (
                                    String(cell)
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {previewData.length > 21 && (
                      <div className="px-3 py-2 text-center text-[10px] text-muted-foreground bg-muted border-t border-border">
                        Showing first 20 of {previewData.length - 1} rows
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 md:px-6 py-4 border-t border-border bg-muted/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-3 md:py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors min-h-[44px] md:min-h-0"
          >
            Cancel
          </button>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {!showPreview && (
              <button
                onClick={handlePreview}
                disabled={!canPreview || isMerging}
                className="px-4 py-3 md:py-2 text-sm font-medium text-foreground bg-background border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 min-h-[44px] md:min-h-0"
              >
                {isMerging ? <RefreshCw size={14} className="animate-spin" /> : null}
                Preview
              </button>
            )}
            <button
              onClick={handleExecute}
              disabled={!canExecute || isMerging}
              className={`px-5 py-3 md:py-2 text-sm font-bold text-white rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 min-h-[44px] md:min-h-0 ${
                mergeMode === 'stack' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isMerging ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {mergeMode === 'stack' ? <Layers size={14} /> : <GitMerge size={14} />}
                  <span className="hidden sm:inline">{mergeMode === 'stack' ? 'Stack Files' : 'Execute Join'}</span>
                  <span className="sm:hidden">{mergeMode === 'stack' ? 'Stack' : 'Join'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MergeModal;
