
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { ExtractedField, VerificationDocument, FieldChange } from '../types';
import { Check, ChevronLeft, ChevronRight, AlertTriangle, Eye, ArrowRight, CheckCircle2, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface VerificationViewProps {
    docs: VerificationDocument[];
    onCompleteReview: (updatedDocs: VerificationDocument[]) => void;
    onSaveProgress: (updatedDocs: VerificationDocument[]) => void;
}

const VerificationView: React.FC<VerificationViewProps> = ({ docs, onCompleteReview, onSaveProgress }) => {
    const [localDocs, setLocalDocs] = useState<VerificationDocument[]>(docs);
    const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
    
    // Identify Risky Fields across ALL documents
    const riskyItems = useMemo(() => {
        const items: { docId: string; docName: string; fieldIndex: number; field: ExtractedField }[] = [];
        localDocs.forEach(doc => {
            doc.fields.forEach((field, fIdx) => {
                if (field.flagged || field.confidence < 0.8) {
                    items.push({ docId: doc.id, docName: doc.fileName, fieldIndex: fIdx, field });
                }
            });
        });
        return items;
    }, [localDocs]);

    const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
    const activeItem = riskyItems[currentReviewIndex];
    
    const activeDocId = activeItem ? activeItem.docId : (localDocs[0]?.id || null);
    const activeDoc = localDocs.find(d => d.id === activeDocId);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Resolve storage refs to signed URLs (for private Supabase Storage)
    useEffect(() => {
        let isCancelled = false;
        const run = async () => {
            if (!activeDoc) return;
            const data = activeDoc.fileData || '';
            if (!data.startsWith('storage:')) return;

            const ref = data.slice('storage:'.length);
            const [bucket, ...rest] = ref.split('/');
            const path = rest.join('/');
            if (!bucket || !path) return;

            const { data: signed, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
            if (error) return;
            if (!isCancelled && signed?.signedUrl) {
                setSignedUrls(prev => ({ ...prev, [activeDoc.id]: signed.signedUrl! }));
            }
        };
        run();
        return () => { isCancelled = true; };
    }, [activeDoc?.id, activeDoc?.fileData]);

    // Draw Image and Boxes
    useEffect(() => {
        if (!activeDoc || !canvasRef.current || !containerRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        const storageUrl = signedUrls[activeDoc.id];
        img.src = activeDoc.fileData?.startsWith('storage:')
            ? (storageUrl || '')
            : `data:${activeDoc.mimeType};base64,${activeDoc.fileData}`;
        if (!img.src) return;
        
        img.onload = () => {
            const containerWidth = containerRef.current!.clientWidth;
            const scale = containerWidth / img.width;
            
            canvas.width = containerWidth;
            canvas.height = img.height * scale;

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            if (activeItem && activeItem.docId === activeDoc.id && activeItem.field.box2d) {
                const [ymin, xmin, ymax, xmax] = activeItem.field.box2d as any;
                
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
        };
    }, [activeDoc, activeItem, containerRef.current?.clientWidth]);

    const handleUpdateValue = (val: string) => {
        if (!activeItem) return;
        
        const newDocs = localDocs.map(d => {
            if (d.id === activeItem.docId) {
                const oldField = d.fields[activeItem.fieldIndex];
                const newFields = [...d.fields];
                newFields[activeItem.fieldIndex] = { 
                    ...newFields[activeItem.fieldIndex], 
                    value: val,
                    flagged: false,
                    confidence: 1.0 
                };
                
                // Track change in audit trail
                const change: FieldChange = {
                    fieldKey: oldField.key,
                    oldValue: oldField.value,
                    newValue: val,
                    timestamp: Date.now(),
                    oldConfidence: oldField.confidence
                };
                
                const auditTrail = d.auditTrail || [];
                
                return { 
                    ...d, 
                    fields: newFields,
                    auditTrail: [...auditTrail, change]
                };
            }
            return d;
        });
        setLocalDocs(newDocs);
    };

    const handleNext = () => {
        if (currentReviewIndex < riskyItems.length - 1) {
            setCurrentReviewIndex(prev => prev + 1);
        } else {
             onCompleteReview(localDocs);
        }
    };

    if (riskyItems.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-gray-50 p-8">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md text-center animate-in fade-in zoom-in">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Review Complete</h2>
                    <p className="text-gray-500 mb-8">
                        No risky values found. All data looks good to go.
                    </p>
                    <button 
                        onClick={() => onCompleteReview(localDocs)}
                        className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg active:scale-95"
                    >
                        Approve & Export Data
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full bg-gray-100">
            {/* LEFT: DOCUMENT PREVIEW */}
            <div className="flex-1 bg-gray-800 relative overflow-hidden flex flex-col">
                <div className="h-12 bg-gray-900 text-white flex items-center justify-between px-4 text-xs font-bold border-b border-gray-700">
                    <span>{activeDoc?.fileName}</span>
                    <span className="opacity-50">Zoom: Fit</span>
                </div>
                
                <div ref={containerRef} className="flex-1 overflow-y-auto p-8 flex justify-center">
                    <canvas ref={canvasRef} className="shadow-2xl" />
                </div>
            </div>

            {/* RIGHT: FLAGGED ITEMS REVIEW */}
            <div className="w-[400px] bg-white border-l border-gray-200 flex flex-col shadow-xl z-10">
                <div className="p-6 border-b border-gray-100 bg-white">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-orange-100 text-orange-600 rounded-lg"><AlertTriangle size={18}/></div>
                            <h2 className="font-bold text-lg text-gray-800">Review Risky Items</h2>
                        </div>
                        
                        <button 
                            onClick={() => onCompleteReview(localDocs)}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                            title="Skip remaining review and export"
                        >
                            Export All <Download size={12} />
                        </button>
                    </div>
                    
                    <p className="text-xs text-gray-500 mb-2">
                        {riskyItems.length} items flagged for low confidence or formatting issues.
                    </p>
                    {localDocs.some(d => d.auditTrail && d.auditTrail.length > 0) && (
                        <p className="text-xs text-blue-600 font-medium mb-4">
                            ✏️ {localDocs.reduce((sum, d) => sum + (d.auditTrail?.length || 0), 0)} changes made
                        </p>
                    )}
                    
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                            className="bg-blue-600 h-full transition-all duration-300" 
                            style={{ width: `${((currentReviewIndex) / riskyItems.length) * 100}%` }}
                        />
                    </div>
                    <div className="text-right text-[10px] text-gray-400 mt-1">
                        {currentReviewIndex + 1} / {riskyItems.length}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                    <div className="bg-white p-4 rounded-xl border-2 border-orange-200 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                             <div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Field Name</span>
                                <span className="text-sm font-bold text-gray-700">{activeItem?.field.key}</span>
                             </div>
                             <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold">
                                {Math.round((activeItem?.field.confidence || 0) * 100)}% Conf.
                             </span>
                        </div>
                        
                        <div className="mb-4">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Extracted Value</span>
                            <input 
                                autoFocus
                                className="w-full text-lg font-bold text-gray-900 bg-gray-50 border-b-2 border-gray-200 focus:border-blue-500 outline-none py-1 transition-colors"
                                value={activeItem?.field.value || ''}
                                onChange={(e) => handleUpdateValue(e.target.value)}
                            />
                        </div>

                        <div className="text-xs text-gray-500 italic">
                            Tip: Check the highlighted box on the left.
                        </div>
                    </div>

                    {/* UPCOMING ITEMS PREVIEW */}
                    {riskyItems.length > currentReviewIndex + 1 && (
                        <div className="mt-6 opacity-50 pointer-events-none">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Up Next</h4>
                            <div className="bg-white p-3 rounded-lg border border-gray-200 mb-2">
                                <span className="text-xs font-medium text-gray-600">{riskyItems[currentReviewIndex + 1].field.key}</span>
                                <div className="text-sm font-bold text-gray-800">{riskyItems[currentReviewIndex + 1].field.value}</div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 bg-white flex justify-between items-center gap-3">
                    <button 
                         onClick={() => onSaveProgress(localDocs)}
                         className="px-4 py-3 text-gray-500 font-bold text-xs hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        Save & Exit
                    </button>

                    <button 
                        onClick={handleNext}
                        className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 hover:bg-blue-700"
                    >
                        {currentReviewIndex === riskyItems.length - 1 ? "Finish & Export" : "Approve & Next"} <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VerificationView;
