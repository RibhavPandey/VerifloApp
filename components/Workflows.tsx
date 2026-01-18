
import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Plus, ScanText, FileSpreadsheet, Play, Trash2, Loader2, Workflow as WorkflowIcon, Zap } from 'lucide-react';
import { db } from '../lib/db';
import { Workflow, ExcelFile, Job } from '../types';
import { useToast } from './ui/toast';
import { WorkspaceContextType } from './Workspace';

const Workflows: React.FC = () => {
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [runningWorkflowId, setRunningWorkflowId] = useState<string | null>(null);
    const { addToast } = useToast();
    const navigate = useNavigate();
    const { files, jobs, credits, handleUseCredit, onCreateWorkflow, refreshData, onJobCreated } = useOutletContext<WorkspaceContextType>();

    useEffect(() => {
        db.fetchWorkflows().then(setWorkflows);
    }, []);

    const getActiveFile = (): ExcelFile | null => {
        const jobId = window.location.pathname.match(/\/sheet\/([^\/]+)/)?.[1];
        if (!jobId) return null;
        const job = jobs.find(j => j.id === jobId);
        if (!job || job.fileIds.length === 0) return null;
        return files.find(f => f.id === job.fileIds[0]) || null;
    };

    const runWorkflow = async (workflow: Workflow, targetFile: ExcelFile): Promise<ExcelFile> => {
        if (!workflow.steps || workflow.steps.length === 0) {
            addToast('error', 'Invalid Workflow', 'Workflow has no steps to execute.');
            return targetFile;
        }

        addToast('info', 'Running Workflow', `Executing ${workflow.name}...`);
        let data = targetFile.data.map(row => [...row]);
        let columns = [...targetFile.columns];

        const deleteColSteps = workflow.steps.filter(s => s.type === 'delete_col').sort((a, b) => b.params.colIndex - a.params.colIndex);
        const deleteRowSteps = workflow.steps.filter(s => s.type === 'delete_row').sort((a, b) => b.params.rowIndex - a.params.rowIndex);
        const otherSteps = workflow.steps.filter(s => s.type !== 'delete_col' && s.type !== 'delete_row');

        try {
            for (const step of otherSteps) {
                try {
                    if (step.type === 'sort') {
                         const { action, r1, c1, r2, c2 } = step.params;
                         if (r1 < 0 || r2 >= data.length || c1 < 0 || c2 >= (data[0]?.length || 0)) {
                             continue;
                         }
                         for(let r = r1; r <= r2; r++) {
                             for(let c = c1; c <= c2; c++) {
                                 if (data[r] && data[r][c] !== undefined) {
                                     let val = data[r][c];
                                     if (typeof val === 'string') {
                                         if (action === 'trim') val = val.trim();
                                         if (action === 'upper') val = val.toUpperCase();
                                         if (action === 'lower') val = val.toLowerCase();
                                         if (action === 'title') {
                                             val = val.toLowerCase().split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                                         }
                                     }
                                     data[r][c] = val;
                                 }
                             }
                         }
                    }
                    if (step.type === 'enrich') {
                         const { prompt, colIndex } = step.params;
                         const targetCol = colIndex !== undefined ? colIndex : 0;
                         if (targetCol >= 0 && targetCol < (data[0]?.length || 0) && prompt) {
                             try {
                                 const sourceData = data.slice(1).map(r => r[targetCol]).filter(v => v !== undefined && v !== null && v !== '');
                                 const allUniqueItems = Array.from(new Set(sourceData.map(v => String(v).trim())));
                                 
                            if (allUniqueItems.length > 0) {
                                     const { api } = await import('../lib/api');
                                     const BATCH_SIZE = 100;
                                     const numBatches = Math.ceil(allUniqueItems.length / BATCH_SIZE);
                                     const batchCost = numBatches * 25;
                                     
                                     if (credits < batchCost) {
                                         addToast('error', 'Insufficient Credits', `Enrichment requires ${batchCost} credits.`);
                                         continue;
                                     }
                                     
                                     const mergedResult: Record<string, any> = {};
                                     
                                     for (let i = 0; i < allUniqueItems.length; i += BATCH_SIZE) {
                                         const batch = allUniqueItems.slice(i, i + BATCH_SIZE);
                                         try {
                                             const response = await api.enrich(batch, prompt);
                                             Object.assign(mergedResult, response.result);
                                         } catch (batchError: any) {
                                            if (batchError?.message?.includes('Insufficient credits')) break;
                                         }
                                     }
                                     
                                     const lookupMap = new Map<string, any>();
                                     for (const [key, value] of Object.entries(mergedResult)) {
                                         const normalizedKey = String(key).trim().toLowerCase();
                                         lookupMap.set(normalizedKey, value);
                                     }
                                     
                                     const newColIdx = data[0].length;
                                     data[0][newColIdx] = "Enriched Info";
                                     columns.push("Enriched Info");
                                     
                                     for(let r = 1; r < data.length; r++) {
                                         if (!data[r]) data[r] = [];
                                         const cellValue = data[r][targetCol];
                                         
                                         if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
                                             let enrichedValue = mergedResult[cellValue] || mergedResult[String(cellValue)];
                                             
                                             if (enrichedValue === undefined) {
                                                 const normalizedCellValue = String(cellValue).trim().toLowerCase();
                                                 enrichedValue = lookupMap.get(normalizedCellValue);
                                             }
                                             
                                             if (enrichedValue !== undefined) {
                                                 data[r][newColIdx] = typeof enrichedValue === 'object' ? JSON.stringify(enrichedValue) : enrichedValue;
                                             }
                                         }
                                     }
                                 }
                             } catch (enrichError: any) {
                                 addToast('warning', 'Enrichment Failed', `Step "${step.description}" failed`);
                             }
                         }
                    }
                    if (step.type === 'formula') {
                         const { formula, rowIndex, colIndex } = step.params;
                         if (formula && rowIndex >= 0 && rowIndex < data.length && colIndex >= 0 && colIndex < (data[0]?.length || 0)) {
                             if (!data[rowIndex]) data[rowIndex] = [];
                             data[rowIndex][colIndex] = formula;
                         }
                    }
                    if (step.type === 'filter') {
                         const { colIndex, operator, value } = step.params;
                         if (colIndex >= 0 && colIndex < (data[0]?.length || 0) && operator && value !== undefined) {
                             const headerRow = data[0];
                             const filteredData = [headerRow];
                             
                             for (let r = 1; r < data.length; r++) {
                                 if (!data[r]) continue;
                                 const cellValue = data[r][colIndex];
                                 let shouldInclude = false;
                                 
                                 if (operator === 'equals') shouldInclude = String(cellValue) === String(value);
                                 else if (operator === 'contains') shouldInclude = String(cellValue).toLowerCase().includes(String(value).toLowerCase());
                                 else if (operator === 'greater') shouldInclude = Number(cellValue) > Number(value);
                                 else if (operator === 'less') shouldInclude = Number(cellValue) < Number(value);
                                 else if (operator === 'not_empty') shouldInclude = cellValue !== undefined && cellValue !== null && cellValue !== '';
                                 else if (operator === 'empty') shouldInclude = cellValue === undefined || cellValue === null || cellValue === '';
                                 
                                 if (shouldInclude) filteredData.push(data[r]);
                             }
                             data = filteredData;
                         }
                    }
                } catch (stepError: any) {
                    addToast('warning', 'Step Failed', `Step "${step.description}" failed`);
                }
            }

            for (const step of deleteColSteps) {
                try {
                    const { colIndex } = step.params;
                    if (colIndex >= 0 && colIndex < (data[0]?.length || 0)) {
                        data = data.map(row => row.filter((_, i) => i !== colIndex));
                        if (columns && columns.length > colIndex) {
                            columns = columns.filter((_, i) => i !== colIndex);
                        }
                    }
                } catch (stepError: any) {
                    addToast('warning', 'Step Failed', `Delete column step failed`);
                }
            }

            for (const step of deleteRowSteps) {
                try {
                    const { rowIndex } = step.params;
                    if (rowIndex >= 0 && rowIndex < data.length) {
                        data = data.filter((_, i) => i !== rowIndex);
                    }
                } catch (stepError: any) {
                    addToast('warning', 'Step Failed', `Delete row step failed`);
                }
            }

            const updatedFile = { ...targetFile, data, columns, lastModified: Date.now() };
            await db.upsertFile(updatedFile);

            const updatedWorkflow = { ...workflow, lastRun: Date.now(), lastRunStatus: 'success' as const };
            await db.upsertWorkflow(updatedWorkflow);
            setWorkflows(prev => prev.map(w => w.id === workflow.id ? updatedWorkflow : w));

            addToast('success', 'Workflow Completed', 'Changes applied successfully.');
            
            return updatedFile;
        } catch (error: any) {
            const updatedWorkflow = { ...workflow, lastRun: Date.now(), lastRunStatus: 'failed' as const };
            await db.upsertWorkflow(updatedWorkflow);
            setWorkflows(prev => prev.map(w => w.id === workflow.id ? updatedWorkflow : w));
            addToast('error', 'Workflow Failed', `Workflow execution failed`);
            return targetFile;
        }
    };

    const handleRun = async (wf: Workflow) => {
        if (wf.sourceType === 'spreadsheet') {
            const activeFile = getActiveFile();
            if (activeFile) {
                setRunningWorkflowId(wf.id);
                try {
                    await runWorkflow(wf, activeFile);
                    if (refreshData) refreshData();
                    const currentJobId = window.location.pathname.match(/\/sheet\/([^\/]+)/)?.[1];
                    if (!currentJobId) {
                        const job = jobs.find(j => j.fileIds.includes(activeFile.id));
                        if (job) navigate(`/sheet/${job.id}`);
                    }
                } finally {
                    setRunningWorkflowId(null);
                }
            } else {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.xlsx,.csv';
                input.onchange = async (e: any) => {
                    const fileList = e.target.files;
                    if (!fileList) return;
                    const file = fileList[0];
                    setRunningWorkflowId(wf.id);
                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                        const ab = ev.target?.result as ArrayBuffer;
                        if (!ab) { setRunningWorkflowId(null); return; }
                        try {
                            let data: any[][] = [];
                            const lowerName = file.name.toLowerCase();
                            
                            if (lowerName.endsWith('.csv')) {
                                const text = new TextDecoder("utf-8").decode(ab);
                                const { worker } = await import('../lib/worker');
                                data = await worker.parseCSV(text);
                            } else {
                                const ExcelJS = (await import('exceljs')).default;
                                const workbook = new ExcelJS.Workbook();
                                await workbook.xlsx.load(ab);
                                const worksheet = workbook.worksheets[0];
                                if (worksheet) {
                                    worksheet.eachRow((row) => {
                                        const rowValues: any[] = [];
                                        row.eachCell((cell) => { rowValues.push(cell.value); });
                                        data.push(rowValues);
                                    });
                                }
                            }
                            
                            const fileId = crypto.randomUUID();
                            const columns = data[0]?.map(String) || [];
                            const newFile: ExcelFile = {
                                id: fileId, name: file.name, data, columns, styles: {}, 
                                lastModified: Date.now(), history: [{data, styles: {}, columns}], currentHistoryIndex: 0
                            };
                            
                            const updatedFile = await runWorkflow(wf, newFile);
                            
                            const newJob: Job = {
                                id: crypto.randomUUID(),
                                title: `${file.name} (${wf.name})`,
                                type: 'spreadsheet',
                                status: 'completed',
                                createdAt: Date.now(),
                                updatedAt: Date.now(),
                                fileIds: [fileId],
                                chatHistory: []
                            };
                            
                            await db.upsertJob(newJob);
                            
                            if (onJobCreated) onJobCreated(newJob, updatedFile);
                            else if (refreshData) refreshData();
                            
                            navigate(`/sheet/${newJob.id}`);
                            addToast('success', 'Workflow Completed', 'File processed and ready to view.');
                        } catch (err) {
                            addToast('error', 'File Error', 'Failed to process file.');
                        } finally {
                            setRunningWorkflowId(null);
                        }
                    };
                    reader.readAsArrayBuffer(file);
                };
                input.click();
            }
        } else {
            navigate('/extract/new');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this workflow?')) return;
        try {
            await db.deleteWorkflow(id);
            setWorkflows(prev => prev.filter(w => w.id !== id));
            addToast('success', 'Deleted', 'Workflow removed.');
        } catch (e) {
            addToast('error', 'Error', 'Failed to delete workflow.');
        }
    };

    const getRelativeTime = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        const days = Math.floor(diff / 86400000);
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div 
            className="h-full overflow-y-auto"
            style={{ background: 'linear-gradient(180deg, #fafafa 0%, #f5f5f5 100%)', zoom: 0.85 }}
        >
            <div className="max-w-5xl mx-auto px-8 py-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <h1 className="text-[28px] font-semibold text-[#0a0a0a] tracking-[-0.02em] mb-1">
                            Workflows
                        </h1>
                        <p className="text-[15px] text-[#666]">Automate repetitive tasks and save time</p>
                    </div>
                    <button 
                        onClick={onCreateWorkflow}
                        className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white bg-[#0a0a0a] rounded-lg hover:bg-[#262626] transition-all shadow-sm"
                    >
                        <Plus size={16} />
                        Create Workflow
                    </button>
                </div>

                {/* Table */}
                {workflows.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-[#e5e5e5]">
                        <div className="w-14 h-14 rounded-full bg-[#f5f5f5] flex items-center justify-center mx-auto mb-5">
                            <WorkflowIcon size={28} className="text-[#999]" />
                        </div>
                        <h3 className="text-[17px] font-medium text-[#0a0a0a] mb-2">No workflows yet</h3>
                        <p className="text-[14px] text-[#666] mb-6 max-w-sm mx-auto">
                            Record actions in a spreadsheet to create reusable workflows that automate your work.
                        </p>
                        <button 
                            onClick={onCreateWorkflow}
                            className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white bg-[#0a0a0a] rounded-lg hover:bg-[#262626] transition-colors"
                        >
                            <Zap size={14} />
                            Create Your First Workflow
                        </button>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-[#e5e5e5] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-[#f0f0f0]">
                                    <th className="px-6 py-4 text-[11px] font-semibold text-[#999] uppercase tracking-wide">Workflow</th>
                                    <th className="px-6 py-4 text-[11px] font-semibold text-[#999] uppercase tracking-wide">Type</th>
                                    <th className="px-6 py-4 text-[11px] font-semibold text-[#999] uppercase tracking-wide">Last Run</th>
                                    <th className="px-6 py-4 text-[11px] font-semibold text-[#999] uppercase tracking-wide text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {workflows.map((w, idx) => (
                                    <tr 
                                        key={w.id} 
                                        className={`group hover:bg-[#fafafa] transition-colors ${idx !== workflows.length - 1 ? 'border-b border-[#f5f5f5]' : ''}`}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-lg bg-[#f5f5f5] flex items-center justify-center">
                                                    <WorkflowIcon size={16} className="text-[#666]" />
                                                </div>
                                                <div>
                                                    <div className="text-[14px] font-medium text-[#0a0a0a]">{w.name}</div>
                                                    <div className="text-[12px] text-[#999]">{w.steps.length} step{w.steps.length !== 1 ? 's' : ''}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                                                w.sourceType === 'pdf' 
                                                    ? 'bg-orange-50 text-orange-600 border border-orange-100' 
                                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                            }`}>
                                                {w.sourceType === 'pdf' ? <ScanText size={11} /> : <FileSpreadsheet size={11} />}
                                                {w.sourceType === 'pdf' ? 'PDF' : 'Spreadsheet'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {w.lastRun ? (
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${w.lastRunStatus === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                    <span className="text-[13px] text-[#666]">{getRelativeTime(w.lastRun)}</span>
                                                </div>
                                            ) : (
                                                <span className="text-[13px] text-[#999]">Never run</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className={`flex items-center justify-end gap-1 transition-opacity ${
                                                runningWorkflowId === w.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                            }`}>
                                                <button 
                                                    onClick={() => handleRun(w)}
                                                    disabled={runningWorkflowId !== null}
                                                    className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Run workflow"
                                                >
                                                    {runningWorkflowId === w.id ? (
                                                        <Loader2 size={15} className="animate-spin" />
                                                    ) : (
                                                        <Play size={15} fill="currentColor" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(w.id)}
                                                    disabled={runningWorkflowId !== null}
                                                    className="p-2 rounded-lg text-[#999] hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Delete workflow"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Workflows;
