
import React, { useState, useMemo } from 'react';
import { Upload, FileText, Tag, Plus, ArrowRight, X, AlertCircle, Check, Loader2 } from 'lucide-react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { WorkspaceContextType } from './Workspace';
import { Job, VerificationDocument, ExtractedField, LineItem } from '../types';
import { db } from '../lib/db';
import { api } from '../lib/api';
import { useToast } from './ui/toast';
import { validateFiles, formatFileSize } from '../lib/file-validation';

// Standard Fields Configuration with Metadata
const STANDARD_FIELDS = [
  { id: 'Invoice Number', label: 'Invoice Number', desc: 'Unique document ID' },
  { id: 'Date', label: 'Date', desc: 'Transaction date' },
  { id: 'Total Amount', label: 'Total Amount', desc: 'Final total with tax' },
  { id: 'Vendor Name', label: 'Vendor Name', desc: 'Merchant/Supplier' },
  { id: 'Tax Amount', label: 'Tax Amount', desc: 'VAT or Sales Tax' },
  { id: 'PO Number', label: 'PO Number', desc: 'Purchase Order ref' },
];

const ExtractionSetup: React.FC = () => {
    const { onJobCreated } = useOutletContext<WorkspaceContextType>();
    const navigate = useNavigate();
    const { addToast } = useToast();
    
    const [pendingUploads, setPendingUploads] = useState<File[]>([]);
    const [uploadErrors, setUploadErrors] = useState<Array<{ file: File; error: string }>>([]);
    const [selectedFields, setSelectedFields] = useState<string[]>(['Invoice Number', 'Date', 'Total Amount', 'Vendor Name']);
    const [customFields, setCustomFields] = useState<string[]>([]);
    const [customFieldInput, setCustomFieldInput] = useState('');
    const [includeLineItems, setIncludeLineItems] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [extractionProgress, setExtractionProgress] = useState<{
        current: number;
        total: number;
        completed: string[];
        failed: string[];
        processing: string[];
    } | null>(null);

    const allAvailableFields = useMemo(() => {
        const customObjs = customFields.map(f => ({
            id: f, label: f, desc: 'Custom Field', isCustom: true
        }));
        return [...STANDARD_FIELDS, ...customObjs];
    }, [customFields]);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        
        const files = Array.from(e.target.files);
        
        // Validate files
        const validationResult = validateFiles(files, {
            maxSize: 10 * 1024 * 1024, // 10MB
            allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'],
            allowedExtensions: ['pdf', 'png', 'jpg', 'jpeg', 'webp'],
        });
        
        // Add valid files
        if (validationResult.valid.length > 0) {
            setPendingUploads(prev => [...prev, ...validationResult.valid]);
        }
        
        // Show errors for invalid files
        if (validationResult.invalid.length > 0) {
            setUploadErrors(prev => [...prev, ...validationResult.invalid]);
            validationResult.invalid.forEach(({ file, error }) => {
                addToast('error', 'Invalid File', error);
            });
        }
        
        // Reset input
        e.target.value = '';
    };
    
    const removeUpload = (index: number) => {
        setPendingUploads(prev => prev.filter((_, i) => i !== index));
    };
    
    const clearUploadErrors = () => {
        setUploadErrors([]);
    };

    const addCustomField = () => {
        if (customFieldInput.trim()) {
            setCustomFields([...customFields, customFieldInput.trim()]);
            setSelectedFields([...selectedFields, customFieldInput.trim()]);
            setCustomFieldInput('');
        }
    };

    const runExtraction = async () => {
        if (pendingUploads.length === 0) return;
        setIsProcessing(true);
        setExtractionProgress({
            current: 0,
            total: pendingUploads.length,
            completed: [],
            failed: [],
            processing: []
        });
        
        const jobId = crypto.randomUUID();
        const newJob: Job = {
            id: jobId,
            title: `Extraction ${new Date().toLocaleDateString()}`,
            type: 'extraction',
            status: 'processing',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            fileIds: [], 
            config: { template: 'custom', fields: selectedFields, includeLineItems }
        };
        
        await db.upsertJob(newJob);

        const newDocs: VerificationDocument[] = [];
        const BATCH_SIZE = 3;

        const processFile = async (file: File): Promise<VerificationDocument | null> => {
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.readAsDataURL(file);
            });
            const response = await api.extract(base64, selectedFields, file.type || 'image/jpeg', file.name, includeLineItems);
            if (!response || !response.fields) return null;
            if (response.fields.length === 0) return null;
            const fields: ExtractedField[] = response.fields.map((f: any) => ({
                ...f,
                confidence: f.confidence ?? 0.9,
                flagged: !!f.flagged
            }));
            const lineItemsData: LineItem[] | undefined = response.lineItems?.map((li: any) => ({
                description: String(li.description ?? '').trim(),
                quantity: li.quantity ?? '',
                unitPrice: li.unitPrice ?? '',
                lineTotal: li.lineTotal ?? '',
                confidence: typeof li.confidence === 'number' ? li.confidence : 0.9
            }));
            return {
                id: crypto.randomUUID(),
                fileName: file.name,
                mimeType: file.type || 'image/jpeg',
                fileData: response.fileRef || base64,
                fields,
                lineItems: lineItemsData,
                status: 'pending'
            };
        };

        for (let i = 0; i < pendingUploads.length; i += BATCH_SIZE) {
            const batch = pendingUploads.slice(i, i + BATCH_SIZE);
            setExtractionProgress(prev => ({
                ...prev!,
                processing: batch.map(f => f.name)
            }));
            const results = await Promise.allSettled(batch.map(processFile));
            const batchCompleted: string[] = [];
            const batchFailed: string[] = [];
            for (let j = 0; j < results.length; j++) {
                const r = results[j];
                const file = batch[j];
                if (r.status === 'fulfilled' && r.value) {
                    await db.upsertVerificationDoc(r.value);
                    newDocs.push(r.value);
                    batchCompleted.push(file.name);
                } else {
                    batchFailed.push(file.name);
                }
            }
            setExtractionProgress(prev => ({
                ...prev!,
                current: prev!.completed.length + batchCompleted.length + prev!.failed.length + batchFailed.length,
                completed: [...prev!.completed, ...batchCompleted],
                failed: [...prev!.failed, ...batchFailed],
                processing: []
            }));
        }
        
        const failedNames = pendingUploads.filter(f => !newDocs.some(d => d.fileName === f.name)).map(f => f.name);

        if (newDocs.length === 0) {
            setIsProcessing(false);
            setExtractionProgress(null);
            const failedJob: Job = { ...newJob, status: 'processing', fileIds: [] };
            await db.upsertJob(failedJob);
            const firstError = failedNames.length > 0 ? failedNames[0] : 'No documents could be extracted. Please check your API key and try again.';
            addToast('error', 'Extraction Failed', firstError);
            return;
        }
        
        let riskyCount = 0;
        newDocs.forEach(d => { 
            d.fields.forEach(f => { if (f.confidence < 0.8 || f.flagged) riskyCount++; });
            d.lineItems?.forEach(li => { if ((li.confidence ?? 0.9) < 0.8) riskyCount++; });
        });

        const updatedJob: Job = { 
            ...newJob, 
            status: 'needs_review', 
            fileIds: newDocs.map(d => d.id),
            riskyCount 
        };

        await db.upsertJob(updatedJob);
        
        setIsProcessing(false);
        setExtractionProgress(null);
        
        if (failedNames.length > 0) {
            addToast(
                'warning', 
                'Extraction Complete with Issues',
                `${newDocs.length} extracted, ${failedNames.length} failed, ${riskyCount} risky fields`
            );
        } else {
            addToast(
                'success',
                'Extraction Complete',
                `${newDocs.length} document(s) extracted successfully`
            );
        }
        
        // We do NOT use onJobCreated here because we want to redirect to Review view, not Sheet view
        // But onJobCreated redirects to sheet.
        // We will just navigate manually.
        navigate(`/extract/${jobId}/review`);
    };

    if (isProcessing && extractionProgress) {
        const pct = extractionProgress.total > 0 ? Math.round((extractionProgress.current / extractionProgress.total) * 100) : 0;
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 bg-background" style={{ zoom: 0.85 }}>
                <div className="bg-card border border-border p-8 rounded-2xl shadow-lg max-w-lg w-full">
                    <div className="flex items-center justify-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-primary animate-spin" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground">AI is Analyzing Documents</h2>
                            <p className="text-sm text-muted-foreground">{extractionProgress.current} of {extractionProgress.total} complete</p>
                        </div>
                    </div>
                    <div className="w-full bg-muted h-2 rounded-full overflow-hidden mb-4">
                        <div 
                            className="bg-primary h-full transition-all duration-300 rounded-full"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                        {pendingUploads.map((file, idx) => {
                            const done = extractionProgress.completed.includes(file.name);
                            const failed = extractionProgress.failed.includes(file.name);
                            const processing = extractionProgress.processing.includes(file.name);
                            return (
                                <div key={idx} className="flex items-center gap-2 py-1.5 text-sm">
                                    {done && <Check className="w-4 h-4 text-green-600 flex-shrink-0" />}
                                    {failed && <X className="w-4 h-4 text-destructive flex-shrink-0" />}
                                    {processing && <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />}
                                    {!done && !failed && !processing && <div className="w-4 h-4 flex-shrink-0" />}
                                    <span className={`truncate flex-1 ${failed ? 'text-muted-foreground' : 'text-foreground'}`}>{file.name}</span>
                                </div>
                            );
                        })}
                    </div>
                    {extractionProgress.failed.length > 0 && (
                        <p className="mt-4 text-xs text-muted-foreground">Some files failed. You can retry later.</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col items-center justify-center p-8 bg-background overflow-y-auto" style={{ zoom: 0.85 }}>
            <div className="bg-card border border-border p-8 rounded-2xl shadow-lg max-w-4xl w-full">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-foreground mb-2">Configure Extraction</h2>
                    <p className="text-muted-foreground">Upload documents and select the data points you need.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-1">
                        <div className="border-2 border-dashed border-border rounded-xl p-6 h-full text-center hover:bg-accent/5 hover:border-accent/50 transition-colors cursor-pointer relative group flex flex-col items-center justify-center min-h-[250px]">
                            <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleUpload} />
                            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4 group-hover:scale-105 transition-transform"><Upload size={32} /></div>
                            <p className="font-bold text-foreground">Upload Files</p>
                            <p className="text-xs text-muted-foreground mt-1 mb-4">PDF, PNG, JPG, WebP (max 10MB)</p>
                            {pendingUploads.length > 0 && (
                                <div className="w-full space-y-2">
                                    <div className="bg-primary/10 text-primary py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                                        <FileText size={14}/> {pendingUploads.length} Selected
                                    </div>
                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                        {pendingUploads.map((file, idx) => (
                                            <div key={idx} className="bg-muted/50 rounded-lg p-2 flex items-center justify-between text-xs">
                                                <div className="flex-1 min-w-0 text-left">
                                                    <div className="font-medium text-foreground truncate">{file.name}</div>
                                                    <div className="text-muted-foreground">{formatFileSize(file.size)}</div>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); removeUpload(idx); }}
                                                    className="ml-2 p-1 hover:bg-destructive/10 rounded text-destructive"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="md:col-span-2 flex flex-col">
                        {uploadErrors.length > 0 && (
                            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 text-destructive font-bold text-sm">
                                        <AlertCircle size={16} />
                                        {uploadErrors.length} file(s) rejected
                                    </div>
                                    <button onClick={clearUploadErrors} className="text-destructive hover:opacity-80 text-xs">Dismiss</button>
                                </div>
                                <div className="text-xs text-destructive/90 space-y-1 max-h-20 overflow-y-auto">
                                    {uploadErrors.map((err, idx) => <div key={idx}>• {err.error}</div>)}
                                </div>
                            </div>
                        )}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Fields to Extract</h3>
                            <span className="text-xs text-muted-foreground">{selectedFields.length} selected</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-4 max-h-[260px] overflow-y-auto pr-2 custom-scrollbar">
                            {allAvailableFields.map((field) => {
                                const isSelected = selectedFields.includes(field.id);
                                return (
                                    <div
                                        key={field.id}
                                        onClick={() => isSelected ? setSelectedFields(selectedFields.filter(sf => sf !== field.id)) : setSelectedFields([...selectedFields, field.id])}
                                        className={`group relative p-3 border rounded-xl cursor-pointer transition-all flex items-start gap-3 select-none ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                                    >
                                        <div className={`p-2 rounded-lg flex-shrink-0 ${isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}><Tag size={18} /></div>
                                        <div className="flex-1 min-w-0"><div className="font-bold text-sm text-foreground">{field.label}</div><div className="text-xs text-muted-foreground truncate">{field.desc}</div></div>
                                    </div>
                                );
                            })}
                        </div>
                        <label className="flex items-center gap-2 mb-4 cursor-pointer">
                            <input type="checkbox" checked={includeLineItems} onChange={(e) => setIncludeLineItems(e.target.checked)} className="rounded border-border" />
                            <span className="text-sm font-medium text-foreground">Extract line items</span>
                            <span className="text-xs text-muted-foreground">(Description, Qty, Unit Price, Line Total)</span>
                        </label>
                        <div className="mt-auto pt-4 border-t border-border">
                            <div className="flex gap-2 mb-4">
                                <input type="text" placeholder="Add custom field..." className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm bg-background" value={customFieldInput} onChange={(e) => setCustomFieldInput(e.target.value)} />
                                <button onClick={addCustomField} disabled={!customFieldInput.trim()} className="px-4 py-2.5 bg-foreground text-background rounded-xl font-medium hover:opacity-90 disabled:opacity-50"><Plus size={18} /></button>
                            </div>
                            <button onClick={runExtraction} disabled={pendingUploads.length === 0 || selectedFields.length === 0} className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">Start Extraction <ArrowRight size={18} /></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExtractionSetup;
