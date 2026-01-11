
import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { 
  FileSpreadsheet, ScanText, Clock, AlertTriangle, CheckCircle2, 
  MoreHorizontal, PlayCircle, Plus, Table, Trash2, Pencil, X, AlertCircle
} from 'lucide-react';
import { Job, ExcelFile } from '../types';
import { db } from '../lib/db';
import { useToast } from './ui/Toast';
import { WorkspaceContextType } from './Workspace';

const Dashboard: React.FC = () => {
  const { jobs, onJobCreated, refreshData } = useOutletContext<WorkspaceContextType>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  const needsAttentionJobs = jobs.filter(j => j.status === 'needs_review');
  const recentJobs = jobs.filter(j => j.status !== 'needs_review').sort((a, b) => b.updatedAt - a.updatedAt);

  const [openMenuJobId, setOpenMenuJobId] = useState<string | null>(null);
  const [renameJobId, setRenameJobId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);

  const handleCreateEmpty = async () => {
    try {
        const fileId = crypto.randomUUID();
        const headers = Array.from({length: 10}, (_, i) => String.fromCharCode(65 + i));
        const data = [headers, ...Array.from({ length: 50 }, () => Array(10).fill(''))];
        
        const newFile: ExcelFile = {
            id: fileId, name: "Untitled Spreadsheet", data, columns: headers, styles: {},
            lastModified: Date.now(), history: [{ data, styles: {} }], currentHistoryIndex: 0
        };
        const newJob: Job = {
            id: crypto.randomUUID(), title: "Untitled Spreadsheet", type: 'spreadsheet', status: 'completed',
            createdAt: Date.now(), updatedAt: Date.now(), fileIds: [fileId], chatHistory: []
        };

        await db.upsertJob(newJob);
        await db.upsertFile(newFile);
        onJobCreated(newJob, newFile);
        addToast('success', 'Created', 'New blank spreadsheet ready.');
    } catch (e) { addToast('error', 'Error', 'Failed to create.'); }
  };

  const handleDeleteJob = async (id: string) => {
      try {
          await db.deleteJob(id);
          refreshData();
          addToast('success', 'Deleted', 'Project removed.');
      } catch (e) {
          addToast('error', 'Error', 'Failed to delete project.');
      }
  };

  const handleRenameJob = async (id: string, title: string) => {
      try {
          const job = jobs.find(j => j.id === id);
          if (job) {
              await db.upsertJob({ ...job, title });
              refreshData();
              addToast('success', 'Renamed', 'Updated successfully.');
          }
      } catch (e) {
          addToast('error', 'Error', 'Failed to rename project.');
      }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#F9FAFB] p-8" onClick={() => setOpenMenuJobId(null)}>
      
      {/* HEADER & CTAs */}
      <div className="max-w-6xl mx-auto mb-12">
        <div className="flex justify-between items-end mb-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Work Dashboard</h1>
                <p className="text-gray-500">Manage your data projects and extraction tasks.</p>
            </div>
            <button className="text-sm font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 flex items-center gap-2">
                <PlayCircle size={16} /> Load Demo Data
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button onClick={() => navigate('/extract/new')} className="group relative overflow-hidden bg-blue-600 rounded-2xl p-8 text-left hover:shadow-xl hover:-translate-y-1 transition-all">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform"><ScanText size={120} className="text-white" /></div>
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-6"><ScanText size={24} className="text-white" /></div>
              <h2 className="text-2xl font-bold text-white mb-2">Extract Data</h2>
              <p className="text-blue-100 font-medium text-sm">Upload PDFs. AI auto-extracts fields.</p>
            </div>
          </button>

          <button onClick={() => document.getElementById('hidden-csv-upload')?.click()} className="group relative overflow-hidden bg-white border border-gray-200 rounded-2xl p-8 text-left hover:shadow-lg hover:border-blue-200 transition-all">
             <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform"><FileSpreadsheet size={120} /></div>
             <div className="relative z-10">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-50"><FileSpreadsheet size={24} className="text-gray-700 group-hover:text-blue-600" /></div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload File</h2>
              <p className="text-gray-500 font-medium text-sm">Analyze existing CSV or Excel files.</p>
            </div>
          </button>

          <button onClick={handleCreateEmpty} className="group relative overflow-hidden bg-white border border-gray-200 rounded-2xl p-8 text-left hover:shadow-lg hover:border-green-200 transition-all">
             <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform"><Table size={120} /></div>
             <div className="relative z-10">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-green-50"><Plus size={24} className="text-gray-700 group-hover:text-green-600" /></div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">New Sheet</h2>
              <p className="text-gray-500 font-medium text-sm">Start from scratch with an empty grid.</p>
            </div>
          </button>
        </div>
      </div>

      {/* NEEDS ATTENTION */}
      {needsAttentionJobs.length > 0 && (
        <div className="max-w-6xl mx-auto mb-10">
          <div className="flex items-center gap-2 mb-4">
             <AlertTriangle size={18} className="text-orange-500" />
             <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">Needs Attention</h3>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
             {needsAttentionJobs.map(job => (
               <div key={job.id} onClick={() => navigate(`/extract/${job.id}/review`)} className="p-4 flex items-center justify-between hover:bg-orange-50/30 cursor-pointer group">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold">{job.riskyCount || 1}</div>
                     <div><h4 className="font-bold text-gray-900">{job.title}</h4><p className="text-xs text-orange-600 font-medium flex items-center gap-1"><Clock size={12} /> Pending Review</p></div>
                  </div>
                  <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-lg group-hover:border-orange-200 group-hover:text-orange-700">Review Now</button>
               </div>
             ))}
          </div>
        </div>
      )}

      {/* RECENT */}
      <div className="max-w-6xl mx-auto">
         <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-4">Recent Projects</h3>
         {recentJobs.length === 0 ? (
           <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50"><p className="text-gray-400 font-medium">No recent projects.</p></div>
         ) : (
           <div className="grid grid-cols-1 gap-3">
             {recentJobs.map(job => (
               <div key={job.id} onClick={() => navigate(`/sheet/${job.id}`)} className={`relative bg-white p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer flex items-center justify-between group ${openMenuJobId === job.id ? 'z-20 ring-1 ring-blue-300 shadow-md' : 'z-0'}`}>
                  <div className="flex items-center gap-4">
                     <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${job.type === 'extraction' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>{job.type === 'extraction' ? <ScanText size={20} /> : <FileSpreadsheet size={20} />}</div>
                     <div><h4 className="font-bold text-gray-900 group-hover:text-blue-700">{job.title}</h4><div className="text-xs text-gray-500 mt-0.5">Last edited {new Date(job.updatedAt).toLocaleDateString()}</div></div>
                  </div>
                  <div className="flex items-center gap-4">
                     {job.status === 'verified' && <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-bold flex items-center gap-1 border border-green-100"><CheckCircle2 size={12} /> Verified</span>}
                     <div className="relative z-10">
                        <button onClick={(e) => { e.stopPropagation(); setOpenMenuJobId(openMenuJobId === job.id ? null : job.id); }} className={`p-2 rounded-lg transition-colors ${openMenuJobId === job.id ? 'bg-gray-100 text-gray-900' : 'text-gray-300 hover:text-gray-600 hover:bg-gray-50'}`}><MoreHorizontal size={20} /></button>
                        {openMenuJobId === job.id && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl animate-in fade-in zoom-in-95 overflow-hidden">
                                <button onClick={(e) => { e.stopPropagation(); setRenameJobId(job.id); setRenameTitle(job.title); setOpenMenuJobId(null); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 flex items-center gap-2"><Pencil size={14} /> Rename</button>
                                <button onClick={(e) => { e.stopPropagation(); setDeleteJobId(job.id); setOpenMenuJobId(null); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 flex items-center gap-2 border-t border-gray-100"><Trash2 size={14} /> Delete</button>
                            </div>
                        )}
                     </div>
                  </div>
               </div>
             ))}
           </div>
         )}
      </div>

      {renameJobId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setRenameJobId(null)}>
              <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm border border-gray-100 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Rename Project</h3>
                  <input className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm mb-6" value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && (handleRenameJob(renameJobId, renameTitle), setRenameJobId(null))} />
                  <div className="flex justify-end gap-2"><button onClick={() => setRenameJobId(null)} className="px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button><button onClick={() => { handleRenameJob(renameJobId, renameTitle); setRenameJobId(null); }} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg">Save</button></div>
              </div>
          </div>
      )}

      {deleteJobId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeleteJobId(null)}>
              <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm border border-gray-100 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-3 mb-4 text-red-600"><div className="p-2 bg-red-100 rounded-full"><AlertCircle size={24} /></div><h3 className="text-lg font-bold text-gray-900">Delete Project?</h3></div>
                  <p className="text-gray-600 text-sm leading-relaxed mb-6">Are you sure you want to delete this project? This action cannot be undone.</p>
                  <div className="flex justify-end gap-2"><button onClick={() => setDeleteJobId(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button><button onClick={() => { handleDeleteJob(deleteJobId); setDeleteJobId(null); }} className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg">Delete Project</button></div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;
