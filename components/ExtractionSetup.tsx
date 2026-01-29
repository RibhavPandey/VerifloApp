
import React, { useState, useMemo } from 'react';
import { Upload, FileText, Tag, Trash2, Plus, ArrowRight, X, AlertCircle } from 'lucide-react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { WorkspaceContextType } from './Workspace';
import { Job, VerificationDocument, ExtractedField } from '../types';
import { db } from '../lib/db';
import { api } from '../lib/api';
import { useToast } from './ui/toast';
import { validateFiles, formatFileSize, isImageFile, isPDFFile } from '../lib/file-validation';

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
    const [isProcessing, setIsProcessing] = useState(false);
    const [extractionProgress, setExtractionProgress] = useState<{
        current: number;
        total: number;
        fileName: string;
        failed: string[];
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
            fileName: '',
            failed: []
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
            config: { template: 'custom', fields: selectedFields }
        };
        
        await db.upsertJob(newJob);

        const newDocs: VerificationDocument[] = [];

        let extractionErrors: string[] = [];
        
        for (let i = 0; i < pendingUploads.length; i++) {
            const file = pendingUploads[i];
            setExtractionProgress(prev => ({
                ...prev!,
                current: i + 1,
                fileName: file.name
            }));
            try {
               const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.readAsDataURL(file);
               });
               
               const response = await api.extract(base64, selectedFields, file.type || 'image/jpeg', file.name);
               
               if (!response || !response.fields) {
                   extractionErrors.push(`${file.name}: Invalid response from server`);
                   continue;
               }
               
               if (response.fields.length === 0) {
                   extractionErrors.push(`${file.name}: No fields extracted`);
                   continue;
               }
               
               const fields: ExtractedField[] = response.fields.map((f: any) => ({
                   ...f,
                   confidence: f.confidence || 0.9, 
                   flagged: false
               }));

               const doc: VerificationDocument = {
                   id: crypto.randomUUID(),
                   fileName: file.name,
                   mimeType: file.type || 'image/jpeg',
                   fileData: response.fileRef || base64,
                   fields: fields,
                   status: 'pending'
               };
               
               await db.upsertVerificationDoc(doc);
               newDocs.push(doc);
            } catch (err: any) { 
                console.error(`Extraction error for ${file.name}:`, err);
                const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                extractionErrors.push(`${file.name}: ${errorMsg}`);
                setExtractionProgress(prev => ({
                    ...prev!,
                    failed: [...prev!.failed, file.name]
                }));
            }
        }
        
        // Check if any documents were successfully extracted
        if (newDocs.length === 0) {
            setIsProcessing(false);
            setExtractionProgress(null);
            // Update job status to indicate failure
            const failedJob: Job = { 
                ...newJob, 
                status: 'processing', 
                fileIds: []
            };
            await db.upsertJob(failedJob);
            
            // Show error to user via toast
            const firstError = extractionErrors.length > 0 
                ? extractionErrors[0]
                : 'No documents could be extracted. Please check your API key and try again.';
            addToast('error', 'Extraction Failed', firstError);
            return;
        }
        
        let riskyCount = 0;
        newDocs.forEach(d => { 
            d.fields.forEach(f => { 
                if(f.confidence < 0.8) riskyCount++; 
            }); 
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
        
        // Show completion summary via toast
        if (extractionErrors.length > 0) {
            addToast(
                'warning', 
                'Extraction Complete with Issues',
                `${newDocs.length} extracted, ${extractionErrors.length} failed, ${riskyCount} risky fields`
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
        return (
            <div className="h-full flex flex-col items-center justify-center p-8" style={{ zoom: 0.85 }}>
                <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-lg w-full">
                    <div className="animate-spin text-blue-600 mb-4 mx-auto w-12 h-12 flex items-center justify-center">
                        <Upload size={48} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
                        AI is Analyzing Documents...
                    </h2>
                    <p className="text-sm text-gray-500 text-center mb-6">
                        Processing: {extractionProgress.fileName}
                    </p>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden mb-2">
                        <div 
                            className="bg-blue-600 h-full transition-all duration-300"
                            style={{ width: `${(extractionProgress.current / extractionProgress.total) * 100}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mb-4">
                        <span>{extractionProgress.current} of {extractionProgress.total}</span>
                        <span>{Math.round((extractionProgress.current / extractionProgress.total) * 100)}%</span>
                    </div>
                    
                    {extractionProgress.failed.length > 0 && (
                        <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <p className="text-xs font-bold text-orange-700 mb-1">
                                ⚠️ {extractionProgress.failed.length} file(s) failed
                            </p>
                            <div className="text-xs text-orange-600 max-h-20 overflow-y-auto">
                                {extractionProgress.failed.map((name, idx) => (
                                    <div key={idx}>• {name}</div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col items-center justify-center p-8 bg-gray-50/50 overflow-y-auto" style={{ zoom: 0.85 }}>
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-4xl w-full">
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Configure Extraction</h2>
                        <p className="text-gray-500">Upload documents and select the data points you need.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-1">
                        <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 h-full text-center hover:bg-gray-50 transition-colors cursor-pointer relative group flex flex-col items-center justify-center min-h-[250px]">
                            <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleUpload} />
                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Upload size={32} /></div>
                            <p className="font-bold text-gray-900">Upload Files</p>
                            <p className="text-xs text-gray-400 mt-1 mb-4">PDF, PNG, JPG, WebP (max 10MB)</p>
                            {pendingUploads.length > 0 && (
                                <div className="w-full space-y-2">
                                    <div className="bg-blue-50 text-blue-700 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                                        <FileText size={14}/> {pendingUploads.length} Selected
                                    </div>
                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                        {pendingUploads.map((file, idx) => (
                                            <div key={idx} className="bg-gray-50 rounded-lg p-2 flex items-center justify-between text-xs">
                                                <div className="flex-1 min-w-0 text-left">
                                                    <div className="font-medium text-gray-700 truncate">{file.name}</div>
                                                    <div className="text-gray-500">{formatFileSize(file.size)}</div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeUpload(idx);
                                                    }}
                                                    className="ml-2 p-1 hover:bg-red-100 rounded text-red-600"
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
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                                        <AlertCircle size={16} />
                                        {uploadErrors.length} file(s) rejected
                                    </div>
                                    <button
                                        onClick={clearUploadErrors}
                                        className="text-red-600 hover:text-red-800 text-xs"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                                <div className="text-xs text-red-600 space-y-1 max-h-20 overflow-y-auto">
                                    {uploadErrors.map((err, idx) => (
                                        <div key={idx}>• {err.error}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="flex items-center justify-between mb-4"><h3 className="text-xs font-bold uppercase text-gray-500 tracking-wider">Fields to Extract</h3><span className="text-xs text-gray-400">{selectedFields.length} selected</span></div>
                        <div className="grid grid-cols-2 gap-3 mb-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {allAvailableFields.map((field) => {
                                const isSelected = selectedFields.includes(field.id);
                                return (
                                    <div key={field.id} onClick={() => isSelected ? setSelectedFields(selectedFields.filter(sf => sf !== field.id)) : setSelectedFields([...selectedFields, field.id])} className={`group relative p-3 border rounded-xl cursor-pointer transition-all flex items-start gap-3 select-none ${isSelected ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200 hover:bg-gray-50'}`}>
                                        <div className={`p-2 rounded-lg flex-shrink-0 ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}><Tag size={18} /></div>
                                        <div className="flex-1 min-w-0"><div className="font-bold text-sm">{field.label}</div><div className="text-xs text-gray-400 truncate">{field.desc}</div></div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        <div className="mt-auto pt-4 border-t border-gray-100">
                            <div className="flex gap-2 mb-6">
                                <input type="text" placeholder="Add custom field..." className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm" value={customFieldInput} onChange={(e) => setCustomFieldInput(e.target.value)} />
                                <button onClick={addCustomField} disabled={!customFieldInput.trim()} className="px-4 py-2.5 bg-gray-900 text-white rounded-xl font-medium"><Plus size={18} /></button>
                            </div>
                            <button onClick={runExtraction} disabled={pendingUploads.length === 0 || selectedFields.length === 0} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">Start Extraction <ArrowRight size={18} /></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExtractionSetup;
