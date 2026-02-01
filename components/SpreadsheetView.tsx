
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import {
  Bold, Italic, Underline, Check, X, 
  Scissors, CaseUpper, CaseLower, CaseSensitive, CopyMinus, Undo, Redo,
  Globe, Loader2, ChevronLeft, ChevronRight, Download, ChevronDown, FileText,
  Wand2, Sparkles, Filter
} from 'lucide-react';
import { ExcelFile, CellStyle, AutomationStep, Job, FileSnapshot, ChatMessage } from '../types';
import { HyperFormula } from 'hyperformula';
import { useToast } from './ui/toast';
import { db } from '../lib/db';
import { api } from '../lib/api';
import Sidebar from './Sidebar';
import { WorkspaceContextType } from './Workspace';
import ExcelJS from 'exceljs';
import { validateSpreadsheetData, validateFormula, normalizeData } from '../lib/spreadsheet-validation';
import { trackEvent } from '../lib/analytics';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { cn } from '../lib/utils';

const ROW_HEIGHT = 24;
const DEFAULT_COL_WIDTH = 100;
const HEADER_COL_WIDTH = 40;
const HEADER_ROW_HEIGHT = 24;
const BUFFER_ROWS = 10;
const BUFFER_COLS = 5;

// ERP Export Templates
interface ERPTemplate {
  id: string;
  name: string;
  requiredColumns: string[];
  columnMapping: Record<string, string[]>; // ERP column -> possible source column names
  formatters?: Record<string, (val: any) => any>;
}

const ERP_TEMPLATES: ERPTemplate[] = [
  {
    id: 'generic',
    name: 'Generic CSV/Excel',
    requiredColumns: [],
    columnMapping: {},
  },
  {
    id: 'tally',
    name: 'Tally Import',
    requiredColumns: ['Date', 'Vendor Name', 'Invoice Number', 'Total Amount'],
    columnMapping: {
      'Date': ['Date', 'Invoice Date', 'Transaction Date', 'date'],
      'Vendor Name': ['Vendor Name', 'Vendor', 'Supplier', 'Party Name', 'vendor', 'supplier'],
      'Invoice Number': ['Invoice Number', 'Invoice No', 'Bill No', 'invoice_number', 'invoice'],
      'Total Amount': ['Total Amount', 'Total', 'Amount', 'Grand Total', 'total', 'amount'],
      'Tax Amount': ['Tax Amount', 'Tax', 'GST', 'VAT', 'tax'],
      'Reference': ['PO Number', 'PO', 'Reference', 'Ref', 'po_number'],
    },
  },
  {
    id: 'zoho',
    name: 'Zoho Books',
    requiredColumns: ['Date', 'Vendor Name', 'Invoice Number', 'Total'],
    columnMapping: {
      'Date': ['Date', 'Invoice Date', 'Transaction Date', 'date'],
      'Vendor Name': ['Vendor Name', 'Vendor', 'Supplier', 'vendor'],
      'Invoice Number': ['Invoice Number', 'Invoice No', 'invoice_number', 'invoice'],
      'Total': ['Total Amount', 'Total', 'Amount', 'total', 'amount'],
      'Tax': ['Tax Amount', 'Tax', 'GST', 'tax'],
      'Currency': ['Currency', 'currency'],
      'Notes': ['Notes', 'Description', 'notes'],
    },
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    requiredColumns: ['*Vendor', '*InvoiceDate', '*DueDate', '*Total'],
    columnMapping: {
      '*Vendor': ['Vendor Name', 'Vendor', 'Supplier', 'vendor'],
      '*InvoiceDate': ['Date', 'Invoice Date', 'date'],
      '*DueDate': ['Due Date', 'Payment Due', 'due_date'],
      '*Total': ['Total Amount', 'Total', 'Amount', 'total'],
      'RefNumber': ['Invoice Number', 'Invoice No', 'Reference', 'invoice_number'],
      'Memo': ['Notes', 'Description', 'Memo', 'notes'],
      'TaxAmount': ['Tax Amount', 'Tax', 'tax'],
    },
  },
];

const FILTER_OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'contains', label: 'contains' },
  { value: 'greater', label: 'greater than' },
  { value: 'less', label: 'less than' },
  { value: 'not_empty', label: 'is not empty' },
  { value: 'empty', label: 'is empty' },
] as const;

const FilterStepModal: React.FC<{
  columns: string[];
  onApply: (colIndex: number, operator: string, value: string) => void;
  onClose: () => void;
}> = ({ columns, onApply, onClose }) => {
  const [colIndex, setColIndex] = useState(0);
  const [operator, setOperator] = useState('equals');
  const [value, setValue] = useState('');
  const needsValue = operator !== 'not_empty' && operator !== 'empty';
  return (
    <div className="fixed inset-0 z-[250] bg-black/40 flex items-center justify-center backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Filter className="text-purple-500" /> Filter Rows
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Column</label>
            <select
              value={colIndex}
              onChange={(e) => setColIndex(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {columns.map((col, i) => (
                <option key={i} value={i}>{col || `Column ${i + 1}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Condition</label>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {FILTER_OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
          </div>
          {needsValue && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Value</label>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter value..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
          <button
            onClick={() => onApply(colIndex, operator, value)}
            disabled={needsValue && !value.trim()}
            className="px-4 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            Apply Filter
          </button>
        </div>
      </div>
    </div>
  );
};

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
  const { credits, handleUseCredit, handleRecordAction, files: allFiles, isRecording } = useOutletContext<WorkspaceContextType>();
  const { addToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [file, setFile] = useState<ExcelFile | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Debounced DB save (reduces frequent writes while keeping UI instant)
  const saveTimerRef = useRef<number | null>(null);
  const scheduleFileSave = (nextFile: ExcelFile) => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
          db.upsertFile(nextFile).catch((e) => {
              console.error("Failed to save file", e);
              addToast('error', 'Save Failed', 'Could not save your latest changes. Please try again.');
          });
      }, 500);
  };
  useEffect(() => {
      trackEvent('page_view', { page: 'spreadsheet', jobId: id });
      return () => {
          if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      };
  }, []);

  // Load Data
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const fetchSheet = async () => {
        try {
            const jobData = await db.getJob(id);
            if (!jobData) {
                addToast('error', 'Error', 'Sheet not found.');
                return;
            }
            if (jobData.fileIds.length === 0) {
                addToast('error', 'Error', 'Sheet has no file data.');
                return;
            }
            setJob(jobData);
            setChatHistory(jobData.chatHistory || []);
            const fileData = await db.getFile(jobData.fileIds[0]);
            if (!fileData) {
                addToast('error', 'Error', 'File data not found.');
                return;
            }
            // Validate loaded file data
            if (fileData && fileData.data) {
              const validation = validateSpreadsheetData(fileData.data);
              if (!validation.valid) {
                addToast('error', 'Data Validation Error', validation.error || 'Invalid spreadsheet data');
                // Normalize data to make it valid
                fileData.data = normalizeData(fileData.data);
              }
              if (validation.warnings) {
                validation.warnings.forEach(warning => {
                  addToast('warning', 'Performance Warning', warning);
                });
              }
            }
            
            setFile(fileData);
        } catch (e: any) {
            console.error("Error loading sheet:", e);
            const errorMsg = e instanceof Error ? e.message : 'Unknown error';
            addToast('error', 'Error', `Failed to load sheet: ${errorMsg}`);
        } finally {
            setLoading(false);
        }
    };
    fetchSheet();
  }, [id, addToast]);

  // Sync file state with context files (for workflow updates)
  useEffect(() => {
    if (!file || !job) return;
    const contextFile = allFiles.find(f => f.id === file.id);
    if (contextFile && contextFile.lastModified > file.lastModified) {
      // File was updated in context (e.g., by workflow), sync local state
      setFile(contextFile);
    }
  }, [allFiles, file, job]);

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

      // Validate data if it's being changed
      if (changes.data) {
        // Normalize data first
        const normalizedData = normalizeData(changes.data);
        
        // Validate normalized data
        const validation = validateSpreadsheetData(normalizedData);
        if (!validation.valid) {
          addToast('error', 'Validation Error', validation.error || 'Invalid spreadsheet data');
          return;
        }
        
        // Show warnings if any
        if (validation.warnings && validation.warnings.length > 0) {
          validation.warnings.forEach(warning => {
            addToast('warning', 'Performance Warning', warning);
          });
        }
        
        // Use normalized data
        changes.data = normalizedData;
      }

      // Ensure we always have a baseline history snapshot
      const baseHistory = (Array.isArray(file.history) && file.history.length > 0)
          ? file.history
          : [{
              data: file.data,
              styles: file.styles || {},
              columns: file.columns || []
          }];
      const baseIndex = (typeof file.currentHistoryIndex === 'number' && file.currentHistoryIndex >= 0)
          ? file.currentHistoryIndex
          : baseHistory.length - 1;

      const updatedFile = { ...file, ...changes, lastModified: Date.now() };
      
      // Manage History Stack (limit to 30 snapshots to prevent memory issues)
      const newSnapshot: FileSnapshot = { 
          data: updatedFile.data, 
          styles: updatedFile.styles,
          columns: updatedFile.columns || []
      };
      
      const historyPast = baseHistory.slice(0, baseIndex + 1);
      const newHistory = [...historyPast, newSnapshot];
      
      // Keep only last 30 snapshots
      if (newHistory.length > 30) {
        newHistory.shift();
      }

      updatedFile.history = newHistory;
      updatedFile.currentHistoryIndex = newHistory.length - 1;

      setFile(updatedFile);
      scheduleFileSave(updatedFile);
  };

  const onUndo = () => {
      if (!file || file.currentHistoryIndex <= 0) return;
      const newIndex = file.currentHistoryIndex - 1;
      const snapshot = file.history[newIndex];
      const updatedFile = {
          ...file,
          data: snapshot.data,
          styles: snapshot.styles,
          columns: snapshot.columns || file.columns || [],
          currentHistoryIndex: newIndex,
          lastModified: Date.now()
      };
      setFile(updatedFile);
      scheduleFileSave(updatedFile);
  };

  const onRedo = () => {
      if (!file || file.currentHistoryIndex >= file.history.length - 1) return;
      const newIndex = file.currentHistoryIndex + 1;
      const snapshot = file.history[newIndex];
      const updatedFile = {
          ...file,
          data: snapshot.data,
          styles: snapshot.styles,
          columns: snapshot.columns || file.columns || [],
          currentHistoryIndex: newIndex,
          lastModified: Date.now()
      };
      setFile(updatedFile);
      scheduleFileSave(updatedFile);
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
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedERPFormat, setSelectedERPFormat] = useState<string>('generic');
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%, range: 0.5 to 2.0
  const [showTransformMenu, setShowTransformMenu] = useState(false);
  const [isGridFocused, setIsGridFocused] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

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

  // Scaled dimensions for zoom
  const scaledRowHeight = ROW_HEIGHT * zoomLevel;
  const scaledHeaderRowHeight = HEADER_ROW_HEIGHT * zoomLevel;
  const scaledHeaderColWidth = HEADER_COL_WIDTH * zoomLevel;
  const getScaledColWidth = (index: number) => getColWidth(index) * zoomLevel;
  const getScaledColLeft = (index: number) => getColLeft(index) * zoomLevel;

  // Handle Ctrl+Scroll for zoom (with passive: false to prevent browser zoom)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        setZoomLevel(prev => Math.min(2, Math.max(0.5, Math.round((prev + delta) * 100) / 100)));
      }
    };
    
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [file]); // Re-attach when file loads (ensures container is mounted)

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
    // Initial calculation - use setTimeout to ensure DOM is ready
    setTimeout(() => {
      handleResize();
      handleScroll();
    }, 0);
    return () => {
      window.removeEventListener('resize', handleResize);
      containerRef.current?.removeEventListener('scroll', handleScroll);
    };
  }, [file]); // Re-run when file loads

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
                          if (val instanceof Error || (typeof val === 'object' && val !== null && val?.type === 'ERROR')) return '#ERROR';
                          
                          // Convert objects to primitives - React cannot render objects directly
                          if (typeof val === 'object' && val !== null) {
                              // If object has a 'result' property, use that (common pattern)
                              if ('result' in val && val.result !== undefined) {
                                  return String(val.result);
                              }
                              // If object has a 'formula' property but no result, return the formula string
                              if ('formula' in val && typeof val.formula === 'string') {
                                  return val.formula;
                              }
                              // Otherwise, convert to string representation
                              return JSON.stringify(val);
                          }
                          
                          // Return primitive values as-is
                          return val;
                      }
                  }
              } catch (e) { return '#ERROR'; }
          }
          return rawVal; 
      }
      
      // Handle non-formula values that might be objects
      if (typeof rawVal === 'object' && rawVal !== null) {
          if ('result' in rawVal && rawVal.result !== undefined) {
              return String(rawVal.result);
          }
          return JSON.stringify(rawVal);
      }
      
      return rawVal;
  };

  // #region agent log
  React.useEffect(() => {
    const radiusValue = getComputedStyle(document.documentElement).getPropertyValue('--radius');
    fetch('http://127.0.0.1:7242/ingest/d9d5e317-074c-4d0b-bbb8-288914b5a823',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpreadsheetView.tsx:useEffect',message:'CSS --radius value',data:{radiusValue: radiusValue.trim()},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
    
    setTimeout(() => {
      const buttons = document.querySelectorAll('[data-slot="button"]');
      buttons.forEach((btn, idx) => {
        const classes = btn.className;
        const computedRadius = getComputedStyle(btn).borderRadius;
        const hasRoundedLg = classes.includes('rounded-lg');
        fetch('http://127.0.0.1:7242/ingest/d9d5e317-074c-4d0b-bbb8-288914b5a823',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpreadsheetView.tsx:useEffect',message:`Button ${idx} classes and computed styles`,data:{index:idx,className:classes,computedBorderRadius:computedRadius,hasRoundedLg,firstClasses:classes.split(' ').slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
      });
    }, 100);
  }, [file]);
  // #endregion

  if (loading || !file) {
      return <div className="flex-1 flex items-center justify-center h-full"><Loader2 className="animate-spin text-blue-600" /></div>;
  }

  // --- Handlers (Simplified for brevity as logic is same as before) ---
  const handleSelectAll = () => {
      let maxR = 0;
      let maxC = 0;
      let hasData = false;

      file.data.forEach((row, r) => {
        if (row && Array.isArray(row)) {
          row.forEach((cell, c) => {
             if (cell !== undefined && cell !== null && cell !== '') {
                 maxR = Math.max(maxR, r);
                 maxC = Math.max(maxC, c);
                 hasData = true;
             }
          });
        }
      });

      if (hasData) {
         setSelection({ start: { r: 0, c: 0 }, end: { r: maxR, c: maxC } });
         if (!activeCell) setActiveCell({ r: 0, c: 0 });
      } else {
         setSelection({ start: { r: 0, c: 0 }, end: { r: 0, c: 0 } });
         setActiveCell({ r: 0, c: 0 });
      }
  };

  const handleColumnHeaderClick = (c: number) => {
      setActiveCell({ r: 0, c });
      setSelection({ 
          start: { r: 0, c }, 
          end: { r: rowCount - 1, c } 
      });
  };

  const handleRowHeaderClick = (r: number) => {
      setActiveCell({ r, c: 0 });
      setSelection({ 
          start: { r, c: 0 }, 
          end: { r, c: colCount - 1 } 
      });
  };

  const handleMouseDownResize = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
        index,
        startX: e.clientX,
        startWidth: colWidths[index] || DEFAULT_COL_WIDTH
    };
    document.addEventListener('mousemove', handleMouseMoveResize);
    document.addEventListener('mouseup', handleMouseUpResize);
  };

  const handleMouseMoveResize = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { index, startX, startWidth } = resizingRef.current;
    const diff = e.clientX - startX;
    const newWidth = Math.max(40, startWidth + diff); 
    setColWidths(prev => ({ ...prev, [index]: newWidth }));
  };

  const handleMouseUpResize = () => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMoveResize);
    document.removeEventListener('mouseup', handleMouseUpResize);
  };
  
  const handleEnrichment = async () => {
    if (enrichmentTargetCol === null || !enrichmentPrompt) return;

    // Calculate cost based on unique items (25 credits per batch of 100)
    const sourceData = file.data.slice(1).map(r => r[enrichmentTargetCol]).filter(v => v !== undefined && v !== null && v !== '');
    const allUniqueItems = Array.from(new Set(sourceData.map(v => String(v).trim())));
    const BATCH_SIZE = 100; // Process 100 items per API call (backend limit)
    const numBatches = Math.ceil(allUniqueItems.length / BATCH_SIZE);
    const totalCost = numBatches * 25;

    if (credits < totalCost) {
        addToast('error', 'Insufficient Credits', `Data enrichment requires ${totalCost} credits (${allUniqueItems.length} unique items).`);
        return;
    }

    setIsProcessingAI(true);
    try {
        const colIdx = enrichmentTargetCol;
        const mergedResult: Record<string, any> = {};
        
        // Process in batches
        for (let i = 0; i < allUniqueItems.length; i += BATCH_SIZE) {
            const batch = allUniqueItems.slice(i, i + BATCH_SIZE);
            try {
                const response = await api.enrich(batch, enrichmentPrompt);
                Object.assign(mergedResult, response.result);
            } catch (batchError: any) {
                console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, batchError);
                // Continue with other batches even if one fails
            }
        }
        
        // Create normalized lookup map for flexible matching
        const lookupMap = new Map<string, any>();
        for (const [key, value] of Object.entries(mergedResult)) {
            const normalizedKey = String(key).trim().toLowerCase();
            lookupMap.set(normalizedKey, value);
        }
        
        const newData = [...file.data];
        const emptyColIdx = file.data[0].length;
        newData[0][emptyColIdx] = "Enriched Info";

        // Populate enriched data for ALL rows
        for(let r = 1; r < newData.length; r++) {
            const cellValue = newData[r][colIdx];
            if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
                // Try exact match first
                let enrichedValue = mergedResult[cellValue] || mergedResult[String(cellValue)];
                
                // If no exact match, try normalized lookup
                if (enrichedValue === undefined) {
                    const normalizedCellValue = String(cellValue).trim().toLowerCase();
                    enrichedValue = lookupMap.get(normalizedCellValue);
                }
                
                if (enrichedValue !== undefined) {
                    newData[r][emptyColIdx] = typeof enrichedValue === 'object' ? JSON.stringify(enrichedValue) : enrichedValue;
                }
            }
        }

        handleFileChange({ data: newData });
        const colName = file.columns[colIdx];
        handleRecordAction('enrich', `Enriched ${getColumnLabel(colIdx)} with "${enrichmentPrompt}"`, { prompt: enrichmentPrompt, colIndex: colIdx, columnName: colName });
        // Credits are enforced server-side; refresh UI credits.
        handleUseCredit(0);
        addToast('success', 'Enrichment Complete', `Data successfully added to your sheet (${allUniqueItems.length} unique items processed).`);
        setEnrichmentPrompt(null);
        setEnrichmentTargetCol(null);
    } catch (e: any) {
        console.error('Enrichment error:', e);
        const errorMessage = e?.message || 'Could not fetch data. Please try again.';
        addToast('error', 'Enrichment Failed', errorMessage);
    } finally { 
        setIsProcessingAI(false);
    }
  };

  // ERP Column Mapping Helper
  const mapDataToERPFormat = (data: any[][]): { mappedData: any[][], warnings: string[] } => {
    const template = ERP_TEMPLATES.find(t => t.id === selectedERPFormat);
    if (!template || template.id === 'generic') {
      return { mappedData: data, warnings: [] };
    }

    const warnings: string[] = [];
    const headerRow = data[0] || [];
    const headerMap: Record<string, number> = {};
    
    // Build case-insensitive header index
    headerRow.forEach((col, idx) => {
      if (col) headerMap[String(col).toLowerCase().trim()] = idx;
    });

    // Find best matches for ERP columns
    const columnIndexMap: Record<string, number> = {};
    for (const [erpCol, possibleNames] of Object.entries(template.columnMapping)) {
      let foundIdx = -1;
      for (const possibleName of possibleNames) {
        const normalized = possibleName.toLowerCase().trim();
        if (headerMap[normalized] !== undefined) {
          foundIdx = headerMap[normalized];
          break;
        }
      }
      if (foundIdx !== -1) {
        columnIndexMap[erpCol] = foundIdx;
      } else if (template.requiredColumns.includes(erpCol)) {
        warnings.push(`Missing required column: ${erpCol}`);
      }
    }

    // Build mapped data
    const mappedData: any[][] = [];
    const newHeader = Object.keys(template.columnMapping);
    mappedData.push(newHeader);

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const mappedRow: any[] = [];
      for (const erpCol of newHeader) {
        const sourceIdx = columnIndexMap[erpCol];
        const value = sourceIdx !== undefined ? row[sourceIdx] : '';
        mappedRow.push(value);
      }
      mappedData.push(mappedRow);
    }

    return { mappedData, warnings };
  };

  // Export Functions
  const exportToExcel = async () => {
    if (!file) return;
    setIsExporting(true);
    setShowExportMenu(false);
    
    try {
      // Map data to ERP format
      const { mappedData, warnings } = mapDataToERPFormat(file.data);
      
      // Show warnings if any
      if (warnings.length > 0) {
        const proceed = window.confirm(
          `Export Warnings:\n${warnings.join('\n')}\n\nDo you want to continue anyway?`
        );
        if (!proceed) {
          setIsExporting(false);
          return;
        }
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet1');

      // Add data to worksheet
      mappedData.forEach((row, rowIndex) => {
        const excelRow = worksheet.addRow(row);
        
        // Apply basic styling (header row gets bold)
        row.forEach((cellValue, colIndex) => {
          const excelCell = excelRow.getCell(colIndex + 1);
          let finalValue = cellValue;
          
          // Handle formulas - export calculated value if available
          if (typeof cellValue === 'string' && cellValue.startsWith('=')) {
            if (hfReady && hfInstance.current) {
              try {
                const sheetNames = hfInstance.current.getSheetNames();
                if (sheetNames.length > 0) {
                  const sheetId = hfInstance.current.getSheetId(sheetNames[0]);
                  if (sheetId !== undefined) {
                    const calculatedValue = hfInstance.current.getCellValue({ sheet: sheetId, row: rowIndex, col: colIndex });
                    if (!(calculatedValue instanceof Error)) {
                      finalValue = calculatedValue;
                    }
                  }
                }
              } catch (e) {
                // Keep original value
              }
            }
          }
          
          excelCell.value = finalValue;
          
          // Apply header styling
          if (rowIndex === 0) {
            excelCell.font = { bold: true };
            excelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
          }
        });
      });

      // Auto-fit columns
      worksheet.columns.forEach((column) => {
        if (column.values) {
          const lengths = column.values.map((v: any) => v ? String(v).length : 10);
          const maxLength = Math.max(...lengths.filter((v: number) => !isNaN(v)));
          column.width = Math.min(maxLength + 2, 50);
        }
      });

      // Generate buffer and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = file.name.replace(/\.[^/.]+$/, '') || 'export';
      link.download = `${fileName}_exported.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      addToast('success', 'Export Complete', 'File downloaded successfully.');
    } catch (error: any) {
      console.error('Excel export failed:', error);
      addToast('error', 'Export Failed', error.message || 'Failed to export to Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToCSV = () => {
    if (!file) return;
    setShowExportMenu(false);
    
    try {
      // Map data to ERP format
      const { mappedData, warnings } = mapDataToERPFormat(file.data);
      
      // Show warnings if any
      if (warnings.length > 0) {
        const proceed = window.confirm(
          `Export Warnings:\n${warnings.join('\n')}\n\nDo you want to continue anyway?`
        );
        if (!proceed) {
          return;
        }
      }

      // Convert data to CSV format
      const csvRows: string[] = [];
      
      mappedData.forEach((row, rowIndex) => {
        const csvRow = row.map((cell, colIndex) => {
          let cellValue = cell;
          
          // Handle formulas - get calculated value if available
          if (typeof cellValue === 'string' && cellValue.startsWith('=')) {
            if (hfReady && hfInstance.current) {
              try {
                const sheetNames = hfInstance.current.getSheetNames();
                if (sheetNames.length > 0) {
                  const sheetId = hfInstance.current.getSheetId(sheetNames[0]);
                  if (sheetId !== undefined) {
                    const calculatedValue = hfInstance.current.getCellValue({ sheet: sheetId, row: rowIndex, col: colIndex });
                    if (!(calculatedValue instanceof Error)) {
                      cellValue = calculatedValue;
                    }
                  }
                }
              } catch (e) {
                // Keep original value
              }
            }
          }
          
          // Escape CSV values
          const stringValue = cellValue === null || cellValue === undefined ? '' : String(cellValue);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        });
        csvRows.push(csvRow.join(','));
      });
      
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = file.name.replace(/\.[^/.]+$/, '') || 'export';
      link.download = `${fileName}_exported.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      addToast('success', 'Export Complete', 'CSV file downloaded successfully.');
    } catch (error: any) {
      console.error('CSV export failed:', error);
      addToast('error', 'Export Failed', error.message || 'Failed to export to CSV.');
    }
  };

  const handleMouseDown = (r: number, c: number, e: React.MouseEvent) => {
    if (isEditing && activeCell?.r === r && activeCell?.c === c) return;
    e.preventDefault();
    containerRef.current?.focus();
    if (isEditing) commitEdit();

    if (e.shiftKey && activeCell) {
      setSelection({ start: activeCell, end: { r, c } });
    } else {
      setActiveCell({ r, c });
      setSelection({ start: { r, c }, end: { r, c } });
      const val = file.data[r]?.[c];
      setEditValue(val !== undefined ? String(val) : '');
    }
    setIsDragging(true);
  };

  const handleMouseEnter = (r: number, c: number) => {
    if (isDragging && selection) {
      setSelection({ ...selection, end: { r, c } });
    }
  };

  const handleDoubleClick = (r: number, c: number) => {
    setActiveCell({ r, c });
    setIsEditing(true);
  };

  const commitEdit = () => {
    if (activeCell && isEditing) {
      const newData = [...file.data];
      if (!newData[activeCell.r]) newData[activeCell.r] = [];
      
      let valToSave: any = editValue;
      const isFormula = editValue.trim().startsWith('=');
      
      // Validate formula if it's a formula
      if (isFormula) {
        const formulaValidation = validateFormula(editValue.trim());
        if (!formulaValidation.valid) {
          addToast('error', 'Invalid Formula', formulaValidation.error || 'Formula validation failed');
          return;
        }
        valToSave = editValue.trim();
      } else if (!isNaN(parseFloat(editValue)) && isFinite(Number(editValue))) {
          if (editValue.startsWith('0') && editValue.length > 1 && editValue[1] !== '.') {
             valToSave = editValue;
          } else {
             valToSave = Number(editValue);
          }
      }
      
      newData[activeCell.r][activeCell.c] = valToSave;
      handleFileChange({ data: newData });
      
      // Record formula step if it's a formula
      if (isFormula) {
          handleRecordAction('formula', `Added formula in ${getColumnLabel(activeCell.c)}${activeCell.r + 1}`, { 
              formula: editValue, 
              rowIndex: activeCell.r, 
              colIndex: activeCell.c 
          });
      }
      
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
        const nextR = e.shiftKey ? activeCell!.r - 1 : activeCell!.r + 1;
        setActiveCell({ r: nextR, c: activeCell!.c });
        setSelection({ start: { r: nextR, c: activeCell!.c }, end: { r: nextR, c: activeCell!.c } });
        const val = file.data[nextR]?.[activeCell!.c];
        setEditValue(val !== undefined ? String(val) : '');
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commitEdit();
        const nextC = e.shiftKey ? activeCell!.c - 1 : activeCell!.c + 1;
        setActiveCell({ r: activeCell!.r, c: nextC });
        setSelection({ start: { r: activeCell!.r, c: nextC }, end: { r: activeCell!.r, c: nextC } });
        const val = file.data[activeCell!.r]?.[nextC];
        setEditValue(val !== undefined ? String(val) : '');
      }
      return;
    }

    // Undo / Redo shortcuts (only when not editing a cell input)
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'z') {
        e.preventDefault();
        if (e.shiftKey) onRedo();
        else onUndo();
        return;
      }
      if (k === 'y') {
        e.preventDefault();
        onRedo();
        return;
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      handleSelectAll();
      return;
    }

    if (!activeCell) return;

    let nextR = activeCell.r;
    let nextC = activeCell.c;
    let hasMoved = false;

    if (e.key === 'ArrowUp') { nextR--; hasMoved = true; }
    else if (e.key === 'ArrowDown') { nextR++; hasMoved = true; }
    else if (e.key === 'ArrowLeft') { nextC--; hasMoved = true; }
    else if (e.key === 'ArrowRight') { nextC++; hasMoved = true; }
    else if (e.key === 'Enter') {
        hasMoved = true;
        if (e.shiftKey) nextR--; else nextR++;
    }
    else if (e.key === 'Tab') {
        hasMoved = true;
        if (e.shiftKey) nextC--; else nextC++;
    }

    if (hasMoved) {
        e.preventDefault();
        nextR = Math.max(0, nextR);
        nextC = Math.max(0, nextC);
        setActiveCell({ r: nextR, c: nextC });
        setSelection({ start: { r: nextR, c: nextC }, end: { r: nextR, c: nextC } });
        const val = file.data[nextR]?.[nextC];
        setEditValue(val !== undefined ? String(val) : '');
        return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      // Check for Full Selection to trigger Row/Column Deletion
      if (selection) {
          const r1 = Math.min(selection.start.r, selection.end.r);
          const r2 = Math.max(selection.start.r, selection.end.r);
          const c1 = Math.min(selection.start.c, selection.end.c);
          const c2 = Math.max(selection.start.c, selection.end.c);

          // Detect Column Deletion (Headers selected implies full row span)
          if (r1 === 0 && r2 === rowCount - 1 && c1 === c2) {
              const colIdx = c1;
              const newData = file.data.map(row => row.filter((_, i) => i !== colIdx));
              const newColumns = file.columns.filter((_, i) => i !== colIdx);
              
              handleFileChange({ data: newData, columns: newColumns });
              const colName = file.columns[colIdx];
              handleRecordAction('delete_col', `Deleted column ${getColumnLabel(colIdx)}`, { colIndex: colIdx, columnName: colName });
              addToast('info', 'Column Deleted', `Removed ${getColumnLabel(colIdx)}`);
              setSelection(null);
              setActiveCell(null);
              return;
          }

          // Detect Row Deletion (Row Headers selected implies full col span)
          if (c1 === 0 && c2 === colCount - 1 && r1 === r2) {
              const rowIdx = r1;
              const newData = file.data.filter((_, i) => i !== rowIdx);
              
              handleFileChange({ data: newData });
              handleRecordAction('delete_row' as any, `Deleted row ${rowIdx + 1}`, { rowIndex: rowIdx });
              addToast('info', 'Row Deleted', `Removed row ${rowIdx + 1}`);
              setSelection(null);
              setActiveCell(null);
              return;
          }
      }

      // Default: Clear Content (Range or Single Cell)
      const newData = file.data.map(row => [...(row || [])]);
      
      if (selection) {
          const r1 = Math.min(selection.start.r, selection.end.r);
          const r2 = Math.max(selection.start.r, selection.end.r);
          const c1 = Math.min(selection.start.c, selection.end.c);
          const c2 = Math.max(selection.start.c, selection.end.c);

          for (let r = r1; r <= r2; r++) {
              if (newData[r]) {
                  for (let c = c1; c <= c2; c++) {
                      newData[r][c] = '';
                  }
              }
          }
      } else if (activeCell && newData[activeCell.r]) {
          newData[activeCell.r][activeCell.c] = '';
      }
      
      handleFileChange({ data: newData });
      setEditValue('');
      return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      setIsEditing(true);
      setEditValue(e.key);
      return;
    }
  };

  const toggleStyle = (styleKey: keyof CellStyle, value: any) => {
    if (!selection) return;
    
    const newStyles = { ...file.styles };
    const r1 = Math.min(selection.start.r, selection.end.r);
    const r2 = Math.max(selection.start.r, selection.end.r);
    const c1 = Math.min(selection.start.c, selection.end.c);
    const c2 = Math.max(selection.start.c, selection.end.c);

    let appliedValue: boolean | string;
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const key = `${r},${c}`;
        const current = newStyles[key] || {};
        if (styleKey === 'align') {
             newStyles[key] = { ...current, [styleKey]: value };
             appliedValue = value;
        } else {
             const val = current[styleKey as keyof Pick<CellStyle, 'bold'|'italic'|'underline'>];
             const newVal = !val;
             newStyles[key] = { ...current, [styleKey]: newVal };
             appliedValue = newVal;
        }
      }
    }
    handleFileChange({ styles: newStyles });
    
    // Record formatting action for workflows
    const styleName = styleKey === 'bold' ? 'Bold' : styleKey === 'italic' ? 'Italic' : styleKey === 'underline' ? 'Underline' : styleKey === 'align' ? `Align ${value}` : styleKey;
    const action = styleKey === 'align' ? 'set' : (appliedValue ? 'applied' : 'removed');
    const cellRange = r1 === r2 && c1 === c2 
      ? `${getColumnLabel(c1)}${r1 + 1}` 
      : `${getColumnLabel(c1)}${r1 + 1}:${getColumnLabel(c2)}${r2 + 1}`;
    handleRecordAction('format', `${styleName} ${action} on ${cellRange}`, { 
      styleKey, 
      value: appliedValue, 
      r1, 
      r2, 
      c1, 
      c2 
    });
  };

  const handleDataAction = (action: 'trim' | 'upper' | 'lower' | 'title' | 'dedup') => {
    if (!selection) return;
    
    const newData = file.data.map(row => [...(row || [])]);
    for (let r = 0; r < newData.length; r++) {
        if (!newData[r]) newData[r] = [];
    }

    const r1 = Math.min(selection.start.r, selection.end.r);
    const r2 = Math.max(selection.start.r, selection.end.r);
    const c1 = Math.min(selection.start.c, selection.end.c);
    const c2 = Math.max(selection.start.c, selection.end.c);
    
    const seen = new Set();

    for (let r = r1; r <= r2; r++) {
      if (!newData[r]) continue; 
      for (let c = c1; c <= c2; c++) {
        let val = newData[r][c];
        
        if (action === 'dedup') {
             if (val !== undefined && val !== '' && val !== null) {
                 const key = String(val).toLowerCase();
                 if (seen.has(key)) {
                     newData[r][c] = ''; 
                 } else {
                     seen.add(key);
                 }
             }
             continue;
        }

        if (typeof val === 'string' && val) {
            if (action === 'trim') val = val.trim();
            if (action === 'upper') val = val.toUpperCase();
            if (action === 'lower') val = val.toLowerCase();
            if (action === 'title') {
                val = val.toLowerCase().split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            }
            newData[r][c] = val;
        }
      }
    }
    handleFileChange({ data: newData });
    handleRecordAction('sort', `Transformed range to ${action}`, { action, r1, c1, r2, c2 });
  };

  const handleApplyFilter = (colIndex: number, operator: string, value: string) => {
    if (!file || colIndex < 0 || colIndex >= (file.data[0]?.length || 0)) return;
    const headerRow = file.data[0];
    const filteredData = [headerRow];
    for (let r = 1; r < file.data.length; r++) {
      if (!file.data[r]) continue;
      const cellValue = file.data[r][colIndex];
      let shouldInclude = false;
      if (operator === 'equals') shouldInclude = String(cellValue) === String(value);
      else if (operator === 'contains') shouldInclude = String(cellValue).toLowerCase().includes(String(value).toLowerCase());
      else if (operator === 'greater') shouldInclude = Number(cellValue) > Number(value);
      else if (operator === 'less') shouldInclude = Number(cellValue) < Number(value);
      else if (operator === 'not_empty') shouldInclude = cellValue !== undefined && cellValue !== null && cellValue !== '';
      else if (operator === 'empty') shouldInclude = cellValue === undefined || cellValue === null || cellValue === '';
      if (shouldInclude) filteredData.push(file.data[r]);
    }
    handleFileChange({ data: filteredData });
    const colName = file.columns[colIndex];
    const desc = operator === 'not_empty' ? `Filtered ${colName} (not empty)` : operator === 'empty' ? `Filtered ${colName} (empty)` : `Filtered ${colName} ${operator} "${value}"`;
    handleRecordAction('filter', desc, { colIndex, columnName: colName, operator, value });
    setShowFilterModal(false);
    addToast('success', 'Filter Applied', `${filteredData.length - 1} rows kept.`);
  };

  const startRow = Math.max(0, Math.floor(scrollPos.top / scaledRowHeight) - BUFFER_ROWS);
  const endRow = Math.min(rowCount, Math.ceil((scrollPos.top + viewportSize.height) / scaledRowHeight) + BUFFER_ROWS);
  let startCol = 0; while(startCol < colCount && getScaledColLeft(startCol + 1) < scrollPos.left) startCol++;
  startCol = Math.max(0, startCol - BUFFER_COLS);
  let endCol = startCol; while(endCol < colCount && getScaledColLeft(endCol) < scrollPos.left + viewportSize.width) endCol++;
  endCol = Math.min(colCount, endCol + BUFFER_COLS);

  const getSelectionStyle = () => {
    if (!selection) return { display: 'none' };
    const r1 = Math.min(selection.start.r, selection.end.r);
    const r2 = Math.max(selection.start.r, selection.end.r);
    const c1 = Math.min(selection.start.c, selection.end.c);
    const c2 = Math.max(selection.start.c, selection.end.c);

    return {
      top: r1 * scaledRowHeight,
      left: scaledHeaderColWidth + getScaledColLeft(c1),
      width: getScaledColLeft(c2 + 1) - getScaledColLeft(c1),
      height: (r2 - r1 + 1) * scaledRowHeight,
      pointerEvents: 'none' as const,
    };
  };

  const getActiveCellStyle = () => {
    if (!activeCell) return { display: 'none' };
    return {
      top: activeCell.r * scaledRowHeight,
      left: scaledHeaderColWidth + getScaledColLeft(activeCell.c),
      width: getScaledColWidth(activeCell.c),
      height: scaledRowHeight,
      pointerEvents: 'none' as const,
    };
  };

  // Floating toolbar position - appears above selection
  const getFloatingToolbarStyle = () => {
    if (!selection || !activeCell || isEditing) return { display: 'none' as const };
    
    const r1 = Math.min(selection.start.r, selection.end.r);
    const c1 = Math.min(selection.start.c, selection.end.c);
    const c2 = Math.max(selection.start.c, selection.end.c);
    
    const selectionLeft = getScaledColLeft(c1);
    const selectionRight = getScaledColLeft(c2 + 1);
    const selectionCenterX = scaledHeaderColWidth + (selectionLeft + selectionRight) / 2;
    
    // Position above selection, with offset for scroll
    const topPos = r1 * scaledRowHeight - 48; // 48px above selection
    
    return {
      position: 'absolute' as const,
      top: Math.max(8, topPos),
      left: Math.max(scaledHeaderColWidth + 8, selectionCenterX - 140), // Center the ~280px toolbar
      zIndex: 45,
      transform: topPos < 8 ? 'translateY(60px)' : 'none', // Move below if too close to top
    };
  };

  return (
    <div className="flex h-full overflow-hidden relative">
        {/* SIDEBAR TOGGLE BUTTON */}
        <div className="absolute bottom-8 z-50" style={{ right: isSidebarOpen ? '400px' : '0px' }}>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-6 h-12 bg-white border border-gray-200 rounded-l-lg flex items-center justify-center shadow-md hover:bg-gray-50 text-gray-500 transition-all"
          >
            {isSidebarOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* MAIN EDITOR AREA */}
        <div className="flex-1 flex flex-col h-full bg-white text-sm min-w-0" onMouseUp={() => setIsDragging(false)}>
      
      {/* MINIMAL TOP BAR - Clean & Modern */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-gray-100 bg-white">
        {/* Left: Undo/Redo + Cell Reference */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5">
            <Button 
              variant="ghost" 
              size="icon-sm"
              onClick={onUndo} 
              disabled={file.currentHistoryIndex <= 0} 
              title="Undo (Ctrl+Z)"
              className="rounded-lg"
            >
              <Undo size={18} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon-sm"
              onClick={onRedo} 
              disabled={file.currentHistoryIndex >= file.history.length - 1} 
              title="Redo (Ctrl+Y)"
              className="rounded-lg"
            >
              <Redo size={18} />
            </Button>
          </div>
          
          {activeCell && (
            <div className="hidden sm:flex items-center px-2.5 py-1 bg-muted rounded-lg">
              <span className="text-xs font-semibold text-foreground">{getColumnLabel(activeCell.c)}{activeCell.r + 1}</span>
            </div>
          )}
        </div>

        {/* Center: Formula Bar */}
        <div className="flex-1 max-w-2xl mx-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border border-transparent focus-within:border-ring focus-within:bg-background focus-within:shadow-sm transition-all">
            <span className="text-muted-foreground text-sm font-medium">fx</span>
            <input 
              type="text" 
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
              placeholder={activeCell ? "Enter value or formula..." : "Select a cell"}
              value={editValue}
              onChange={(e) => {
                setEditValue(e.target.value);
                if (activeCell) setIsEditing(true);
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); }}
            />
          </div>
        </div>

        {/* Right: Filter (when recording) + Export + Zoom */}
        <div className="flex items-center gap-2">
          {isRecording && file && (
            <Button variant="outline" size="sm" onClick={() => setShowFilterModal(true)} className="rounded-xl border-purple-200 text-purple-700 hover:bg-purple-50">
              <Filter size={16} />
              <span className="hidden sm:inline">Filter rows</span>
            </Button>
          )}
          {/* Export with ERP Format inside */}
          <DropdownMenu open={showExportMenu} onOpenChange={setShowExportMenu}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isExporting} className="rounded-xl">
                <Download size={16} />
                <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2">
              <div className="px-2 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Template
              </div>
              <div className="space-y-0.5 mb-2">
                {ERP_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedERPFormat(template.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors text-left",
                      selectedERPFormat === template.id 
                        ? "bg-blue-50 text-blue-700" 
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {selectedERPFormat === template.id && <Check size={14} className="text-blue-600" />}
                    {selectedERPFormat !== template.id && <span className="w-[14px]" />}
                    {template.name}
                  </button>
                ))}
              </div>
              <div className="h-px bg-gray-100 my-2" />
              <div className="px-2 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Download as
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={exportToExcel}
                  disabled={isExporting}
                  className="w-full flex items-center gap-2 px-2 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                >
                  <FileText size={16} className="text-green-600" />
                  Excel (.xlsx)
                </button>
                <button
                  onClick={exportToCSV}
                  disabled={isExporting}
                  className="w-full flex items-center gap-2 px-2 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                >
                  <FileText size={16} className="text-blue-600" />
                  CSV (.csv)
                </button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Zoom - Minimal */}
          <div className="hidden md:flex items-center gap-0.5 bg-muted/50 rounded-xl px-1">
            <Button 
              variant="ghost" 
              size="icon-sm"
              onClick={() => setZoomLevel(prev => Math.max(0.5, Math.round((prev - 0.1) * 100) / 100))}
              title="Zoom out"
              className="h-7 w-7 rounded-lg"
            >
              −
            </Button>
            <span className="w-10 text-center text-xs font-medium text-muted-foreground">
              {Math.round(zoomLevel * 100)}%
            </span>
            <Button 
              variant="ghost" 
              size="icon-sm"
              onClick={() => setZoomLevel(prev => Math.min(2, Math.round((prev + 0.1) * 100) / 100))}
              title="Zoom in"
              className="h-7 w-7 rounded-lg"
            >
              +
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <div
          ref={containerRef}
          className="w-full h-full overflow-auto bg-gray-100 relative focus:outline-none"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsGridFocused(true)}
          onBlur={(e) => {
            // Only blur if focus moved outside the container
            if (!containerRef.current?.contains(e.relatedTarget as Node)) {
              setIsGridFocused(false);
            }
          }}
        >
                <div style={{ width: scaledHeaderColWidth + getScaledColLeft(colCount), height: scaledHeaderRowHeight + rowCount * scaledRowHeight, position: 'relative', transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                    
                    {/* Headers */}
                    <div className="sticky top-0 z-40 flex bg-[#f8f9fa] shadow-[0_1px_0_#e2e8f0]" style={{ height: scaledHeaderRowHeight, width: scaledHeaderColWidth + getScaledColLeft(colCount) }}>
                        <div onClick={handleSelectAll} className="sticky left-0 z-50 bg-[#f8f9fa] border-r border-gray-300 border-b flex-shrink-0 flex items-center justify-center font-bold text-blue-600 cursor-pointer" style={{ width: scaledHeaderColWidth, fontSize: 12 * zoomLevel }}>
                            {activeCell ? `${getColumnLabel(activeCell.c)}${activeCell.r + 1}` : ''}
                        </div>
              <div className="relative flex-1">
                 {Array.from({ length: endCol - startCol + 1 }).map((_, i) => {
                    const c = startCol + i;
                    if (c >= colCount) return null;
                    return (
                        <div 
                           key={c} 
                           className="absolute top-0 border-r border-gray-300 border-b flex items-center justify-center font-semibold text-gray-500 bg-[#f8f9fa] group cursor-pointer hover:bg-gray-200"
                           style={{ left: getScaledColLeft(c), width: getScaledColWidth(c), height: scaledHeaderRowHeight, fontSize: 12 * zoomLevel }}
                           onClick={() => handleColumnHeaderClick(c)}
                        >
                            {getColumnLabel(c)}
                            <div 
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                                onMouseDown={(e) => handleMouseDownResize(e, c)}
                            ></div>
                        </div>
                    );
                 })}
              </div>
            </div>

            <div className="relative">
                 {/* Sticky Row Numbers */}
                 <div className="sticky left-0 z-40 bg-[#f8f9fa] border-r border-gray-300" style={{ width: scaledHeaderColWidth, height: rowCount * scaledRowHeight }}>
                    {Array.from({ length: endRow - startRow + 1 }).map((_, i) => {
                        const r = startRow + i;
                        if (r >= rowCount) return null;
                        return (
                            <div 
                                key={r}
                                className="absolute left-0 border-b border-gray-300 flex items-center justify-center font-semibold text-gray-500 bg-[#f8f9fa] cursor-pointer hover:bg-gray-200"
                                style={{ top: r * scaledRowHeight, width: scaledHeaderColWidth, height: scaledRowHeight, fontSize: 12 * zoomLevel }}
                                onClick={() => handleRowHeaderClick(r)}
                            >
                                {r + 1}
                            </div>
                        );
                    })}
                 </div>

                 {/* Grid Cells */}
              <div className="absolute top-0" style={{ left: scaledHeaderColWidth }}>
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
                          className="absolute border-r border-b border-gray-200 bg-white overflow-hidden whitespace-nowrap flex items-center cursor-cell select-none"
                          style={{
                              top: r * scaledRowHeight,
                              left: getScaledColLeft(c),
                              width: getScaledColWidth(c),
                              height: scaledRowHeight,
                              paddingLeft: 4 * zoomLevel,
                              paddingRight: 4 * zoomLevel,
                              fontSize: 14 * zoomLevel,
                              fontWeight: styles.bold ? 'bold' : 'normal',
                              fontStyle: styles.italic ? 'italic' : 'normal',
                              textDecoration: styles.underline ? 'underline' : 'none',
                              justifyContent: styles.align === 'center' ? 'center' : styles.align === 'right' ? 'flex-end' : 'flex-start',
                              color: styles.color,
                              backgroundColor: styles.bg,
                          }}
                          onMouseDown={(e) => handleMouseDown(r, c, e)}
                          onMouseEnter={() => handleMouseEnter(r, c)}
                          onDoubleClick={() => handleDoubleClick(r, c)}
                      >
                          {isEditing && activeCell?.r === r && activeCell?.c === c ? '' : displayVal}
                      </div>
                    );
                  });
                })}
              </div>

                    {/* Selection Overlays */}
                 <div 
                    className="absolute border-2 border-blue-500 bg-blue-500/10 z-30 pointer-events-none transition-all duration-75"
                    style={getSelectionStyle()}
                 />
                 <div 
                    className="absolute border-2 border-blue-600 z-30 pointer-events-none"
                    style={getActiveCellStyle()}
                 />
                 
                 {/* FLOATING SELECTION TOOLBAR - Modern & Contextual */}
                 {selection && activeCell && !isEditing && !isDragging && isGridFocused && (
                   <div 
                     className="flex items-center gap-1.5 p-1.5 bg-background/95 backdrop-blur-xl rounded-xl shadow-lg border border-border animate-in fade-in slide-in-from-bottom-2 duration-200"
                     style={getFloatingToolbarStyle()}
                   >
                     {/* Format Group */}
                     <div className="flex items-center gap-0.5">
                       <Button 
                         variant="ghost" 
                         size="icon-sm"
                         onClick={() => toggleStyle('bold', true)}
                         title="Bold (Ctrl+B)"
                         className="h-7 w-7 rounded-lg"
                       >
                         <Bold size={15} />
                       </Button>
                       <Button 
                         variant="ghost" 
                         size="icon-sm"
                         onClick={() => toggleStyle('italic', true)}
                         title="Italic (Ctrl+I)"
                         className="h-7 w-7 rounded-lg"
                       >
                         <Italic size={15} />
                       </Button>
                       <Button 
                         variant="ghost" 
                         size="icon-sm"
                         onClick={() => toggleStyle('underline', true)}
                         title="Underline (Ctrl+U)"
                         className="h-7 w-7 rounded-lg"
                       >
                         <Underline size={15} />
                       </Button>
                     </div>

                     <div className="w-px h-5 bg-border" />

                     {/* Transform Dropdown */}
                     <DropdownMenu open={showTransformMenu} onOpenChange={setShowTransformMenu}>
                       <DropdownMenuTrigger asChild>
                         <Button variant="ghost" size="sm" className="h-7 gap-1 rounded-lg">
                           <Wand2 size={14} />
                           <span className="hidden sm:inline">Transform</span>
                           <ChevronDown size={12} className={cn("transition-transform", showTransformMenu && "rotate-180")} />
                         </Button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent align="center" className="w-48 z-[300]">
                         <DropdownMenuItem onClick={() => { handleDataAction('trim'); setShowTransformMenu(false); }} className="gap-2">
                           <Scissors size={14} className="text-muted-foreground" />
                           Trim whitespace
                         </DropdownMenuItem>
                         <DropdownMenuItem onClick={() => { handleDataAction('upper'); setShowTransformMenu(false); }} className="gap-2">
                           <CaseUpper size={14} className="text-muted-foreground" />
                           UPPERCASE
                         </DropdownMenuItem>
                         <DropdownMenuItem onClick={() => { handleDataAction('lower'); setShowTransformMenu(false); }} className="gap-2">
                           <CaseLower size={14} className="text-muted-foreground" />
                           lowercase
                         </DropdownMenuItem>
                         <DropdownMenuItem onClick={() => { handleDataAction('title'); setShowTransformMenu(false); }} className="gap-2">
                           <CaseSensitive size={14} className="text-muted-foreground" />
                           Title Case
                         </DropdownMenuItem>
                         <div className="h-px bg-border my-1" />
                         <DropdownMenuItem onClick={() => { handleDataAction('dedup'); setShowTransformMenu(false); }} className="gap-2 text-destructive focus:text-destructive">
                           <CopyMinus size={14} />
                           Remove duplicates
                         </DropdownMenuItem>
                       </DropdownMenuContent>
                     </DropdownMenu>

                     <div className="w-px h-5 bg-border" />

                     {/* Enrich - Primary Action */}
                     <Button
                       size="sm"
                       onClick={() => { 
                         if(activeCell) { 
                           setEnrichmentTargetCol(activeCell.c); 
                           setEnrichmentPrompt(""); 
                         } else { 
                           addToast('warning', "Select a column first"); 
                         } 
                       }}
                       title="AI Enrich (25 credits)"
                       className="h-7 gap-1.5 rounded-lg"
                     >
                       <Sparkles size={14} />
                       <span className="hidden sm:inline">Enrich</span>
                     </Button>
                   </div>
                 )}

              {isEditing && activeCell && (
                <input
                  className="absolute z-50 border-2 border-blue-600 outline-none shadow-lg"
                  style={{
                    top: activeCell.r * scaledRowHeight,
                    left: scaledHeaderColWidth + getScaledColLeft(activeCell.c),
                    width: getScaledColWidth(activeCell.c),
                    height: scaledRowHeight,
                    fontSize: 14 * zoomLevel,
                    paddingLeft: 4 * zoomLevel,
                    paddingRight: 4 * zoomLevel,
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
        </div>

      {isProcessingAI && (
        <div className="absolute inset-0 z-[60] bg-white/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center animate-in fade-in zoom-in duration-200">
            <Loader2 className="animate-spin text-blue-600 mb-3" size={32} />
            <h3 className="font-bold text-gray-800">Thinking...</h3>
            <p className="text-sm text-gray-500">The AI is analyzing patterns & data.</p>
          </div>
        </div>
      )}

      {enrichmentTargetCol !== null && enrichmentPrompt !== null && !isProcessingAI && (
        <div className="fixed inset-0 z-[250] bg-black/40 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
              <Globe className="text-blue-500" /> Enrich Data
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Cost: <span className="font-bold text-blue-600">25 Credits</span>. 
              What info do you want for <strong>{getColumnLabel(enrichmentTargetCol)}</strong>?
            </p>
            <textarea 
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              rows={3}
              placeholder="e.g. Find the CEO, Headquarters, and Website"
              autoFocus
              value={enrichmentPrompt || ''}
              onChange={(e) => setEnrichmentPrompt(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => { setEnrichmentTargetCol(null); setEnrichmentPrompt(null); }}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button 
                onClick={handleEnrichment}
                disabled={!enrichmentPrompt}
                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Run Enrichment
              </button>
            </div>
          </div>
        </div>
      )}

      {showFilterModal && file && (
        <FilterStepModal
          columns={file.columns}
          onApply={(colIndex, operator, value) => handleApplyFilter(colIndex, operator, value)}
          onClose={() => setShowFilterModal(false)}
        />
      )}
    </div>
      {/* SIDEBAR */}
      <div 
        className="flex-shrink-0 h-full border-l border-gray-200 bg-white overflow-hidden transition-all duration-300"
        style={{ width: isSidebarOpen ? '400px' : '0px', borderLeftWidth: isSidebarOpen ? '1px' : '0px' }}
      >
        <div className="w-[400px] h-full">
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