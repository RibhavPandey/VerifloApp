
import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Plus, ScanText, FileSpreadsheet, Play, Trash2 } from 'lucide-react';
import { db } from '../lib/db';
import { Workflow, ExcelFile, Job } from '../types';
import { useToast } from './ui/toast';
import { WorkspaceContextType } from './Workspace';
import { Button } from './ui/button';

const Workflows: React.FC = () => {
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
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
        // Validation
        if (!workflow.steps || workflow.steps.length === 0) {
            addToast('error', 'Invalid Workflow', 'Workflow has no steps to execute.');
            return targetFile; // Return original file if validation fails
        }

        addToast('info', 'Running Workflow', `Executing ${workflow.name}...`);
        let data = targetFile.data.map(row => [...row]);
        let columns = [...targetFile.columns];
        
        // Note: Enrich steps calculate and deduct their own cost based on unique items
        // We don't deduct upfront to avoid double-deduction

        // Separate steps by type for proper execution order
        const deleteColSteps = workflow.steps.filter(s => s.type === 'delete_col').sort((a, b) => b.params.colIndex - a.params.colIndex);
        const deleteRowSteps = workflow.steps.filter(s => s.type === 'delete_row').sort((a, b) => b.params.rowIndex - a.params.rowIndex);
        const otherSteps = workflow.steps.filter(s => s.type !== 'delete_col' && s.type !== 'delete_row');

        try {
            // Execute other steps first (sort, enrich, etc.)
            for (const step of otherSteps) {
                try {
                    if (step.type === 'sort') {
                         const { action, r1, c1, r2, c2 } = step.params;
                         // Bounds checking
                         if (r1 < 0 || r2 >= data.length || c1 < 0 || c2 >= (data[0]?.length || 0)) {
                             console.warn(`Step "${step.description}": Range out of bounds, skipping`);
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
                         // If colIndex not recorded, try to extract from description or use first column
                         const targetCol = colIndex !== undefined ? colIndex : 0;
                         if (targetCol >= 0 && targetCol < (data[0]?.length || 0) && prompt) {
                             try {
                                 const sourceData = data.slice(1).map(r => r[targetCol]).filter(v => v !== undefined && v !== null && v !== '');
                                 const allUniqueItems = Array.from(new Set(sourceData.map(v => String(v).trim())));
                                 
                                 if (allUniqueItems.length > 0) {
                                     const { api } = await import('../lib/api');
                                     const BATCH_SIZE = 50; // Process 50 items per API call
                                     const numBatches = Math.ceil(allUniqueItems.length / BATCH_SIZE);
                                     const batchCost = numBatches * 25; // 25 credits per batch
                                     
                                     // Check if user has enough credits for all batches
                                     if (credits < batchCost) {
                                         addToast('error', 'Insufficient Credits', `Enrichment requires ${batchCost} credits (${allUniqueItems.length} unique items in ${numBatches} batches). You have ${credits}.`);
                                         continue; // Skip this enrich step
                                     }
                                     
                                     // Deduct credits for all batches upfront
                                     if (batchCost > 0) handleUseCredit(batchCost);
                                     
                                     const mergedResult: Record<string, any> = {};
                                     
                                     // Process in batches
                                     for (let i = 0; i < allUniqueItems.length; i += BATCH_SIZE) {
                                         const batch = allUniqueItems.slice(i, i + BATCH_SIZE);
                                         try {
                                             const response = await api.enrich(batch, prompt);
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
                                     
                                     // Add enriched data to new column
                                     const newColIdx = data[0].length;
                                     data[0][newColIdx] = "Enriched Info";
                                     columns.push("Enriched Info");
                                     
                                     // Match and populate enriched data for ALL rows
                                     for(let r = 1; r < data.length; r++) {
                                         if (!data[r]) data[r] = [];
                                         const cellValue = data[r][targetCol];
                                         
                                         if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
                                             // Try exact match first (preserves original behavior)
                                             let enrichedValue = mergedResult[cellValue] || mergedResult[String(cellValue)];
                                             
                                             // If no exact match, try normalized lookup (handles case/whitespace differences)
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
                                 console.error('Enrichment step failed:', enrichError);
                                 addToast('warning', 'Enrichment Failed', `Step "${step.description}" failed: ${enrichError.message || 'Unknown error'}`);
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
                         // Filter rows based on column criteria
                         if (colIndex >= 0 && colIndex < (data[0]?.length || 0) && operator && value !== undefined) {
                             const headerRow = data[0];
                             const filteredData = [headerRow]; // Keep header
                             
                             for (let r = 1; r < data.length; r++) {
                                 if (!data[r]) continue;
                                 const cellValue = data[r][colIndex];
                                 let shouldInclude = false;
                                 
                                 if (operator === 'equals') {
                                     shouldInclude = String(cellValue) === String(value);
                                 } else if (operator === 'contains') {
                                     shouldInclude = String(cellValue).toLowerCase().includes(String(value).toLowerCase());
                                 } else if (operator === 'greater') {
                                     shouldInclude = Number(cellValue) > Number(value);
                                 } else if (operator === 'less') {
                                     shouldInclude = Number(cellValue) < Number(value);
                                 } else if (operator === 'not_empty') {
                                     shouldInclude = cellValue !== undefined && cellValue !== null && cellValue !== '';
                                 } else if (operator === 'empty') {
                                     shouldInclude = cellValue === undefined || cellValue === null || cellValue === '';
                                 }
                                 
                                 if (shouldInclude) {
                                     filteredData.push(data[r]);
                                 }
                             }
                             
                             data = filteredData;
                         }
                    }
                    if (step.type === 'extraction') {
                         // Extraction steps are for PDF workflows, not spreadsheet workflows
                         // This is a placeholder - actual extraction happens during PDF processing
                         console.warn('Extraction step in spreadsheet workflow - skipping (extraction is for PDF workflows)');
                    }
                } catch (stepError: any) {
                    console.error(`Step "${step.description}" failed:`, stepError);
                    addToast('warning', 'Step Failed', `Step "${step.description}" failed: ${stepError.message || 'Unknown error'}`);
                }
            }

            // Execute delete_col steps in reverse order (highest index first) to avoid index shifting
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
                    console.error(`Delete column step failed:`, stepError);
                    addToast('warning', 'Step Failed', `Delete column step failed`);
                }
            }

            // Execute delete_row steps in reverse order (highest index first) to avoid index shifting
            for (const step of deleteRowSteps) {
                try {
                    const { rowIndex } = step.params;
                    if (rowIndex >= 0 && rowIndex < data.length) {
                        data = data.filter((_, i) => i !== rowIndex);
                    }
                } catch (stepError: any) {
                    console.error(`Delete row step failed:`, stepError);
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
            console.error('Workflow execution failed:', error);
            const updatedWorkflow = { ...workflow, lastRun: Date.now(), lastRunStatus: 'failed' as const };
            await db.upsertWorkflow(updatedWorkflow);
            setWorkflows(prev => prev.map(w => w.id === workflow.id ? updatedWorkflow : w));
            addToast('error', 'Workflow Failed', `Workflow execution failed: ${error.message || 'Unknown error'}`);
        }
    };

    const handleRun = async (wf: Workflow) => {
        if (wf.sourceType === 'spreadsheet') {
            const activeFile = getActiveFile();
            if (activeFile) {
                const updatedFile = await runWorkflow(wf, activeFile);
                // Refresh files data to update context
                if (refreshData) {
                    refreshData();
                }
                // Navigate to show results if not already there
                const currentJobId = window.location.pathname.match(/\/sheet\/([^\/]+)/)?.[1];
                if (!currentJobId) {
                    const job = jobs.find(j => j.fileIds.includes(activeFile.id));
                    if (job) {
                        navigate(`/sheet/${job.id}`);
                    }
                }
            } else {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.xlsx,.csv';
                input.onchange = async (e: any) => {
                    const fileList = e.target.files;
                    if (!fileList) return;
                    const file = fileList[0];
                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                        const ab = ev.target?.result as ArrayBuffer;
                        if (!ab) return;
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
                                        row.eachCell((cell) => {
                                            rowValues.push(cell.value);
                                        });
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
                            
                            // Execute workflow and get updated file
                            const updatedFile = await runWorkflow(wf, newFile);
                            
                            // Create Job to link the processed file
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
                            
                            // Update context to refresh jobs list - use updatedFile instead of newFile
                            if (onJobCreated) {
                                onJobCreated(newJob, updatedFile);
                            } else if (refreshData) {
                                refreshData();
                            }
                            
                            // Navigate to sheet view to show results
                            navigate(`/sheet/${newJob.id}`);
                            
                            addToast('success', 'Workflow Completed', 'File processed and ready to view.');
                        } catch (err) {
                            console.error(err);
                            addToast('error', 'File Error', 'Failed to process file.');
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

    return (
        <div className="h-full overflow-y-auto p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Workflows</h2>
                        <p className="text-gray-500">Manage and automate your repetitive tasks.</p>
                    </div>
                    <Button 
                        onClick={onCreateWorkflow}
                        variant="default"
                        size="default"
                    >
                        <Plus size={16} /> Create Workflow
                    </Button>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 font-bold text-gray-500 uppercase text-xs">Name</th>
                                <th className="px-6 py-3 font-bold text-gray-500 uppercase text-xs">Source</th>
                                <th className="px-6 py-3 font-bold text-gray-500 uppercase text-xs">Last Run</th>
                                <th className="px-6 py-3 font-bold text-gray-500 uppercase text-xs text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {workflows.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">
                                        No workflows created yet. Record actions in a sheet to create one.
                                    </td>
                                </tr>
                            ) : (
                                workflows.map(w => (
                                    <tr key={w.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">{w.name}</div>
                                            <div className="text-xs text-gray-400">{w.steps.length} steps</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${w.sourceType === 'pdf' ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
                                                {w.sourceType === 'pdf' ? <ScanText size={12} /> : <FileSpreadsheet size={12} />}
                                                {w.sourceType === 'pdf' ? 'PDF Extraction' : 'Spreadsheet'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {w.lastRun ? (
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${w.lastRunStatus === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                                    <span className="text-gray-600">{new Date(w.lastRun).toLocaleDateString()}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">Never</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    className="p-1.5 hover:bg-green-50 text-green-600 rounded-lg transition-colors" title="Run"
                                                    onClick={() => handleRun(w)}
                                                >
                                                    <Play size={16} fill="currentColor" />
                                                </button>
                                                <button onClick={() => handleDelete(w.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors" title="Delete">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Workflows;
