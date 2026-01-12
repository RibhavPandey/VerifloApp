
import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  Bell, Cloud, Coins, Download, Loader2, Plus, 
  StopCircle, Zap, Workflow as WorkflowIcon, Play, CheckCircle2, X, Trash2
} from 'lucide-react';
import { ExcelFile, Job, Workflow, AutomationStep } from '../types';
import Navigation from './Navigation';
import MergeModal from './MergeModal';
import { db } from '../lib/db'; 
import { useToast } from './ui/toast';
import { worker } from '../lib/worker';
import ExcelJS from 'exceljs';

export interface WorkspaceContextType {
    jobs: Job[];
    files: ExcelFile[];
    credits: number;
    handleUseCredit: (amount: number) => void;
    refreshData: () => void;
    handleRecordAction: (type: AutomationStep['type'], description: string, params: any) => void;
    onJobCreated: (job: Job, file?: ExcelFile) => void;
    handleCSVUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const Workspace: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  
  // --- CORE STATE ---
  const [jobs, setJobs] = useState<Job[]>([]);
  const [files, setFiles] = useState<ExcelFile[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [credits, setCredits] = useState(500);
  const [isSyncing, setIsSyncing] = useState(false);

  // --- UI STATE ---
  const [showMergeModal, setShowMergeModal] = useState(false);
  
  // --- WORKFLOW STATE ---
  const [isRecording, setIsRecording] = useState(false);
  const [showAutomateMenu, setShowAutomateMenu] = useState(false);
  const [showWorkflowEditor, setShowWorkflowEditor] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [sessionSteps, setSessionSteps] = useState<AutomationStep[]>([]);

  const loadData = async () => {
      setIsSyncing(true);
      try {
          const fetchedJobs = await db.fetchJobs();
          setJobs(fetchedJobs);

          const fetchedWorkflows = await db.fetchWorkflows();
          setWorkflows(fetchedWorkflows);

          const profile = await db.getUserProfile();
          if (profile) setCredits(profile.credits);
          
          if (fetchedJobs.length > 0) {
              const allFileIds = fetchedJobs.flatMap(j => j.fileIds);
              const uniqueIds = Array.from(new Set(allFileIds));
              const fetchedFiles = await db.fetchFiles(uniqueIds);
              setFiles(fetchedFiles);
          }
      } catch (e) {
          console.error("Failed to load data", e);
      } finally {
          setIsSyncing(false);
      }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUseCredit = async (amount: number) => {
      setCredits(prev => Math.max(0, prev - amount));
      try {
          await db.decrementCredits(amount);
      } catch (e) {
          console.error("Failed to update credits", e);
      }
  };

  const handleJobCreated = (job: Job, file?: ExcelFile) => {
      setJobs(prev => [job, ...prev]);
      if (file) setFiles(prev => [...prev, file]);
      navigate(`/sheet/${job.id}`);
  };

  const handleRecordAction = (type: AutomationStep['type'], description: string, params: any) => {
      if (isRecording) {
          setSessionSteps(prev => [...prev, {
              id: crypto.randomUUID(),
              type, description, params
          }]);
      }
  };

  const handleStartRecording = () => {
      setIsRecording(true);
      setSessionSteps([]);
      setShowAutomateMenu(false);
  };

  const handleStopRecording = () => {
      setIsRecording(false);
      if (sessionSteps.length === 0) {
          addToast('info', "No actions recorded", "Workflow was not saved.");
      } else {
          setShowWorkflowEditor(true);
      }
  };

  const handleSaveWorkflowFromEditor = async () => {
      if (!newWorkflowName.trim()) return;
      const newWorkflow: Workflow = {
          id: crypto.randomUUID(),
          name: newWorkflowName,
          sourceType: 'spreadsheet',
          steps: sessionSteps,
          createdAt: Date.now(),
          lastRunStatus: 'success'
      };
      await db.upsertWorkflow(newWorkflow);
      setWorkflows(prev => [newWorkflow, ...prev]);
      setShowWorkflowEditor(false);
      setNewWorkflowName('');
      setSessionSteps([]);
      addToast('success', 'Workflow Saved', `"${newWorkflowName}" is ready to use.`);
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList) return;

    Array.from(fileList).forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const ab = e.target?.result as ArrayBuffer;
            if (!ab) return;
            try {
                let data: any[][] = [];
                const lowerName = file.name.toLowerCase();
                
                if (lowerName.endsWith('.csv')) {
                    const text = new TextDecoder("utf-8").decode(ab);
                    data = await worker.parseCSV(text);
                } else {
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
                const newJob: Job = {
                    id: crypto.randomUUID(),
                    title: file.name,
                    type: 'spreadsheet',
                    status: 'completed',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    fileIds: [fileId],
                    chatHistory: [{ id: '1', role: 'assistant', content: "Hello! I'm your AI data analyst." }]
                };

                await db.upsertJob(newJob);
                await db.upsertFile(newFile);
                handleJobCreated(newJob, newFile);

            } catch (err) {
                console.error(err);
                addToast('error', 'File Error', 'Failed to parse file.');
            }
        };
        reader.readAsArrayBuffer(file);
    });
  };

  return (
    <div className="h-screen flex bg-white overflow-hidden text-[#111827]">
      {/* GLOBAL HIDDEN INPUT FOR DASHBOARD UPLOAD TRIGGER */}
      <input 
        type="file" 
        id="hidden-csv-upload" 
        className="hidden" 
        multiple 
        accept=".xlsx, .xls, .csv" 
        onChange={handleCSVUpload} 
      />

      <Navigation 
        activeView={location.pathname.includes('sheet') ? 'sheet' : location.pathname.includes('dashboard') ? 'dashboard' : location.pathname.includes('workflows') ? 'workflows' : 'extraction'}
        files={files}
        jobs={jobs}
        onFileUpload={handleCSVUpload}
        onMergeClick={() => setShowMergeModal(true)}
      />

      <div className="flex-1 flex flex-col min-w-0 relative">
         <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 z-20">
            <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-gray-500">Workspace /</div>
                <h1 className="font-bold text-gray-800">
                    {location.pathname.includes('dashboard') ? 'Overview' : 
                     location.pathname.includes('workflows') ? 'Workflows' :
                     location.pathname.includes('extract') ? 'Extraction' :
                     'Editor'}
                </h1>
                {isSyncing && <Cloud className="animate-pulse text-gray-400 ml-2" size={14} />}
            </div>
            
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-1.5 px-4 py-2 bg-yellow-50 text-yellow-800 rounded-full border border-yellow-300 text-sm font-bold mr-2 shadow-sm">
                  <Coins size={16} className="text-yellow-600" />
                  <span>{credits} Credits</span>
               </div>

               <div className="relative">
                   {isRecording ? (
                       <button 
                           onClick={handleStopRecording}
                           className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-lg font-bold text-sm animate-pulse hover:bg-red-100 transition-colors"
                       >
                           <StopCircle size={16} fill="currentColor" />
                           <span className="w-20 text-center">Stop</span>
                       </button>
                   ) : (
                       <button 
                            onClick={() => setShowAutomateMenu(!showAutomateMenu)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                       >
                           <Zap size={16} className={showAutomateMenu ? "text-purple-600 fill-purple-100" : "text-gray-400"} />
                           Automate
                       </button>
                   )}

                   {showAutomateMenu && !isRecording && (
                       <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                           <div className="p-2 border-b border-gray-100">
                               <button 
                                   onClick={handleStartRecording}
                                   className="w-full text-left px-3 py-2 hover:bg-red-50 text-gray-700 hover:text-red-600 rounded-lg flex items-center gap-3 transition-colors group"
                               >
                                   <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                                       <Plus size={16} />
                                   </div>
                                   <div>
                                       <div className="font-bold text-sm">Record New</div>
                                       <div className="text-[10px] text-gray-400 group-hover:text-red-400">Start capturing steps</div>
                                   </div>
                               </button>
                           </div>
                       </div>
                   )}
                   {showAutomateMenu && !isRecording && (
                       <div className="fixed inset-0 z-40" onClick={() => setShowAutomateMenu(false)}></div>
                   )}
               </div>
               <div className="h-6 w-px bg-gray-200 mx-1"></div>
               <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><Bell size={20} /></button>
            </div>
         </header>

         <div className="flex-1 flex overflow-hidden relative">
            <main className="flex-1 relative overflow-hidden bg-[#F9FAFB] flex flex-col">
                <Outlet context={{ 
                    jobs, files, credits, handleUseCredit, refreshData: loadData, handleRecordAction, onJobCreated: handleJobCreated, handleCSVUpload
                } satisfies WorkspaceContextType} />
            </main>
         </div>

         {/* Workflow Editor Modal */}
         {showWorkflowEditor && (
             <div className="absolute inset-0 z-[60] flex justify-end bg-black/10 backdrop-blur-[1px]">
                 <div className="w-[45%] h-full bg-white shadow-2xl border-l border-gray-200 animate-in slide-in-from-right duration-300 flex flex-col">
                     <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                         <div>
                             <h2 className="text-lg font-bold text-gray-900">Save Workflow</h2>
                             <p className="text-xs text-gray-500">Review recorded steps before saving.</p>
                         </div>
                         <button 
                             onClick={() => { setShowWorkflowEditor(false); setIsRecording(false); setSessionSteps([]); }} 
                             className="p-2 hover:bg-gray-200 rounded-full text-gray-500"
                         >
                             <X size={20} />
                         </button>
                     </div>
                     <div className="flex-1 overflow-y-auto p-6">
                         <div className="mb-6">
                             <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Workflow Name</label>
                             <input 
                                 type="text" 
                                 placeholder="e.g., Weekly Sales Clean Up"
                                 className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                                 value={newWorkflowName}
                                 onChange={(e) => setNewWorkflowName(e.target.value)}
                                 autoFocus
                             />
                         </div>
                         <div className="space-y-3">
                             <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Recorded Steps</label>
                             {sessionSteps.map((step, idx) => (
                                 <div key={step.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-purple-200 hover:shadow-sm transition-all group">
                                     <div className="w-6 h-6 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs shrink-0 border border-purple-100">
                                         {idx + 1}
                                     </div>
                                     <div className="flex-1 min-w-0">
                                         <div className="text-sm font-medium text-gray-800">{step.description}</div>
                                     </div>
                                     <button 
                                         onClick={() => setSessionSteps(prev => prev.filter(s => s.id !== step.id))}
                                         className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                     >
                                         <Trash2 size={16} />
                                     </button>
                                 </div>
                             ))}
                         </div>
                     </div>
                     <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                         <button 
                             onClick={handleSaveWorkflowFromEditor}
                             disabled={!newWorkflowName.trim() || sessionSteps.length === 0}
                             className="px-6 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 shadow-lg active:scale-95 transition-all text-sm flex items-center gap-2"
                         >
                             Save Workflow <CheckCircle2 size={16} />
                         </button>
                     </div>
                 </div>
             </div>
         )}
      </div>

      {showMergeModal && <MergeModal files={files} onClose={() => setShowMergeModal(false)} onMergeComplete={(newFile) => {
          db.upsertFile(newFile);
          loadData();
          setShowMergeModal(false);
      }} />}
    </div>
  );
};

export default Workspace;
