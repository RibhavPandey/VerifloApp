
import React, { useState, useEffect } from 'react';
import { Plus, ScanText, FileSpreadsheet, Play, Trash2 } from 'lucide-react';
import { db } from '../lib/db';
import { Workflow } from '../types';
import { useToast } from './ui/toast';

const Workflows: React.FC = () => {
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const { addToast } = useToast();

    useEffect(() => {
        db.fetchWorkflows().then(setWorkflows);
    }, []);

    const handleDelete = async (id: string) => {
        // Assume delete not implemented in db yet or do nothing
        addToast('info', 'Not Implemented', 'Delete workflow coming soon');
    };

    return (
        <div className="h-full overflow-y-auto p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Workflows</h2>
                        <p className="text-gray-500">Manage and automate your repetitive tasks.</p>
                    </div>
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
