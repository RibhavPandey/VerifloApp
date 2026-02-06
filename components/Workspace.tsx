
import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  Cloud, Coins, Download, Loader2, Plus, 
  StopCircle, Zap, Workflow as WorkflowIcon, Play, CheckCircle2, X, Trash2, FileSpreadsheet, Menu,
  Home, DollarSign, HelpCircle, BookOpen, Settings, LogOut, CircleUser, ScanText
} from 'lucide-react';
import { ExcelFile, Job, Workflow, AutomationStep } from '../types';
import Navigation from './Navigation';
import MergeModal from './MergeModal';
import { db } from '../lib/db';
import { getPlanLimits } from '../lib/plans'; 
import { runWorkflow as runWorkflowEngine } from '../lib/workflow-runner';
import { api } from '../lib/api';
import { useToast } from './ui/toast';
import { worker } from '../lib/worker';
import ExcelJS from 'exceljs';
import { validateFiles, formatFileSize } from '../lib/file-validation';
import { Sheet, SheetContent } from './ui/sheet';
import { useIsMobile } from './ui/use-mobile';
import { supabase } from '../lib/supabase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { ThemeToggle } from './ThemeToggle';

export interface WorkspaceContextType {
    jobs: Job[];
    files: ExcelFile[];
    credits: number;
    documentsUsed: number;
    documentsLimit: number;
    handleUseCredit: (amount: number) => void;
    refreshData: () => void;
    handleRecordAction: (type: AutomationStep['type'], description: string, params: any) => void;
    onJobCreated: (job: Job, file?: ExcelFile) => void;
    handleCSVUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onCreateWorkflow: () => void;
    isRecording: boolean;
    onStopRecording?: () => void;
}

const Workspace: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const isMobile = useIsMobile();
  
  // --- CORE STATE ---
  const [jobs, setJobs] = useState<Job[]>([]);
  const [files, setFiles] = useState<ExcelFile[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [credits, setCredits] = useState(0);
  const [documentsUsed, setDocumentsUsed] = useState(0);
  const [documentsLimit, setDocumentsLimit] = useState(10);
  const [isSyncing, setIsSyncing] = useState(false);

  // --- UI STATE ---
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [fileUploadInProgress, setFileUploadInProgress] = useState(0);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  
  // --- USER STATE ---
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
  
  // --- WORKFLOW STATE ---
  const [isRecording, setIsRecording] = useState(false);
  const [showAutomateMenu, setShowAutomateMenu] = useState(false);
  const [showWorkflowEditor, setShowWorkflowEditor] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [sessionSteps, setSessionSteps] = useState<AutomationStep[]>([]);
  const [createWorkflowTypeModal, setCreateWorkflowTypeModal] = useState(false);
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
  const [runningWorkflowId, setRunningWorkflowId] = useState<string | null>(null);

  const loadData = async () => {
      setIsSyncing(true);
      try {
          // Load data in parallel for better performance
          const [fetchedJobs, fetchedWorkflows, profile] = await Promise.all([
              db.fetchJobs().catch(err => {
                  console.error("Failed to fetch jobs:", err);
                  addToast('error', 'Load Error', 'Failed to load projects. Some data may be missing.');
                  return [];
              }),
              db.fetchWorkflows().catch(err => {
                  console.error("Failed to fetch workflows:", err);
                  return [];
              }),
              db.getUserProfile().catch(err => {
                  console.error("Failed to fetch profile:", err);
                  return null;
              })
          ]);
          
          setJobs(fetchedJobs);
          setWorkflows(fetchedWorkflows);
          if (profile) {
            setCredits(profile.credits ?? 0);
            setDocumentsUsed(profile.documents_used ?? 0);
            const limits = getPlanLimits(profile.subscription_plan || 'free');
            setDocumentsLimit(limits.documents || 10);
          }
          
          if (fetchedJobs.length > 0) {
              const allFileIds = fetchedJobs.flatMap(j => j.fileIds);
              const uniqueIds = Array.from(new Set(allFileIds));
              if (uniqueIds.length > 0) {
                  const fetchedFiles = await db.fetchFiles(uniqueIds).catch(err => {
                      console.error("Failed to fetch files:", err);
                      addToast('error', 'Load Error', 'Failed to load some files.');
                      return [];
                  });
                  setFiles(fetchedFiles);
              }
          }
      } catch (e: any) {
          console.error("Failed to load data", e);
          const errorMsg = e instanceof Error ? e.message : 'Unknown error';
          addToast('error', 'Sync Failed', `Could not refresh your data: ${errorMsg}`);
      } finally {
          setIsSyncing(false);
      }
  };

  useEffect(() => {
    loadData();
    // Fetch user data
    const fetchUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const profile = await db.getUserProfile();
          setUser({
            email: authUser.email,
            name: profile?.name || authUser.email?.split('@')[0] || 'User'
          });
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
      addToast('error', 'Logout Failed', 'Could not sign out. Please try again.');
    }
  };

  const getUserInitials = () => {
    if (user?.name) {
      const names = user.name.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase();
      }
      return user.name.substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const handleUseCredit = async (amount: number) => {
      try {
          const profile = await db.getUserProfile();
          if (profile) {
            setCredits(profile.credits ?? 0);
            setDocumentsUsed(profile.documents_used ?? 0);
            const limits = getPlanLimits(profile.subscription_plan || 'free');
            setDocumentsLimit(limits.documents || 10);
          }
      } catch (e) {
          console.error("Failed to refresh credits", e);
          addToast('warning', 'Credits Update Failed', 'Credits may be out of sync. Please refresh.');
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

  const handleAutomateClick = () => {
      // Always show dropdown menu, regardless of page
      setShowAutomateMenu(!showAutomateMenu);
  };

  const handleCreateWorkflow = () => {
      const path = location.pathname;
      
      if (path.includes('/sheet/')) {
          // Already on spreadsheet - start recording directly
          setIsRecording(true);
          setSessionSteps([]);
      } else if (path.includes('/extract/')) {
          // Already on extraction - start recording directly
          setIsRecording(true);
          setSessionSteps([]);
      } else {
          // Show modal to choose type
          setCreateWorkflowTypeModal(true);
      }
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
      
      // Determine sourceType based on steps or current page
      const hasExtractionStep = sessionSteps.some(s => s.type === 'extraction');
      const isOnExtractionPage = location.pathname.includes('/extract/');
      const sourceType: 'spreadsheet' | 'pdf' = (hasExtractionStep || isOnExtractionPage) ? 'pdf' : 'spreadsheet';
      
      const newWorkflow: Workflow = {
          id: crypto.randomUUID(),
          name: newWorkflowName,
          sourceType: sourceType,
          steps: sessionSteps,
          createdAt: Date.now(),
          lastRunStatus: 'success'
      };
      await db.upsertWorkflow(newWorkflow);
      setWorkflows(prev => [newWorkflow, ...prev]);
      setShowWorkflowEditor(false);
      setNewWorkflowName('');
      setSessionSteps([]);
      setIsRecording(false);
      addToast('success', 'Workflow Saved', `"${newWorkflowName}" is ready to use.`);
  };

  const handleDeleteStep = (id: string) => {
      setSessionSteps(prev => prev.filter(s => s.id !== id));
  };

  // Get current active file from URL
  const getActiveFile = (): ExcelFile | null => {
      const jobId = location.pathname.match(/\/sheet\/([^\/]+)/)?.[1];
      if (!jobId) return null;
      const job = jobs.find(j => j.id === jobId);
      if (!job || job.fileIds.length === 0) return null;
      return files.find(f => f.id === job.fileIds[0]) || null;
  };

  const runWorkflow = async (workflow: Workflow, targetFile: ExcelFile): Promise<ExcelFile> => {
      try {
          await api.chargeWorkflow();
          const updatedFile = await runWorkflowEngine(workflow, targetFile, {
              addToast,
              getCredits: () => credits,
              onRollback: async (rolledBackFile) => {
                  setFiles(prev => prev.map(f => f.id === targetFile.id ? rolledBackFile : f));
                  await db.upsertFile(rolledBackFile);
                  addToast('info', 'Workflow Rolled Back', 'Changes have been reverted due to critical error.');
              },
          });
          setFiles(prev => prev.map(f => f.id === targetFile.id ? updatedFile : f));
          await db.upsertFile(updatedFile);
          const updatedWorkflow = { ...workflow, lastRun: Date.now(), lastRunStatus: 'success' as const };
          await db.upsertWorkflow(updatedWorkflow);
          setWorkflows(prev => prev.map(w => w.id === workflow.id ? updatedWorkflow : w));
          return updatedFile;
      } catch (error: any) {
          const updatedWorkflow = { ...workflow, lastRun: Date.now(), lastRunStatus: 'failed' as const };
          await db.upsertWorkflow(updatedWorkflow);
          setWorkflows(prev => prev.map(w => w.id === workflow.id ? updatedWorkflow : w));
          throw error;
      }
  };

  const handleExecuteWorkflow = async (wf: Workflow) => {
      if (wf.sourceType === 'spreadsheet') {
          const activeFile = getActiveFile();
          if (activeFile) {
              setIsWorkflowRunning(true);
              setRunningWorkflowId(wf.id);
              try {
              await runWorkflow(wf, activeFile);
              // Navigate to show results if not already there
              const currentJobId = location.pathname.match(/\/sheet\/([^\/]+)/)?.[1];
              if (!currentJobId) {
                  const job = jobs.find(j => j.fileIds.includes(activeFile.id));
                  if (job) {
                      navigate(`/sheet/${job.id}`);
                  }
                  }
              } finally {
                  setIsWorkflowRunning(false);
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
                  setIsWorkflowRunning(true);
                  setRunningWorkflowId(wf.id);
                  const reader = new FileReader();
                  reader.onload = async (ev) => {
                      const ab = ev.target?.result as ArrayBuffer;
                      if (!ab) {
                          setIsWorkflowRunning(false);
                          setRunningWorkflowId(null);
                          return;
                      }
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
                          setJobs(prev => [newJob, ...prev]);
                          setFiles(prev => [...prev, updatedFile]); // Use updatedFile instead of newFile
                          
                          // Navigate to sheet view to show results
                          navigate(`/sheet/${newJob.id}`);
                          
                          addToast('success', 'Workflow Completed', 'File processed and ready to view.');
                      } catch (err) {
                          console.error(err);
                          addToast('error', 'File Error', 'Failed to process file.');
                      } finally {
                          setIsWorkflowRunning(false);
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

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList) return;

    const files = Array.from(fileList);
    
    // Validate files
    const validationResult = validateFiles(files, {
        maxSize: 50 * 1024 * 1024, // 50MB for spreadsheets
        allowedExtensions: ['csv', 'xlsx', 'xls'],
    });
    
    // Show errors for invalid files
    if (validationResult.invalid.length > 0) {
        validationResult.invalid.forEach(({ file, error }) => {
            addToast('error', 'Invalid File', error);
        });
    }
    
    const validFiles = validationResult.valid;
    if (validFiles.length === 0) return;

    setFileUploadInProgress(prev => prev + validFiles.length);
    
    // Process valid files
    validFiles.forEach((file: File) => {
        const reader = new FileReader();
        const onDone = () => {
            setFileUploadInProgress(prev => Math.max(0, prev - 1));
        };
        reader.onload = async (e) => {
            const ab = e.target?.result as ArrayBuffer;
            if (!ab) {
                addToast('error', 'File Error', `Failed to read ${file.name}`);
                onDone();
                return;
            }
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
                
                // Validate parsed data
                if (!data || data.length === 0) {
                    addToast('error', 'File Error', `${file.name} appears to be empty or corrupted.`);
                    onDone();
                    return;
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
                    chatHistory: [{ id: '1', role: 'assistant', content: "Ask anything about your data—sums, charts, comparisons. Upload a file to get started, or try the suggestions below." }]
                };

                await db.upsertJob(newJob);
                await db.upsertFile(newFile);
                handleJobCreated(newJob, newFile);
                addToast('success', 'File uploaded', '');

            } catch (err: any) {
                console.error(err);
                const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                addToast('error', 'File Error', `Failed to parse ${file.name}: ${errorMsg}`);
            } finally {
                onDone();
            }
        };
        
        reader.onerror = () => {
            addToast('error', 'File Error', `Failed to read ${file.name}`);
            onDone();
        };
        
        reader.readAsArrayBuffer(file);
    });
    
    // Reset input
    event.target.value = '';
  };

  return (
    <div className="h-screen flex bg-background overflow-hidden text-foreground">
      {/* Small bottom-right loading for file upload */}
      {fileUploadInProgress > 0 && (
        <div className="fixed bottom-4 right-4 z-[90] flex items-center gap-2 px-3 py-2 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg text-sm font-medium text-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          Loading...
        </div>
      )}

      {/* GLOBAL HIDDEN INPUT FOR DASHBOARD UPLOAD TRIGGER */}
      <input 
        type="file" 
        id="hidden-csv-upload" 
        className="hidden" 
        multiple 
        accept=".xlsx,.xls,.csv" 
        onChange={handleCSVUpload} 
      />

      {/* Desktop Navigation */}
      <Navigation 
        activeView={location.pathname.includes('sheet') ? 'sheet' : location.pathname.includes('dashboard') ? 'dashboard' : location.pathname.includes('workflows') ? 'workflows' : 'extraction'}
        files={files}
        jobs={jobs}
        onFileUpload={handleCSVUpload}
        onMergeClick={() => setShowMergeModal(true)}
      />

      {/* Mobile Navigation Drawer */}
      <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
        <SheetContent side="left" className="w-[280px] p-0 z-[150]">
          <Navigation 
            activeView={location.pathname.includes('sheet') ? 'sheet' : location.pathname.includes('dashboard') ? 'dashboard' : location.pathname.includes('workflows') ? 'workflows' : 'extraction'}
            files={files}
            jobs={jobs}
            onFileUpload={handleCSVUpload}
            onMergeClick={() => setShowMergeModal(true)}
            isMobile={true}
            onNavigate={() => setIsMobileNavOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0 relative">
         <header className="h-14 bg-background border-b border-border flex items-center justify-between px-3 md:px-6 flex-shrink-0 z-[100]">
            <div className="flex items-center gap-2 min-w-0">
                {/* Mobile Hamburger Menu */}
                <button
                  onClick={() => setIsMobileNavOpen(true)}
                  className="md:hidden p-2 -ml-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Open menu"
                >
                  <Menu size={20} />
                </button>
                <div className="hidden md:flex items-center gap-2">
                  <div className="text-sm font-medium text-muted-foreground">Workspace /</div>
                </div>
                <h1 className="font-bold text-foreground text-sm md:text-base truncate">
                    {location.pathname.includes('dashboard') ? 'Overview' : 
                     location.pathname.includes('workflows') ? 'Workflows' :
                     location.pathname.includes('extract') ? 'Extraction' :
                     'Editor'}
                </h1>
                {isSyncing && <Cloud className="animate-pulse text-muted-foreground ml-2 hidden md:block" size={14} />}
            </div>
            
            <div className="flex items-center gap-2 md:gap-3">
               <div className="relative">
                   {isRecording ? (
                       <button 
                           onClick={handleStopRecording}
                           className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-2 md:py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-lg font-bold text-xs md:text-sm animate-pulse hover:bg-red-100 transition-colors min-h-[44px] md:min-h-0"
                       >
                           <StopCircle size={16} fill="currentColor" />
                           <span className="hidden md:inline w-20 text-center">Stop</span>
                       </button>
                   ) : (
                       <button 
                            onClick={handleAutomateClick}
                            disabled={isWorkflowRunning}
                            className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-2 md:py-1.5 bg-background border border-border text-foreground rounded-lg hover:bg-muted transition-colors text-xs md:text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px] md:min-h-0"
                       >
                           {isWorkflowRunning ? (
                               <Loader2 size={16} className="animate-spin text-muted-foreground" />
                           ) : (
                           <Zap size={16} className={showAutomateMenu ? "text-purple-600 fill-purple-100 dark:fill-purple-900/30" : "text-muted-foreground"} />
                           )}
                           <span className="hidden md:inline">{isWorkflowRunning ? "Running..." : "Automate"}</span>
                       </button>
                   )}

                   {showAutomateMenu && !isRecording && (
                       <div className="absolute top-full right-0 mt-2 w-64 md:w-64 bg-background rounded-xl shadow-xl border border-border z-[110] overflow-hidden animate-in fade-in slide-in-from-top-2 max-w-[calc(100vw-2rem)]">
                           <div className="p-2 border-b border-border">
                               <button 
                                   onClick={() => {
                                       setShowAutomateMenu(false);
                                       const path = location.pathname;
                                       // If on sheet/extract page, start recording directly
                                       if (path.includes('/sheet/') || path.includes('/extract/')) {
                                           setIsRecording(true);
                                           setSessionSteps([]);
                                       } else {
                                           // Otherwise show type selection modal
                                           setCreateWorkflowTypeModal(true);
                                       }
                                   }}
                                   className="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-foreground hover:text-red-600 dark:hover:text-red-400 rounded-lg flex items-center gap-3 transition-colors group"
                               >
                                   <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center group-hover:bg-red-200 dark:group-hover:bg-red-950/70 transition-colors">
                                       <Plus size={16} />
                                   </div>
                                   <div>
                                       <div className="font-bold text-sm">Record New</div>
                                       <div className="text-[10px] text-muted-foreground group-hover:text-red-400">Start capturing steps</div>
                                   </div>
                               </button>
                           </div>
                           
                           <div className="p-2">
                               <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Saved Workflows</div>
                               {workflows.length === 0 ? (
                                   <div className="px-3 py-2 text-xs text-muted-foreground italic">No workflows yet.</div>
                               ) : (
                                   workflows.filter(w => w.sourceType === 'spreadsheet').map(w => (
                                       <button 
                                           key={w.id}
                                           className="w-full text-left px-3 py-2 hover:bg-muted rounded-lg flex items-center justify-between group transition-colors"
                                           disabled={isWorkflowRunning}
                                           onClick={() => { setShowAutomateMenu(false); handleExecuteWorkflow(w); }}
                                       >
                                           <div className="flex items-center gap-2 overflow-hidden">
                                               <WorkflowIcon size={14} className="text-muted-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 shrink-0" />
                                               <span className="text-sm text-foreground truncate">{w.name}</span>
                                           </div>
                                           {isWorkflowRunning && runningWorkflowId === w.id ? (
                                               <Loader2 size={12} className="animate-spin text-muted-foreground" />
                                           ) : (
                                           <Play size={12} className="text-muted-foreground group-hover:text-green-600 dark:group-hover:text-green-400 opacity-0 group-hover:opacity-100 transition-all" />
                                           )}
                                       </button>
                                   ))
                               )}
                           </div>
                       </div>
                   )}
                   {showAutomateMenu && !isRecording && (
                       <div className="fixed inset-0 z-[105]" onClick={() => setShowAutomateMenu(false)}></div>
                   )}
               </div>
               
               <div className="hidden sm:flex items-center gap-1.5 px-3 md:px-4 py-2 bg-background text-foreground rounded-lg border border-border text-xs md:text-sm font-medium">
                  <Coins size={16} className="text-muted-foreground" />
                  <span className="whitespace-nowrap">{documentsUsed}/{documentsLimit} docs · {credits} credits</span>
               </div>
               <div className="sm:hidden flex items-center px-2 py-2 bg-background text-foreground rounded-lg border border-border min-h-[44px]">
                  <Coins size={16} className="text-muted-foreground" />
               </div>

               {/* User Menu Dropdown */}
               <DropdownMenu>
                 <DropdownMenuTrigger asChild>
                   <button className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-[#e8e8e8] to-[#d4d4d4] text-[#555] font-semibold text-xs md:text-sm hover:opacity-80 transition-opacity ring-1 ring-[#ddd] min-h-[44px] min-w-[44px]">
                     {user ? getUserInitials() : <CircleUser size={20} />}
                   </button>
                 </DropdownMenuTrigger>
                 <DropdownMenuContent align="end" className="w-64 rounded-xl shadow-lg border border-border p-2">
                   {/* User Info Section */}
                   {user && (
                     <div className="px-3 py-2.5 border-b border-border bg-muted rounded-lg mb-1">
                       <div className="text-sm font-medium text-foreground">{user.name || 'User'}</div>
                       <div className="text-xs text-muted-foreground truncate">{user.email || ''}</div>
                     </div>
                   )}
                   
                   {/* Navigation Items */}
                   <DropdownMenuItem 
                     onClick={() => navigate('/')}
                     className="py-2 px-6 rounded-lg cursor-pointer hover:bg-muted focus:bg-muted focus:text-foreground transition-colors"
                   >
                     <Home size={16} className="mr-3 text-muted-foreground" />
                     <span className="text-sm font-medium text-foreground">Home</span>
                   </DropdownMenuItem>
                   
                   <DropdownMenuItem 
                     onClick={() => navigate('/pricing')}
                     className="py-2 px-6 rounded-lg cursor-pointer hover:bg-muted focus:bg-muted focus:text-foreground transition-colors"
                   >
                     <DollarSign size={16} className="mr-3 text-muted-foreground" />
                     <span className="text-sm font-medium text-foreground">Pricing</span>
                   </DropdownMenuItem>
                   
                   <DropdownMenuItem 
                     onClick={() => window.open('https://help.veriflo.com', '_blank')}
                     className="py-2 px-6 rounded-lg cursor-pointer hover:bg-muted focus:bg-muted focus:text-foreground transition-colors"
                   >
                     <HelpCircle size={16} className="mr-3 text-muted-foreground" />
                     <span className="text-sm font-medium text-foreground">Help & Support</span>
                   </DropdownMenuItem>
                   
                   <DropdownMenuItem 
                     onClick={() => window.open('https://docs.veriflo.com', '_blank')}
                     className="py-2 px-6 rounded-lg cursor-pointer hover:bg-muted focus:bg-muted focus:text-foreground transition-colors"
                   >
                     <BookOpen size={16} className="mr-3 text-muted-foreground" />
                     <span className="text-sm font-medium text-foreground">Documentation</span>
                   </DropdownMenuItem>
                   
                   <DropdownMenuSeparator className="my-1" />
                   
                   {/* Theme Toggle */}
                   <div className="px-6 py-2">
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         <div className="w-4 h-4 flex items-center justify-center">
                           <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/30 dark:border-muted-foreground/50" />
                         </div>
                         <span className="text-sm font-medium text-foreground">Theme</span>
                       </div>
                       <ThemeToggle />
                     </div>
                   </div>
                   
                   <DropdownMenuSeparator className="my-1" />
                   
                   <DropdownMenuItem 
                     onClick={() => navigate('/settings')}
                     className="py-2 px-6 rounded-lg cursor-pointer hover:bg-muted focus:bg-muted focus:text-foreground transition-colors"
                   >
                     <Settings size={16} className="mr-3 text-muted-foreground" />
                     <span className="text-sm font-medium text-foreground">Settings</span>
                   </DropdownMenuItem>
                   
                   <DropdownMenuItem 
                     onClick={handleLogout}
                     className="py-2 px-6 rounded-lg cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/30 focus:bg-red-50 dark:focus:bg-red-950/30 focus:text-red-600 dark:focus:text-red-400 transition-colors"
                   >
                     <LogOut size={16} className="mr-3 text-red-600 dark:text-red-400" />
                     <span className="text-sm font-medium text-red-600 dark:text-red-400">Logout</span>
                   </DropdownMenuItem>
                 </DropdownMenuContent>
               </DropdownMenu>
            </div>
         </header>

         <div className="flex-1 flex overflow-hidden relative">
            <main className="flex-1 relative overflow-y-auto bg-muted/30 dark:bg-background flex flex-col min-h-0">
                <Outlet context={{ 
                    jobs, files, credits, documentsUsed, documentsLimit, handleUseCredit, refreshData: loadData, handleRecordAction, onJobCreated: handleJobCreated, handleCSVUpload, onCreateWorkflow: handleCreateWorkflow, isRecording, onStopRecording: handleStopRecording
                } satisfies WorkspaceContextType} />
            </main>
         </div>

         {/* Workflow Editor Modal */}
         {showWorkflowEditor && (
             <div className="absolute inset-0 z-[60] flex justify-end bg-black/10 dark:bg-black/30 backdrop-blur-[1px]">
                 <div className="w-full md:w-[45%] h-full bg-background shadow-2xl border-l border-border animate-in slide-in-from-right duration-300 flex flex-col">
                     <div className="px-4 md:px-6 py-4 border-b border-border flex items-center justify-between bg-muted/50">
                         <div>
                             <h2 className="text-base md:text-lg font-bold text-foreground">Save Workflow</h2>
                             <p className="text-xs text-muted-foreground hidden md:block">Review recorded steps before saving.</p>
                         </div>
                         <button 
                             onClick={() => { setShowWorkflowEditor(false); setIsRecording(false); setSessionSteps([]); }} 
                             className="p-2 hover:bg-muted rounded-full text-muted-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                         >
                             <X size={20} />
                         </button>
                     </div>
                     <div className="flex-1 overflow-y-auto p-4 md:p-6">
                         <div className="mb-6">
                             <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Workflow Name</label>
                             <input 
                                 type="text" 
                                 placeholder="e.g., Weekly Sales Clean Up"
                                 className="w-full px-4 py-3 border border-border bg-background text-foreground rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                                 value={newWorkflowName}
                                 onChange={(e) => setNewWorkflowName(e.target.value)}
                                 autoFocus
                             />
                         </div>
                         <div className="space-y-3">
                             <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">Recorded Steps</label>
                             {sessionSteps.map((step, idx) => (
                                 <div key={step.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-purple-200 dark:hover:border-purple-800 hover:shadow-sm transition-all group">
                                     <div className="w-6 h-6 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs shrink-0 border border-purple-100 dark:border-purple-900/50">
                                         {idx + 1}
                                     </div>
                                     <div className="flex-1 min-w-0">
                                         <div className="text-sm font-medium text-foreground">{step.description}</div>
                                         <div className="text-[10px] text-muted-foreground font-mono truncate">{JSON.stringify(step.params)}</div>
                                     </div>
                                     <button 
                                         onClick={() => handleDeleteStep(step.id)}
                                         className="p-2 text-muted-foreground hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                     >
                                         <Trash2 size={16} />
                                     </button>
                                 </div>
                             ))}
                         </div>
                     </div>
                     <div className="p-4 md:p-6 border-t border-border bg-muted/50 flex flex-col sm:flex-row justify-end gap-3">
                         <button 
                             onClick={() => { setShowWorkflowEditor(false); setIsRecording(false); setSessionSteps([]); }}
                             className="px-6 py-3 md:py-2.5 font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors text-sm min-h-[44px] md:min-h-0"
                         >
                             Discard
                         </button>
                         <button 
                             onClick={handleSaveWorkflowFromEditor}
                             disabled={!newWorkflowName.trim() || sessionSteps.length === 0}
                             className="px-6 py-3 md:py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 shadow-lg active:scale-95 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] md:min-h-0"
                         >
                             Save Workflow <CheckCircle2 size={16} />
                         </button>
                     </div>
                 </div>
             </div>
         )}
      </div>

      {/* Recording Panel */}
      {isRecording && (
          <div className="fixed md:absolute bottom-4 md:bottom-6 left-4 right-4 md:right-6 md:w-72 bg-background rounded-xl shadow-2xl border border-border z-50 animate-in fade-in slide-in-from-bottom-4 overflow-hidden">
              <div className="bg-red-50 dark:bg-red-950/30 px-4 py-2 border-b border-red-100 dark:border-red-900/50 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-xs uppercase tracking-wider">
                      <span className="w-2 h-2 bg-red-600 dark:bg-red-500 rounded-full animate-pulse"></span>
                      Recording Actions
                  </div>
                  <span className="text-[10px] text-red-500 dark:text-red-400">{sessionSteps.length} steps</span>
              </div>
              <div className="max-h-48 overflow-y-auto p-2 space-y-2">
                  {sessionSteps.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-4 italic">
                          Perform actions on the sheet to record...
                      </div>
                  ) : (
                      sessionSteps.map((step, idx) => (
                          <div key={step.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg border border-border text-xs">
                              <div className="w-4 h-4 rounded-full bg-background border border-border flex items-center justify-center font-bold text-muted-foreground shrink-0">
                                  {idx + 1}
                              </div>
                              <span className="truncate text-foreground">{step.description}</span>
                          </div>
                      ))
                  )}
              </div>
          </div>
      )}

      {/* Create Workflow Type Modal */}
      {createWorkflowTypeModal && (
          <div className="fixed inset-0 z-[300] bg-black/40 dark:bg-black/60 flex items-center justify-center backdrop-blur-md p-4">
              <div className="bg-background p-4 md:p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in fade-in zoom-in duration-200 border border-border">
                  <h2 className="text-[18px] font-semibold text-foreground mb-1.5 tracking-[-0.01em]">Create New Workflow</h2>
                  <p className="text-muted-foreground mb-5 text-[13px]">What type of data process do you want to automate?</p>
                  
                  <div className="space-y-2.5">
                      <button 
                          onClick={() => { 
                              setCreateWorkflowTypeModal(false);
                              const activeFile = getActiveFile();
                              if (activeFile) {
                                  navigate(`/sheet/${jobs.find(j => j.fileIds.includes(activeFile.id))?.id}`);
                                  setIsRecording(true);
                                  setSessionSteps([]);
                              } else {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = '.csv,.xlsx';
                                  input.onchange = (e: any) => {
                                      handleCSVUpload(e);
                                      setTimeout(() => {
                                          setIsRecording(true);
                                          setSessionSteps([]);
                                      }, 1000);
                                  };
                                  input.click();
                              }
                          }}
                          className="w-full p-3.5 border border-border rounded-xl flex items-center gap-3 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition-all group text-left"
                      >
                          <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                              <FileSpreadsheet size={18} />
                          </div>
                          <div>
                              <div className="font-medium text-[14px] text-foreground">Spreadsheet Action</div>
                              <div className="text-[12px] text-muted-foreground">Automate cleaning, sorting, formulas</div>
                          </div>
                      </button>
                      
                      <button 
                          onClick={() => { 
                              setCreateWorkflowTypeModal(false);
                              setIsRecording(true);
                              setSessionSteps([]);
                              navigate('/extract/new');
                          }}
                          className="w-full p-3.5 border border-border rounded-xl flex items-center gap-3 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50/50 dark:hover:bg-orange-950/30 transition-all group text-left"
                      >
                          <div className="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                              <ScanText size={18} />
                          </div>
                          <div>
                              <div className="font-medium text-[14px] text-foreground">PDF Extraction</div>
                              <div className="text-[12px] text-muted-foreground">Automate data extraction from PDFs</div>
                          </div>
                      </button>
                  </div>
                  
                  <button 
                      onClick={() => setCreateWorkflowTypeModal(false)}
                      className="mt-4 w-full py-2 text-[12px] text-muted-foreground font-medium hover:text-foreground transition-colors"
                  >
                      Cancel
                  </button>
              </div>
          </div>
      )}

      {showMergeModal && <MergeModal files={files} onClose={() => setShowMergeModal(false)} onMergeComplete={(newFile) => {
          db.upsertFile(newFile);
          loadData();
          setShowMergeModal(false);
      }} />}
    </div>
  );
};

export default Workspace;
