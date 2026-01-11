
import React, { useState, useMemo } from 'react';
import { Upload, FileText, Tag, Trash2, Plus, ArrowRight } from 'lucide-react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { WorkspaceContextType } from './Workspace';
import { Job, VerificationDocument, ExtractedField } from '../types';
import { db } from '../lib/db';
import { api } from '../lib/api';

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
    
    const [pendingUploads, setPendingUploads] = useState<File[]>([]);
    const [selectedFields, setSelectedFields] = useState<string[]>(['Invoice Number', 'Date', 'Total Amount', 'Vendor Name']);
    const [customFields, setCustomFields] = useState<string[]>([]);
    const [customFieldInput, setCustomFieldInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const allAvailableFields = useMemo(() => {
        const customObjs = customFields.map(f => ({
            id: f, label: f, desc: 'Custom Field', isCustom: true
        }));
        return [...STANDARD_FIELDS, ...customObjs];
    }, [customFields]);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) setPendingUploads(prev => [...prev, ...Array.from(e.target.files!)]);
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

        for (const file of pendingUploads) {
            try {
               const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.readAsDataURL(file);
               });
               
               const response = await api.extract(base64, selectedFields, file.type || 'image/jpeg');
               const fields: ExtractedField[] = response.fields.map((f: any) => ({
                   ...f,
                   confidence: f.confidence || 0.9, 
                   flagged: false
               }));

               const doc: VerificationDocument = {
                   id: crypto.randomUUID(),
                   fileName: file.name,
                   mimeType: file.type || 'image/jpeg',
                   fileData: base64,
                   fields: fields,
                   status: 'pending'
               };
               
               await db.upsertVerificationDoc(doc);
               newDocs.push(doc);
            } catch (err) { console.error(err); }
        }
        
        let riskyCount = 0;
        newDocs.forEach(d => { d.fields.forEach(f => { if(f.confidence < 0.8) riskyCount++; }); });

        const updatedJob: Job = { 
            ...newJob, 
            status: 'needs_review', 
            fileIds: newDocs.map(d => d.id),
            riskyCount 
        };

        await db.upsertJob(updatedJob);
        // We do NOT use onJobCreated here because we want to redirect to Review view, not Sheet view
        // But onJobCreated redirects to sheet.
        // We will just navigate manually.
        navigate(`/extract/${jobId}/review`);
    };

    if (isProcessing) {
        return (
            <div className="h-full flex flex-col items-center justify-center">
                <div className="animate-spin text-blue-600 mb-4"><Upload size={48} /></div>
                <h2 className="text-xl font-bold text-gray-900">AI is Analyzing Documents...</h2>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col items-center justify-center p-8 bg-gray-50/50 overflow-y-auto">
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
                            <input type="file" multiple accept=".pdf,.png,.jpg" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleUpload} />
                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Upload size={32} /></div>
                            <p className="font-bold text-gray-900">Upload Files</p>
                            <p className="text-xs text-gray-400 mt-1 mb-4">PDF, PNG, JPG</p>
                            {pendingUploads.length > 0 && <div className="w-full bg-blue-50 text-blue-700 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2"><FileText size={14}/> {pendingUploads.length} Selected</div>}
                        </div>
                    </div>

                    <div className="md:col-span-2 flex flex-col">
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
