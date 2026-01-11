
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VerificationView from './VerificationView';
import { db } from '../lib/db';
import { VerificationDocument, Job, ExcelFile } from '../types';
import { Loader2 } from 'lucide-react';
import { useToast } from './ui/Toast';

const VerificationPage: React.FC = () => {
    const { id } = useParams<{ id: string }>(); // Job ID
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [job, setJob] = useState<Job | null>(null);
    const [docs, setDocs] = useState<VerificationDocument[]>([]);

    useEffect(() => {
        if (!id) return;
        const load = async () => {
            try {
                const j = await db.getJob(id);
                if (j) {
                    setJob(j);
                    // If job is already converted to spreadsheet, redirect
                    if (j.type === 'spreadsheet' && j.status === 'verified') {
                        navigate(`/sheet/${j.id}`);
                        return;
                    }
                    const d = await db.fetchVerificationDocs(j.fileIds);
                    setDocs(d);
                }
            } catch (e) {
                console.error(e);
                addToast('error', 'Error loading documents');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, navigate, addToast]);

    const handleSave = async (updatedDocs: VerificationDocument[]) => {
        try {
            // Save all docs
            await Promise.all(updatedDocs.map(d => db.upsertVerificationDoc(d)));
            
            // Update job stats
            if (job) {
                 let riskyCount = 0;
                 updatedDocs.forEach(d => { d.fields.forEach(f => { if(f.confidence < 0.8 || f.flagged) riskyCount++; }); });
                 const updatedJob = { ...job, riskyCount, updatedAt: Date.now() };
                 await db.upsertJob(updatedJob);
            }
            addToast('success', 'Progress Saved');
        } catch (e) {
            addToast('error', 'Failed to save');
        }
    };

    const handleComplete = async (updatedDocs: VerificationDocument[]) => {
        if (!job) return;
        setLoading(true);
        try {
            await Promise.all(updatedDocs.map(d => db.upsertVerificationDoc(d)));
            
            // Convert extracted data to Excel File
            const flattenedData: any[][] = [];
            
            // Collect all unique headers
            const allKeys = new Set<string>();
            updatedDocs.forEach(d => d.fields.forEach(f => allKeys.add(f.key)));
            const headers = Array.from(allKeys);
            
            // Build Grid: Header Row
            flattenedData.push(['Source File', ...headers]);

            // Build Grid: Data Rows
            updatedDocs.forEach(d => {
                const row = [d.fileName];
                headers.forEach(h => {
                    const field = d.fields.find(f => f.key === h);
                    row.push(field ? field.value : '');
                });
                flattenedData.push(row);
            });

            // Create new Excel File entry
            const newFileId = crypto.randomUUID();
            const newFile: ExcelFile = {
                id: newFileId,
                name: `${job.title} (Extracted)`,
                data: flattenedData,
                columns: ['Source File', ...headers],
                styles: {},
                lastModified: Date.now(),
                history: [{ data: flattenedData, styles: {} }],
                currentHistoryIndex: 0
            };
            await db.upsertFile(newFile);

            // Update Job to point to this new spreadsheet file and mark complete
            const completedJob: Job = {
                ...job,
                status: 'verified',
                fileIds: [newFileId], // Replaces verification doc IDs with the new Spreadsheet ID
                type: 'spreadsheet', // Switch type to spreadsheet view
                updatedAt: Date.now()
            };
            await db.upsertJob(completedJob);

            addToast('success', 'Extraction Complete', 'Redirecting to spreadsheet editor...');
            navigate(`/sheet/${job.id}`);
        } catch (e) {
            console.error(e);
            addToast('error', 'Export Failed', 'Could not convert to spreadsheet.');
            setLoading(false);
        }
    };

    if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;
    if (!job || docs.length === 0) return <div className="p-8 text-center text-gray-500">Document data not found.</div>;

    return <VerificationView docs={docs} onSaveProgress={handleSave} onCompleteReview={handleComplete} />;
};

export default VerificationPage;
