
import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Plus, ScanText, FileSpreadsheet, Play, Trash2, Loader2, Workflow as WorkflowIcon, Zap, X, AlertTriangle, Pencil, ChevronUp, ChevronDown } from 'lucide-react';
import { db } from '../lib/db';
import { runWorkflow as runWorkflowEngine } from '../lib/workflow-runner';
import { Workflow, ExcelFile, Job, AutomationStep } from '../types';
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
        try {
            const updatedFile = await runWorkflowEngine(workflow, targetFile, {
                addToast,
                getCredits: () => credits,
                onRollback: async (rolledBackFile) => {
                    await db.upsertFile(rolledBackFile);
                    if (refreshData) refreshData();
                },
            });
            await db.upsertFile(updatedFile);
            const updatedWorkflow = { ...workflow, lastRun: Date.now(), lastRunStatus: 'success' as const };
            await db.upsertWorkflow(updatedWorkflow);
            setWorkflows(prev => prev.map(w => w.id === workflow.id ? updatedWorkflow : w));
            if (refreshData) refreshData();
            return updatedFile;
        } catch (error: any) {
            const updatedWorkflow = { ...workflow, lastRun: Date.now(), lastRunStatus: 'failed' as const };
            await db.upsertWorkflow(updatedWorkflow);
            setWorkflows(prev => prev.map(w => w.id === workflow.id ? updatedWorkflow : w));
            addToast('error', 'Workflow Failed', 'Workflow execution failed');
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

    const [deleteWorkflowId, setDeleteWorkflowId] = useState<string | null>(null);
    const [editWorkflow, setEditWorkflow] = useState<Workflow | null>(null);
    const [editName, setEditName] = useState('');
    const [editSteps, setEditSteps] = useState<AutomationStep[]>([]);

    const handleEdit = (w: Workflow) => {
        setEditWorkflow(w);
        setEditName(w.name);
        setEditSteps([...w.steps]);
    };

    const handleSaveEdit = async () => {
        if (!editWorkflow || !editName.trim() || editSteps.length === 0) return;
        const updated: Workflow = { ...editWorkflow, name: editName.trim(), steps: editSteps };
        try {
            await db.upsertWorkflow(updated);
            setWorkflows(prev => prev.map(w => w.id === editWorkflow.id ? updated : w));
            addToast('success', 'Updated', 'Workflow saved.');
            setEditWorkflow(null);
        } catch (e) {
            addToast('error', 'Error', 'Failed to save workflow.');
        }
    };

    const handleDeleteStep = (id: string) => setEditSteps(prev => prev.filter(s => s.id !== id));
    const handleMoveStep = (index: number, dir: 'up' | 'down') => {
        const newIdx = dir === 'up' ? index - 1 : index + 1;
        if (newIdx < 0 || newIdx >= editSteps.length) return;
        const arr = [...editSteps];
        [arr[index], arr[newIdx]] = [arr[newIdx], arr[index]];
        setEditSteps(arr);
    };

    const handleDelete = async (id: string) => {
        setDeleteWorkflowId(id);
    };

    const confirmDelete = async () => {
        if (!deleteWorkflowId) return;
        try {
            await db.deleteWorkflow(deleteWorkflowId);
            setWorkflows(prev => prev.filter(w => w.id !== deleteWorkflowId));
            addToast('success', 'Deleted', 'Workflow removed.');
            setDeleteWorkflowId(null);
        } catch (e) {
            addToast('error', 'Error', 'Failed to delete workflow.');
            setDeleteWorkflowId(null);
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
                        className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white bg-[#0a0a0a] rounded-xl hover:bg-[#262626] transition-all shadow-sm"
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
                            className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white bg-[#0a0a0a] rounded-xl hover:bg-[#262626] transition-colors"
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
                                                    onClick={() => handleEdit(w)}
                                                    disabled={runningWorkflowId !== null}
                                                    className="p-2 rounded-lg text-[#999] hover:text-purple-600 hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Edit workflow"
                                                >
                                                    <Pencil size={15} />
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

            {/* Delete Confirmation Modal */}
            {deleteWorkflowId && (
                <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center backdrop-blur-sm" onClick={() => setDeleteWorkflowId(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-gray-200 animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle size={24} className="text-red-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Delete Workflow</h3>
                                    <p className="text-sm text-gray-500">This action cannot be undone.</p>
                                </div>
                                <button
                                    onClick={() => setDeleteWorkflowId(null)}
                                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <p className="text-sm text-gray-600 mb-6">
                                Are you sure you want to delete <span className="font-semibold text-gray-900">{workflows.find(w => w.id === deleteWorkflowId)?.name}</span>? This will permanently remove the workflow and all its steps.
                            </p>
                            <div className="flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setDeleteWorkflowId(null)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Trash2 size={16} />
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Workflow Modal */}
            {editWorkflow && (
                <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center backdrop-blur-sm" onClick={() => setEditWorkflow(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] flex flex-col border border-gray-200 animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">Edit Workflow</h3>
                            <p className="text-sm text-gray-500">Change name, reorder or remove steps.</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="mb-4">
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Name</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    placeholder="Workflow name"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Steps</label>
                                <div className="space-y-2">
                                    {editSteps.map((step, idx) => (
                                        <div key={step.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                                            <div className="flex flex-col gap-0.5">
                                                <button onClick={() => handleMoveStep(idx, 'up')} disabled={idx === 0} className="p-0.5 rounded text-gray-400 hover:text-purple-600 disabled:opacity-30"><ChevronUp size={14} /></button>
                                                <button onClick={() => handleMoveStep(idx, 'down')} disabled={idx === editSteps.length - 1} className="p-0.5 rounded text-gray-400 hover:text-purple-600 disabled:opacity-30"><ChevronDown size={14} /></button>
                                            </div>
                                            <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs shrink-0">{idx + 1}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-gray-800 truncate">{step.description}</div>
                                                <div className="text-[10px] text-gray-400 font-mono truncate">{JSON.stringify(step.params)}</div>
                                            </div>
                                            <button onClick={() => handleDeleteStep(step.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setEditWorkflow(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button onClick={handleSaveEdit} disabled={!editName.trim() || editSteps.length === 0} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Workflows;
