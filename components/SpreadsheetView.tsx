
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import {
  Bold, Italic, Underline, Check, X, 
  Scissors, CaseUpper, CaseLower, CaseSensitive, CopyMinus, Undo, Redo,
  Globe, Loader2, ChevronLeft, ChevronRight
} from 'lucide-react';
import { ExcelFile, CellStyle, AutomationStep, Job, FileSnapshot, ChatMessage } from '../types';
import { HyperFormula } from 'hyperformula';
import { useToast } from './ui/toast';
import { db } from '../lib/db';
import { api } from '../lib/api';
import Sidebar from './Sidebar';
import { WorkspaceContextType } from './Workspace';

const ROW_HEIGHT = 24;
const DEFAULT_COL_WIDTH = 100;
const HEADER_COL_WIDTH = 40;
const HEADER_ROW_HEIGHT = 24;
const BUFFER_ROWS = 10;
const BUFFER_COLS = 5;

// Utilities
const getColumnLabel = (index: number): string => {
  let label = '';
  let n = index;
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
};

const SpreadsheetView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  // We extract 'files' from context so we can pass ALL files to Sidebar for multi-file analysis
  const { credits, handleUseCredit, handleRecordAction, files: allFiles } = useOutletContext<WorkspaceContextType>();
  const { addToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [file, setFile] = useState<ExcelFile | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Load Data
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const fetchSheet = async () => {
        try {
            const jobData = await db.getJob(id);
            if (jobData && jobData.fileIds.length > 0) {
                setJob(jobData);
                setChatHistory(jobData.chatHistory || []);
                const fileData = await db.getFile(jobData.fileIds[0]);
                setFile(fileData);
            }
        } catch (e) {
            console.error("Error loading sheet:", e);
            addToast('error', 'Error', 'Failed to load sheet.');
        } finally {
            setLoading(false);
        }
    };
    fetchSheet();
  }, [id, addToast]);

  // Persist Chat
  const handleUpdateChatHistory = (update: React.SetStateAction<ChatMessage[]>) => {
      setChatHistory(prev => {
          const newValue = typeof update === 'function' ? update(prev) : update;
          if (job) {
             const updatedJob = { ...job, chatHistory: newValue };
             setJob(updatedJob);
             db.upsertJob(updatedJob).catch(console.error);
          }
          return newValue;
      });
  };

  const handleFileChange = (changes: Partial<ExcelFile>) => {
      if (!file) return;

      const updatedFile = { ...file, ...changes, lastModified: Date.now() };
      
      // Manage History Stack
      const newSnapshot: FileSnapshot = { 
          data: updatedFile.data, 
          styles: updatedFile.styles 
      };
      
      const historyPast = file.history.slice(0, file.currentHistoryIndex + 1);
      const newHistory = [...historyPast, newSnapshot];
      
      if (newHistory.length > 30) newHistory.shift();

      updatedFile.history = newHistory;
      updatedFile.currentHistoryIndex = newHistory.length - 1;

      setFile(updatedFile);
      db.upsertFile(updatedFile).catch(console.error);
  };

  const onUndo = () => {
      if (!file || file.currentHistoryIndex <= 0) return;
      const newIndex = file.currentHistoryIndex - 1;
      const snapshot = file.history[newIndex];
      const updatedFile = {
          ...file,
          data: snapshot.data,
          styles: snapshot.styles,
          currentHistoryIndex: newIndex,
          lastModified: Date.now()
      };
      setFile(updatedFile);
      db.upsertFile(updatedFile).catch(console.error);
  };

  const onRedo = () => {
      if (!file || file.currentHistoryIndex >= file.history.length - 1) return;
      const newIndex = file.currentHistoryIndex + 1;
      const snapshot = file.history[newIndex];
      const updatedFile = {
          ...file,
          data: snapshot.data,
          styles: snapshot.styles,
          currentHistoryIndex: newIndex,
          lastModified: Date.now()
      };
      setFile(updatedFile);
      db.upsertFile(updatedFile).catch(console.error);
  };

  // --- EDITOR STATE ---
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollPos, setScrollPos] = useState({ top: 0, left: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const resizingRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);
  const [activeCell, setActiveCell] = useState<{ r: number, c: number } | null>({ r: 0, c: 0 });
  const [selection, setSelection] = useState<{ start: { r: number, c: number }, end: { r: number, c: number } } | null>({ start: {r:0,c:0}, end: {r:0,c:0} });
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [enrichmentPrompt, setEnrichmentPrompt] = useState<string | null>(null);
  const [enrichmentTargetCol, setEnrichmentTargetCol] = useState<number | null>(null);

  // HyperFormula
  const hfInstance = useRef<HyperFormula | null>(null);
  const [hfReady, setHfReady] = useState(false);

  useEffect(() => {
      if (!file) return;
      const initTimer = setTimeout(() => {
          const config = { licenseKey: 'gpl-v3' };
          try {
              hfInstance.current = HyperFormula.buildFromSheets({ Sheet1: file.data }, config);
              setHfReady(true);
          } catch (e) {
              console.warn("HF Init Error", e);
          }
      }, 50);
      return () => clearTimeout(initTimer);
  }, [file?.id, file?.data]);

  // Derived Grid Props
  const colCount = file ? Math.max(26, (file.data[0]?.length || 0) + 20) : 26;
  const rowCount = file ? Math.max(100, file.data.length + 50) : 100;

  const colPositions = useMemo(() => {
    const positions = [0];
    let current = 0;
    for (let i = 0; i < colCount; i++) {
      current += colWidths[i] || DEFAULT_COL_WIDTH;
      positions.push(current);
    }
    return positions;
  }, [colWidths, colCount]);

  const getColWidth = (index: number) => colWidths[index] || DEFAULT_COL_WIDTH;
  const getColLeft = (index: number) => colPositions[index] || 0;

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setViewportSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    const handleScroll = () => {
      if (containerRef.current) {
        setScrollPos({
          top: containerRef.current.scrollTop,
          left: containerRef.current.scrollLeft
        });
      }
    };
    window.addEventListener('resize', handleResize);
    containerRef.current?.addEventListener('scroll', handleScroll);
    handleResize();
    handleScroll();
    return () => {
      window.removeEventListener('resize', handleResize);
      containerRef.current?.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (activeCell && file) {
      const val = file.data[activeCell.r]?.[activeCell.c];
      if (val instanceof Date) setEditValue(val.toLocaleDateString());
      else setEditValue(val !== undefined ? String(val) : '');
    }
  }, [activeCell, file]);

  const getDisplayValue = (r: number, c: number, rawVal: any) => {
      if (typeof rawVal === 'string' && rawVal.startsWith('=')) {
          if (hfReady && hfInstance.current) {
              try {
                  const sheetNames = hfInstance.current.getSheetNames();
                  if (sheetNames.length > 0) {
                      const sheetId = hfInstance.current.getSheetId(sheetNames[0]);
                      if (sheetId !== undefined) {
                          const val = hfInstance.current.getCellValue({ sheet: sheetId, row: r, col: c });
                          if (val instanceof Error || (typeof val === 'object' && val?.type === 'ERROR')) return '#ERROR';
                          return val;
                      }
                  }
              } catch (e) { return '#ERROR'; }
          }
          return rawVal; 
      }
      return rawVal;
  };

  if (loading || !file) {
      return <div className="flex-1 flex items-center justify-center h-full"><Loader2 className="animate-spin text-blue-600" /></div>;
  }

  // --- Handlers (Simplified for brevity as logic is same as before) ---
  const handleSelectAll = () => {
      setSelection({ start: { r: 0, c: 0 }, end: { r: file.data.length-1, c: file.columns.length-1 } });
      setActiveCell({ r: 0, c: 0 });
  };
  
  const handleEnrichment = async () => {
    if (enrichmentTargetCol === null || !enrichmentPrompt) return;
    if (credits < 25) { addToast('error', 'Insufficient Credits', 'Requires 25 credits.'); return; }

    setIsProcessingAI(true);
    try {
        const colIdx = enrichmentTargetCol;
        const sourceData = file.data.slice(1).map(r => r[colIdx]).filter(v => v);
        const uniqueItems = Array.from(new Set(sourceData)).slice(0, 20); 

        const response = await api.enrich(uniqueItems, enrichmentPrompt);
        const result = response.result;
      const newData = [...file.data];
      const emptyColIdx = file.data[0].length;
      newData[0][emptyColIdx] = "Enriched Info";

        for(let r=1; r < newData.length; r++) {
        const key = newData[r][colIdx];
            if (key && result[key]) newData[r][emptyColIdx] = typeof result[key] === 'object' ? JSON.stringify(result[key]) : result[key];
        }

        handleFileChange({ data: newData });
        handleRecordAction('enrich', `Enriched ${getColumnLabel(colIdx)}`, { prompt: enrichmentPrompt });
        handleUseCredit(25);
    } catch (e) { addToast('error', 'Enrichment Failed', ''); } 
    finally { setIsProcessingAI(false); setEnrichmentPrompt(null); }
  };

  const handleMouseDown = (r: number, c: number, e: React.MouseEvent) => {
    if (isEditing && activeCell?.r === r && activeCell?.c === c) return;
    e.preventDefault();
    if (isEditing) commitEdit();
    if (e.shiftKey && activeCell) setSelection({ start: activeCell, end: { r, c } });
    else { setActiveCell({ r, c }); setSelection({ start: { r, c }, end: { r, c } }); }
    setIsDragging(true);
  };

  const commitEdit = () => {
    if (activeCell && isEditing) {
      const newData = [...file.data];
      if (!newData[activeCell.r]) newData[activeCell.r] = [];
      let valToSave: any = editValue;
      if (!isNaN(parseFloat(editValue)) && isFinite(Number(editValue)) && !editValue.startsWith('0')) valToSave = Number(editValue);
      if (editValue.startsWith('=')) valToSave = editValue;
      newData[activeCell.r][activeCell.c] = valToSave;
      handleFileChange({ data: newData });
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing) {
          if (e.key === 'Enter') { e.preventDefault(); commitEdit(); setActiveCell(p => p ? { ...p, r: p.r + 1 } : null); }
      return;
      }
    if (e.key === 'Backspace' || e.key === 'Delete') {
          const newData = file.data.map(r => [...(r || [])]);
          if (activeCell && newData[activeCell.r]) newData[activeCell.r][activeCell.c] = '';
          handleFileChange({ data: newData });
      }
      if (e.key.length === 1 && !e.ctrlKey) { setIsEditing(true); setEditValue(e.key); }
  };

  const startRow = Math.max(0, Math.floor(scrollPos.top / ROW_HEIGHT) - BUFFER_ROWS);
  const endRow = Math.min(rowCount, Math.ceil((scrollPos.top + viewportSize.height) / ROW_HEIGHT) + BUFFER_ROWS);
  let startCol = 0; while(startCol < colCount && getColLeft(startCol + 1) < scrollPos.left) startCol++;
  startCol = Math.max(0, startCol - BUFFER_COLS);
  let endCol = startCol; while(endCol < colCount && getColLeft(endCol) < scrollPos.left + viewportSize.width) endCol++;
  endCol = Math.min(colCount, endCol + BUFFER_COLS);

  return (
    <div className="flex h-full overflow-hidden">
        {/* MAIN EDITOR AREA */}
        <div className="flex-1 flex flex-col h-full bg-white text-sm min-w-0" onMouseUp={() => setIsDragging(false)}>
      <div className="flex items-center gap-2 p-2 border-b border-gray-200 bg-[#f8f9fa]">
        <div className="flex bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
                    <button onClick={onUndo} disabled={file.currentHistoryIndex <= 0} className="p-1.5 hover:bg-gray-100 disabled:opacity-40"><Undo size={16} /></button>
                    <button onClick={onRedo} disabled={file.currentHistoryIndex >= file.history.length - 1} className="p-1.5 hover:bg-gray-100 disabled:opacity-40"><Redo size={16} /></button>
          </div>
          <div className="w-px h-6 bg-gray-300 mx-1" />
        <div className="flex-1 flex items-center gap-2">
          <div className="text-gray-400 italic font-serif select-none px-1">fx</div>
          <input
            type="text"
            className="flex-1 bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
            value={editValue}
                    onChange={(e) => { setEditValue(e.target.value); if(activeCell) setIsEditing(true); }}
                    onBlur={commitEdit}
                    onKeyDown={(e) => { if(e.key==='Enter') commitEdit(); }}
                    />
                </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <div
          ref={containerRef}
                className="w-full h-full overflow-auto bg-gray-100 relative focus:outline-none"
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
                <div style={{ width: HEADER_COL_WIDTH + getColLeft(colCount), height: HEADER_ROW_HEIGHT + rowCount * ROW_HEIGHT, position: 'relative' }}>
                    
                    {/* Headers */}
                    <div className="sticky top-0 z-40 flex h-[24px] bg-[#f8f9fa] shadow-[0_1px_0_#e2e8f0]" style={{ width: HEADER_COL_WIDTH + getColLeft(colCount) }}>
                        <div onClick={handleSelectAll} className="sticky left-0 z-50 bg-[#f8f9fa] border-r border-gray-300 border-b w-[40px] flex-shrink-0 flex items-center justify-center text-xs font-bold text-blue-600 cursor-pointer">
                            {activeCell ? `${getColumnLabel(activeCell.c)}${activeCell.r + 1}` : ''}
                        </div>
              <div className="relative flex-1">
                {Array.from({ length: endCol - startCol + 1 }).map((_, i) => {
                  const c = startCol + i;
                                if (c >= colCount) return null;
                  return (
                                    <div key={c} className="absolute top-0 border-r border-gray-300 border-b flex items-center justify-center text-xs font-semibold text-gray-500 bg-[#f8f9fa]" style={{ left: getColLeft(c), width: getColWidth(c), height: HEADER_ROW_HEIGHT }}>
                      {getColumnLabel(c)}
                    </div>
                  );
                })}
              </div>
            </div>

                    {/* Row Numbers */}
                    <div className="sticky left-0 z-40 w-[40px] bg-[#f8f9fa] border-r border-gray-300" style={{ height: rowCount * ROW_HEIGHT }}>
                {Array.from({ length: endRow - startRow + 1 }).map((_, i) => {
                  const r = startRow + i;
                            if (r >= rowCount) return null;
                  return (
                                <div key={r} className="absolute left-0 border-b border-gray-300 flex items-center justify-center text-xs font-semibold text-gray-500 bg-[#f8f9fa]" style={{ top: r * ROW_HEIGHT, width: HEADER_COL_WIDTH, height: ROW_HEIGHT }}>
                      {r + 1}
                    </div>
                  );
                })}
              </div>

                    {/* Cells */}
              <div className="absolute top-0 left-[40px]">
                {Array.from({ length: endRow - startRow + 1 }).map((_, i) => {
                  const r = startRow + i;
                            if (r >= rowCount) return null;
                  return Array.from({ length: endCol - startCol + 1 }).map((__, j) => {
                    const c = startCol + j;
                                if (c >= colCount) return null;
                    const cellValue = file.data[r]?.[c];
                                const displayVal = getDisplayValue(r, c, cellValue);
                    const styles = file.styles[`${r},${c}`] || {};
                    return (
                      <div
                        key={`${r}-${c}`}
                        className="absolute border-r border-b border-gray-200 bg-white overflow-hidden px-1 whitespace-nowrap flex items-center cursor-cell select-none"
                        style={{
                          top: r * ROW_HEIGHT,
                          left: getColLeft(c),
                          width: getColWidth(c),
                          height: ROW_HEIGHT,
                          fontWeight: styles.bold ? 'bold' : 'normal',
                          fontStyle: styles.italic ? 'italic' : 'normal',
                          textDecoration: styles.underline ? 'underline' : 'none',
                          justifyContent: styles.align === 'center' ? 'center' : styles.align === 'right' ? 'flex-end' : 'flex-start',
                          color: styles.color,
                          backgroundColor: styles.bg,
                        }}
                        onMouseDown={(e) => handleMouseDown(r, c, e)}
                      >
                        {isEditing && activeCell?.r === r && activeCell?.c === c ? '' : displayVal}
                      </div>
                    );
                  });
                })}
              </div>

                    {/* Selection Overlay */}
                    {activeCell && (
              <div
                className="absolute border-2 border-blue-600 z-30 pointer-events-none"
                            style={{
                                top: activeCell.r * ROW_HEIGHT,
                                left: HEADER_COL_WIDTH + getColLeft(activeCell.c),
                                width: getColWidth(activeCell.c),
                                height: ROW_HEIGHT,
                            }}
                        />
                    )}
              {isEditing && activeCell && (
                <input
                  className="absolute z-50 px-1 text-sm border-2 border-blue-600 outline-none shadow-lg"
                  style={{
                    top: activeCell.r * ROW_HEIGHT,
                    left: HEADER_COL_WIDTH + getColLeft(activeCell.c),
                    width: getColWidth(activeCell.c),
                    height: ROW_HEIGHT,
                    font: 'inherit'
                  }}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  autoFocus
                />
              )}
          </div>
        </div>
      </div>

      {isProcessingAI && (
        <div className="absolute inset-0 z-[60] bg-white/50 backdrop-blur-sm flex items-center justify-center">
                    <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      )}

      {enrichmentTargetCol !== null && enrichmentPrompt !== null && !isProcessingAI && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
              <Globe className="text-blue-500" /> Enrich Data
            </h3>
            <textarea
                            className="w-full border border-gray-300 rounded-lg p-3 text-sm mb-4"
              rows={3}
                            placeholder="e.g. Find the CEO"
              autoFocus
              value={enrichmentPrompt || ''}
              onChange={(e) => setEnrichmentPrompt(e.target.value)}
            />
            <div className="flex justify-end gap-2">
                            <button onClick={() => { setEnrichmentTargetCol(null); setEnrichmentPrompt(null); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button onClick={handleEnrichment} disabled={!enrichmentPrompt} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Run</button>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* SIDEBAR */}
        <div className={`relative flex-shrink-0 h-full border-l border-gray-200 bg-white z-10 transition-all duration-300 ease-in-out`} style={{ width: isSidebarOpen ? '400px' : '0px' }}>
            <div className="absolute -left-3 bottom-8 z-50">
              <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="w-6 h-12 bg-white border border-gray-200 rounded-l-lg flex items-center justify-center shadow-md hover:bg-gray-50 text-gray-500"
                >
                    {isSidebarOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
            </div>
            <div className="w-[400px] h-full overflow-hidden">
                <Sidebar 
                    activeFile={file}
                    files={allFiles} 
                    history={chatHistory}
                    onUpdateHistory={handleUpdateChatHistory}
                    onPinToDashboard={() => {}}
                    credits={credits}
                    onUseCredit={handleUseCredit} 
                />
          </div>
        </div>
    </div>
  );
};

export default SpreadsheetView;
