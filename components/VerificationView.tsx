
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { ExtractedField, VerificationDocument, FieldChange, LineItem } from '../types';
import { AlertTriangle, ArrowRight, CheckCircle2, Download, FileDown, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ExcelJS from 'exceljs';

type ReviewItem =
    | { type: 'field'; docId: string; docName: string; fieldIndex: number; field: ExtractedField }
    | { type: 'lineItem'; docId: string; docName: string; lineItemIndex: number; lineItem: LineItem };

interface VerificationViewProps {
    docs: VerificationDocument[];
    onCompleteReview: (updatedDocs: VerificationDocument[]) => void;
    onSaveProgress: (updatedDocs: VerificationDocument[]) => void;
}

const VerificationView: React.FC<VerificationViewProps> = ({ docs, onCompleteReview, onSaveProgress }) => {
    const [localDocs, setLocalDocs] = useState<VerificationDocument[]>(docs);
    const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
    const [imageLoaded, setImageLoaded] = useState(false);
    const [reviewMode, setReviewMode] = useState<'risky' | 'all'>('risky');
    const [isExporting, setIsExporting] = useState(false);
    
    const reviewItems = useMemo((): ReviewItem[] => {
        const items: ReviewItem[] = [];
        localDocs.forEach(doc => {
            doc.fields.forEach((field, fIdx) => {
                if (reviewMode === 'all' || field.flagged || field.confidence < 0.8) {
                    items.push({ type: 'field', docId: doc.id, docName: doc.fileName, fieldIndex: fIdx, field });
                }
            });
            doc.lineItems?.forEach((lineItem, liIdx) => {
                const conf = lineItem.confidence ?? 0.9;
                if (reviewMode === 'all' || conf < 0.8) {
                    items.push({ type: 'lineItem', docId: doc.id, docName: doc.fileName, lineItemIndex: liIdx, lineItem });
                }
            });
        });
        return items;
    }, [localDocs, reviewMode]);

    const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
    
    // Adjust index if current item was removed from reviewItems (e.g., when marked as reviewed)
    useEffect(() => {
        if (reviewItems.length === 0) return;
        // If current index is out of bounds, reset to 0 or last valid index
        if (currentReviewIndex >= reviewItems.length) {
            setCurrentReviewIndex(Math.max(0, reviewItems.length - 1));
        }
    }, [reviewItems.length, currentReviewIndex]);
    
    const activeItem = reviewItems[currentReviewIndex];
    
    const activeDocId = activeItem ? activeItem.docId : (localDocs[0]?.id ?? null);
    const activeDoc = localDocs.find(d => d.id === activeDocId);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const preloadedImagesRef = useRef<Record<string, HTMLImageElement>>({});

    // Prefetch signed URLs for ALL docs on mount (parallel) - avoids delay when switching
    useEffect(() => {
        let isCancelled = false;
        const storageDocs = localDocs.filter(d => (d.fileData || '').startsWith('storage:'));
        if (storageDocs.length === 0) return;

        const fetchAll = async () => {
            const results = await Promise.all(
                storageDocs.map(async (doc) => {
                    const ref = doc.fileData!.slice('storage:'.length);
                    const [bucket, ...rest] = ref.split('/');
                    const path = rest.join('/');
                    if (!bucket || !path) return { id: doc.id, url: null };
                    const { data: signed, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
                    if (error || !signed?.signedUrl) return { id: doc.id, url: null };
                    return { id: doc.id, url: signed.signedUrl };
                })
            );
            if (!isCancelled) {
                const urls: Record<string, string> = {};
                results.forEach(r => { if (r.url) urls[r.id] = r.url; });
                setSignedUrls(prev => ({ ...prev, ...urls }));
                // Preload images in background (browser caches them for instant display on switch)
                results.forEach(({ id, url }) => {
                    if (url && !preloadedImagesRef.current[id]) {
                        const img = new Image();
                        img.src = url;
                        preloadedImagesRef.current[id] = img;
                    }
                });
            }
        };
        fetchAll();
        return () => { isCancelled = true; };
    }, [localDocs]);

    // Draw Image and Boxes - use preloaded image if ready, else load
    useEffect(() => {
        if (!activeDoc || !canvasRef.current || !containerRef.current) return;

        setImageLoaded(false);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const isStorage = activeDoc.fileData?.startsWith('storage:');
        const storageUrl = signedUrls[activeDoc.id];
        const imgSrc = isStorage ? (storageUrl || '') : `data:${activeDoc.mimeType};base64,${activeDoc.fileData}`;
        if (!imgSrc) return;

        const drawImage = (img: HTMLImageElement) => {
            const containerWidth = containerRef.current!.clientWidth;
            const scale = containerWidth / img.width;
            canvas.width = containerWidth;
            canvas.height = img.height * scale;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            if (activeItem && activeItem.type === 'field' && activeItem.docId === activeDoc.id && activeItem.field.box2d) {
                const [ymin, xmin, ymax, xmax] = activeItem.field.box2d as number[];
                const x = (xmin / 1000) * canvas.width;
                const y = (ymin / 1000) * canvas.height;
                const w = ((xmax - xmin) / 1000) * canvas.width;
                const h = ((ymax - ymin) / 1000) * canvas.height;
                ctx.beginPath();
                ctx.rect(x - 5, y - 5, w + 10, h + 10);
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#ef4444';
                ctx.stroke();
                ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
                ctx.fill();
            }
            setImageLoaded(true);
        };

        const preloaded = preloadedImagesRef.current[activeDoc.id];
        if (preloaded && preloaded.complete && preloaded.naturalWidth > 0) {
            drawImage(preloaded);
            return;
        }

        const img = new Image();
        img.onload = () => drawImage(img);
        img.onerror = () => setImageLoaded(true);
        img.src = imgSrc;
    }, [activeDoc, activeItem, signedUrls]);

    const handleUpdateField = (val: string) => {
        if (!activeItem || activeItem.type !== 'field') return;
        const newDocs = localDocs.map(d => {
            if (d.id === activeItem.docId) {
                const oldField = d.fields[activeItem.fieldIndex];
                // Only update value during typing, don't change confidence/flagged yet
                // This prevents the field from being removed from reviewItems while user is typing
                const newFields = [...d.fields];
                newFields[activeItem.fieldIndex] = { ...newFields[activeItem.fieldIndex], value: val };
                // Only add to auditTrail if value actually changed
                if (oldField.value !== val) {
                    const change: FieldChange = { fieldKey: oldField.key, oldValue: oldField.value, newValue: val, timestamp: Date.now(), oldConfidence: oldField.confidence };
                    return { ...d, fields: newFields, auditTrail: [...(d.auditTrail || []), change] };
                }
                return { ...d, fields: newFields };
            }
            return d;
        });
        setLocalDocs(newDocs);
    };

    const handleUpdateLineItem = (key: keyof LineItem, val: string | number) => {
        if (!activeItem || activeItem.type !== 'lineItem') return;
        const newDocs = localDocs.map(d => {
            if (d.id === activeItem.docId && d.lineItems) {
                const newLineItems = [...d.lineItems];
                newLineItems[activeItem.lineItemIndex] = { ...newLineItems[activeItem.lineItemIndex], [key]: val, confidence: 1 };
                return { ...d, lineItems: newLineItems };
            }
            return d;
        });
        setLocalDocs(newDocs);
    };

    const handleDownloadXlsx = async () => {
        setIsExporting(true);
        try {
            const hasLineItems = localDocs.some(d => d.lineItems && d.lineItems.length > 0);
            let rows: any[][] = [];
            const allKeys = new Set<string>();
            localDocs.forEach(d => d.fields.forEach(f => allKeys.add(f.key)));
            const headers = Array.from(allKeys);
            if (hasLineItems) {
                rows.push(['Source File', ...headers, 'Description', 'Qty', 'Unit Price', 'Line Total']);
                localDocs.forEach(d => {
                    const headerVals: Record<string, string> = {};
                    d.fields.forEach(f => { headerVals[f.key] = String(f.value ?? ''); });
                    if (d.lineItems && d.lineItems.length > 0) {
                        d.lineItems.forEach(li => {
                            rows.push([
                                d.fileName,
                                ...headers.map(h => headerVals[h] ?? ''),
                                String(li.description ?? ''),
                                String(li.quantity ?? ''),
                                String(li.unitPrice ?? ''),
                                String(li.lineTotal ?? '')
                            ]);
                        });
                    } else {
                        rows.push([d.fileName, ...headers.map(h => headerVals[h] ?? ''), '', '', '', '']);
                    }
                });
            } else {
                rows.push(['Source File', ...headers]);
                localDocs.forEach(d => {
                    rows.push([d.fileName, ...headers.map(h => d.fields.find(f => f.key === h)?.value ?? '')]);
                });
            }
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Extracted');
            rows.forEach((row, rowIndex) => {
                const excelRow = worksheet.addRow(row);
                row.forEach((cellValue, colIndex) => {
                    excelRow.getCell(colIndex + 1).value = cellValue;
                    if (rowIndex === 0) {
                        excelRow.getCell(colIndex + 1).font = { bold: true };
                        excelRow.getCell(colIndex + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
                    }
                });
            });
            worksheet.columns.forEach((col) => {
                if (col.values) {
                    const lengths = col.values.map((v: any) => v ? String(v).length : 8);
                    const maxLen = Math.max(...lengths.filter((v: number) => !isNaN(v)), 8);
                    col.width = Math.min(maxLen + 2, 40);
                }
            });
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `extracted_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Excel export failed:', e);
        } finally {
            setIsExporting(false);
        }
    };

    const handleNext = () => {
        // Mark current item as reviewed
        if (activeItem) {
            const newDocs = localDocs.map(d => {
                if (d.id === activeItem.docId) {
                    if (activeItem.type === 'field') {
                        // Mark as reviewed: set confidence to 1.0 and flagged to false
                        const newFields = [...d.fields];
                        newFields[activeItem.fieldIndex] = { ...newFields[activeItem.fieldIndex], flagged: false, confidence: 1.0 };
                        return { ...d, fields: newFields };
                    } else if (activeItem.type === 'lineItem' && d.lineItems) {
                        const newLineItems = [...d.lineItems];
                        newLineItems[activeItem.lineItemIndex] = { ...newLineItems[activeItem.lineItemIndex], confidence: 1 };
                        return { ...d, lineItems: newLineItems };
                    }
                }
                return d;
            });
            setLocalDocs(newDocs);
        }
        
        // Move to next item
        // If we're at the last item, stay at current index (it will point to next after current is removed)
        // Otherwise, increment to next
        if (currentReviewIndex < reviewItems.length - 1) {
            setCurrentReviewIndex(prev => prev + 1);
        }
        // If at last item, the useEffect will adjust the index after the item is removed
    };

    if (reviewItems.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-background p-8">
                <div className="bg-card border border-border p-8 rounded-2xl shadow-lg max-w-md text-center">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">Review Complete</h2>
                    <p className="text-muted-foreground mb-6">No risky values found. All data looks good to go.</p>
                    <div className="flex gap-3">
                        <button
                            onClick={handleDownloadXlsx}
                            disabled={isExporting}
                            className="flex-1 py-3 px-4 border border-border rounded-xl font-bold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2"
                        >
                            <FileDown size={18} /> Download .xlsx
                        </button>
                        <button
                            onClick={() => onCompleteReview(localDocs)}
                            className="flex-1 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors"
                        >
                            Approve & Export Data
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const nextItem = reviewItems[currentReviewIndex + 1];
    const nextLabel = nextItem?.type === 'field' ? nextItem.field.key : (nextItem?.type === 'lineItem' ? 'Line item' : '');

    return (
        <div className="flex h-full bg-background">
            <div className="flex-1 bg-zinc-900 relative overflow-hidden flex flex-col">
                <div className="h-12 bg-zinc-950 text-zinc-100 flex items-center justify-between px-4 text-xs font-bold border-b border-zinc-700">
                    <span>{activeDoc?.fileName}</span>
                    <span className="text-zinc-500">Zoom: Fit</span>
                </div>
                <div ref={containerRef} className="flex-1 overflow-y-auto p-8 flex justify-center items-center relative">
                    <canvas ref={canvasRef} className="shadow-2xl rounded-lg" />
                    {!imageLoaded && (
                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
                            <Loader2 className="w-10 h-10 text-white animate-spin" />
                        </div>
                    )}
                </div>
            </div>

            <div className="w-[420px] bg-card border-l border-border flex flex-col shadow-xl z-10">
                <div className="p-6 border-b border-border">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-orange-100 text-orange-600 rounded-lg"><AlertTriangle size={18}/></div>
                            <h2 className="font-bold text-lg text-foreground">Review Items</h2>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={handleDownloadXlsx} disabled={isExporting} className="text-xs font-bold text-primary hover:bg-primary/10 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1" title="Download as Excel">
                                <FileDown size={12} /> .xlsx
                            </button>
                            <button onClick={() => onCompleteReview(localDocs)} className="text-xs font-bold text-primary hover:bg-primary/10 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1" title="Skip remaining review and export">
                                Export All <Download size={12} />
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-1 p-1 bg-muted rounded-lg mb-3">
                        <button onClick={() => setReviewMode('risky')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${reviewMode === 'risky' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Risky only</button>
                        <button onClick={() => setReviewMode('all')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${reviewMode === 'all' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>All fields</button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                        {reviewItems.length} item{reviewItems.length !== 1 ? 's' : ''} to review
                    </p>
                    {localDocs.some(d => d.auditTrail && d.auditTrail.length > 0) && (
                        <p className="text-xs text-primary font-medium mb-2">
                            {localDocs.reduce((sum, d) => sum + (d.auditTrail?.length || 0), 0)} changes made
                        </p>
                    )}
                    <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                        <div className="bg-primary h-full transition-all duration-300" style={{ width: `${reviewItems.length > 0 ? (currentReviewIndex / reviewItems.length) * 100 : 0}%` }} />
                    </div>
                    <div className="text-right text-[10px] text-muted-foreground mt-1">{currentReviewIndex + 1} / {reviewItems.length}</div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-muted/30">
                    {activeItem?.type === 'field' ? (
                        <div className="bg-card p-4 rounded-xl border-2 border-orange-200 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Field</span>
                                <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold">
                                    {Math.round((activeItem.field.confidence || 0) * 100)}% Conf.
                                </span>
                            </div>
                            <div className="text-sm font-bold text-foreground mb-3">{activeItem.field.key}</div>
                            <input 
                                key={`${activeItem.docId}-${activeItem.fieldIndex}-${activeItem.field.key}`}
                                autoFocus 
                                className="w-full text-lg font-bold text-foreground bg-muted/50 border-b-2 border-border focus:border-primary outline-none py-1 transition-colors rounded" 
                                value={activeItem.field.value || ''} 
                                onChange={(e) => handleUpdateField(e.target.value)} 
                            />
                            <p className="text-xs text-muted-foreground mt-2 italic">Check the highlighted box on the left.</p>
                        </div>
                    ) : activeItem?.type === 'lineItem' ? (
                        <div className="bg-card p-4 rounded-xl border-2 border-orange-200 shadow-sm space-y-3">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Line Item</span>
                                <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold">
                                    {Math.round((activeItem.lineItem.confidence ?? 0.9) * 100)}% Conf.
                                </span>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Description</label>
                                <input className="w-full text-sm bg-muted/50 border border-border rounded px-2 py-1.5" value={String(activeItem.lineItem.description ?? '')} onChange={(e) => handleUpdateLineItem('description', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Qty</label>
                                    <input className="w-full text-sm bg-muted/50 border border-border rounded px-2 py-1.5" value={String(activeItem.lineItem.quantity ?? '')} onChange={(e) => handleUpdateLineItem('quantity', e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Unit Price</label>
                                    <input className="w-full text-sm bg-muted/50 border border-border rounded px-2 py-1.5" value={String(activeItem.lineItem.unitPrice ?? '')} onChange={(e) => handleUpdateLineItem('unitPrice', e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Line Total</label>
                                    <input className="w-full text-sm bg-muted/50 border border-border rounded px-2 py-1.5" value={String(activeItem.lineItem.lineTotal ?? '')} onChange={(e) => handleUpdateLineItem('lineTotal', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {nextItem && (
                        <div className="mt-6 opacity-60 pointer-events-none">
                            <h4 className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Up Next</h4>
                            <div className="bg-card p-3 rounded-lg border border-border">
                                <span className="text-xs font-medium text-muted-foreground">{nextLabel}</span>
                                <div className="text-sm font-bold text-foreground">
                                    {nextItem.type === 'field' ? nextItem.field.value : (nextItem.type === 'lineItem' ? nextItem.lineItem.description : '')}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-border flex justify-between items-center gap-3">
                    <button onClick={() => onSaveProgress(localDocs)} className="px-4 py-3 text-muted-foreground font-bold text-xs hover:bg-muted rounded-xl transition-colors">Save & Exit</button>
                    <button onClick={handleNext} className="flex-1 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 hover:bg-primary/90">
                        {currentReviewIndex === reviewItems.length - 1 ? 'Finish & Export' : 'Approve & Next'} <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VerificationView;
