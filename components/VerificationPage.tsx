
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import VerificationView from './VerificationView';
import { db } from '../lib/db';
import { WorkspaceContextType } from './Workspace';
import { VerificationDocument, Job, ExcelFile } from '../types';
import { Loader2 } from 'lucide-react';
import { useToast } from './ui/toast';

const VerificationPage: React.FC = () => {
    const { id } = useParams<{ id: string }>(); // Job ID
    const navigate = useNavigate();
    const { refreshData, documentsUsed, documentsLimit } = useOutletContext<WorkspaceContextType>();
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
            
            if (job) {
                let riskyCount = 0;
                updatedDocs.forEach(d => {
                    d.fields.forEach(f => { if (f.confidence < 0.8 || f.flagged) riskyCount++; });
                    d.lineItems?.forEach(li => { if ((li.confidence ?? 0.9) < 0.8) riskyCount++; });
                });
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
            
            const flattenedData: any[][] = [];
            const allKeys = new Set<string>();
            updatedDocs.forEach(d => d.fields.forEach(f => allKeys.add(f.key)));
            const headers = Array.from(allKeys);
            const hasLineItems = updatedDocs.some(d => d.lineItems && d.lineItems.length > 0);

            if (hasLineItems) {
                flattenedData.push(['Source File', ...headers, 'Description', 'Qty', 'Unit Price', 'Line Total']);
                updatedDocs.forEach(d => {
                    const headerVals: Record<string, string> = {};
                    d.fields.forEach(f => { headerVals[f.key] = String(f.value ?? ''); });
                    if (d.lineItems && d.lineItems.length > 0) {
                        d.lineItems.forEach(li => {
                            flattenedData.push([
                                d.fileName,
                                ...headers.map(h => headerVals[h] ?? ''),
                                String(li.description ?? ''),
                                String(li.quantity ?? ''),
                                String(li.unitPrice ?? ''),
                                String(li.lineTotal ?? '')
                            ]);
                        });
                    } else {
                        flattenedData.push([d.fileName, ...headers.map(h => headerVals[h] ?? ''), '', '', '', '']);
                    }
                });
            } else {
                flattenedData.push(['Source File', ...headers]);
                updatedDocs.forEach(d => {
                    flattenedData.push([
                        d.fileName,
                        ...headers.map(h => d.fields.find(f => f.key === h)?.value ?? '')
                    ]);
                });
            }

            const columns = hasLineItems ? ['Source File', ...headers, 'Description', 'Qty', 'Unit Price', 'Line Total'] : ['Source File', ...headers];
            const newFileId = crypto.randomUUID();
            const newFile: ExcelFile = {
                id: newFileId,
                name: `${job.title} (Extracted)`,
                data: flattenedData,
                columns,
                styles: {},
                lastModified: Date.now(),
                history: [{ data: flattenedData, styles: {}, columns }],
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

            if (refreshData) refreshData();
            const showUpgradeCta = documentsLimit <= 20 || (documentsLimit > 0 && (documentsUsed ?? 0) >= documentsLimit * 0.5);
            addToast(
                'success',
                'Extraction Complete',
                'Redirecting to spreadsheet editor...',
                showUpgradeCta ? { label: 'Upgrade for more docs', onClick: () => navigate('/pricing') } : undefined
            );
            navigate(`/sheet/${job.id}`);
        } catch (e) {
            console.error(e);
            addToast('error', 'Export Failed', 'Could not convert to spreadsheet.');
            setLoading(false);
        }
    };

    if (loading) return <div className="h-full flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" size={40} /></div>;
    if (!job || docs.length === 0) return <div className="p-8 text-center text-muted-foreground bg-background">Document data not found.</div>;

    return <VerificationView docs={docs} onSaveProgress={handleSave} onCompleteReview={handleComplete} />;
};

export default VerificationPage;
