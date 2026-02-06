
import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { 
  FileSpreadsheet, ScanText, Clock, AlertTriangle, CheckCircle2, 
  MoreHorizontal, Plus, Trash2, Pencil, AlertCircle,
  FolderOpen, Calendar, ArrowUpRight, Sparkles
} from 'lucide-react';
import { Job, ExcelFile } from '../types';
import { db } from '../lib/db';
import { useToast } from './ui/toast';
import { WorkspaceContextType } from './Workspace';
import { supabase } from '../lib/supabase';
import WelcomeModal from './WelcomeModal';
import { trackEvent } from '../lib/analytics';

const Dashboard: React.FC = () => {
  const { jobs, onJobCreated, refreshData } = useOutletContext<WorkspaceContextType>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [userName, setUserName] = useState<string>('');
  
  const needsAttentionJobs = jobs.filter(j => j.status === 'needs_review');
  const recentJobs = jobs.filter(j => j.status !== 'needs_review').sort((a, b) => b.updatedAt - a.updatedAt);

  const [openMenuJobId, setOpenMenuJobId] = useState<string | null>(null);
  const [renameJobId, setRenameJobId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Only use name from metadata, never use email
        const fullName = user.user_metadata?.full_name || user.user_metadata?.name;
        if (fullName && fullName.trim()) {
          // Get first name from full name
          setUserName(fullName.trim().split(' ')[0]);
        } else {
          // If no name in metadata, use generic greeting
          setUserName('there');
        }
      }
    };
    fetchUser();
  }, []);

  // Track page view
  useEffect(() => {
    trackEvent('page_view', { page: 'dashboard' });
  }, []);

  // Check if this is first visit
  useEffect(() => {
    const checkFirstVisit = () => {
      const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
      // Show modal if user hasn't seen it AND has no projects (truly new user)
      if (!hasSeenWelcome) {
        // Small delay for smooth appearance after component mounts
        const timer = setTimeout(() => {
          setShowWelcomeModal(true);
        }, 600);
        return () => clearTimeout(timer);
      }
    };
    
    // Check after component is fully mounted
    const timer = setTimeout(checkFirstVisit, 200);
    return () => clearTimeout(timer);
  }, []);

  // Enter key confirms delete when delete modal is open
  useEffect(() => {
    if (!deleteJobId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleDeleteJob(deleteJobId);
        setDeleteJobId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteJobId]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleCreateEmpty = async () => {
    try {
        const fileId = crypto.randomUUID();
        const headers = Array.from({length: 10}, (_, i) => String.fromCharCode(65 + i));
        const data = [headers, ...Array.from({ length: 50 }, () => Array(10).fill(''))];
        
        const newFile: ExcelFile = {
            id: fileId, name: "Untitled Spreadsheet", data, columns: headers, styles: {},
            lastModified: Date.now(), history: [{ data, styles: {}, columns: headers }], currentHistoryIndex: 0
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

  const handleLoadDemo = async () => {
    try {
        const demoData = [
            ["Date", "Product", "Region", "Sales", "Units", "Customer"],
            ["2024-01-01", "Laptop Pro", "North", 1200, 1, "TechCorp"],
            ["2024-01-02", "Mouse", "South", 25, 5, "Indie"],
            ["2024-01-03", "Monitor 4K", "East", 450, 2, "DesignStudio"],
            ["2024-01-04", "Laptop Pro", "West", 2400, 2, "StartUp Inc"],
            ["2024-01-05", "Keyboard", "North", 80, 4, "TechCorp"],
            ["2024-01-06", "Mouse", "East", 30, 6, "DesignStudio"],
            ["2024-01-07", "Laptop Air", "South", 900, 1, "Indie"]
        ];
        
        const fileId = crypto.randomUUID();
        const newFile: ExcelFile = {
            id: fileId,
            name: "Demo Sales Data.csv",
            data: demoData,
            columns: demoData[0].map(String),
            styles: {},
            lastModified: Date.now(),
            history: [{ data: demoData, styles: {}, columns: demoData[0].map(String) }],
            currentHistoryIndex: 0
        };

        const newJob: Job = {
            id: crypto.randomUUID(),
            title: "Demo Sales Analysis",
            type: 'spreadsheet',
            status: 'completed',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            fileIds: [fileId],
            chatHistory: [{ id: '1', role: 'assistant', content: "I've loaded the demo sales data. Try asking: 'Analyze sales by region' or 'What is the top selling product?'" }]
        };

        await db.upsertJob(newJob);
        await db.upsertFile(newFile);
        onJobCreated(newJob, newFile);
        addToast('success', 'Demo Loaded', 'Demo project created successfully.');
        
    } catch (err) {
        console.error(err);
        addToast('error', 'Error', 'Failed to load demo data.');
    }
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
    <div 
      className="h-full min-h-full overflow-y-auto bg-muted/30 dark:bg-[hsl(220_15%_9%)]" 
      onClick={() => setOpenMenuJobId(null)}
    >
      <div className="max-w-6xl mx-auto px-4 py-6 md:px-8 md:py-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-[28px] font-semibold text-foreground tracking-[-0.02em] mb-1">
              {getGreeting()}{userName ? `, ${userName}` : ''}
            </h1>
            <p className="text-sm md:text-[15px] text-muted-foreground">What would you like to do today?</p>
          </div>
          <button 
            onClick={handleLoadDemo}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 md:py-2.5 text-[13px] font-medium text-muted-foreground bg-background border border-border rounded-xl hover:border-border/80 hover:text-foreground transition-all shadow-sm min-h-[44px] md:min-h-0"
          >
            <Sparkles size={14} />
            Try Demo
          </button>
        </div>

        {/* ACTION CARDS */}
        <div className="mb-8 md:mb-10">
          <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Extract Data Card */}
            <button 
              onClick={() => navigate('/extract/new')} 
              className="group relative bg-gradient-to-br from-[#0a0a0a] to-[#262626] rounded-2xl p-5 md:p-6 text-left overflow-hidden transition-all duration-300 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 min-h-[140px] md:min-h-0"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500" />
              <div className="relative z-10">
                <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center mb-5 group-hover:bg-white/15 transition-colors">
                  <ScanText size={20} className="text-white" />
                </div>
                <h3 className="text-[17px] font-semibold text-white mb-1.5">Extract Data</h3>
                <p className="text-[13px] text-white/60 leading-relaxed">Upload PDFs and let AI extract structured data</p>
                <div className="mt-4 flex items-center gap-1 text-[12px] font-medium text-white/40 group-hover:text-white/60 transition-colors">
                  <span>Get started</span>
                  <ArrowUpRight size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>
            </button>

            {/* Upload File Card */}
            <button 
              onClick={() => document.getElementById('hidden-csv-upload')?.click()} 
              className="group bg-card rounded-2xl p-5 md:p-6 text-left border border-border transition-all duration-300 hover:border-border/80 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.4)] hover:-translate-y-0.5 min-h-[140px] md:min-h-0"
            >
              <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center mb-5 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/30 transition-colors">
                <FileSpreadsheet size={20} className="text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
              </div>
              <h3 className="text-[17px] font-semibold text-foreground mb-1.5">Upload File</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">Import CSV or Excel files for analysis</p>
              <div className="mt-4 flex items-center gap-1 text-[12px] font-medium text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                <span>Browse files</span>
                <ArrowUpRight size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </button>

            {/* New Sheet Card */}
            <button 
              onClick={handleCreateEmpty} 
              className="group bg-card rounded-2xl p-5 md:p-6 text-left border border-border transition-all duration-300 hover:border-border/80 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.4)] hover:-translate-y-0.5 min-h-[140px] md:min-h-0"
            >
              <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center mb-5 group-hover:bg-green-50 dark:group-hover:bg-green-950/30 transition-colors">
                <Plus size={20} className="text-muted-foreground group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" />
              </div>
              <h3 className="text-[17px] font-semibold text-foreground mb-1.5">New Sheet</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">Start fresh with an empty spreadsheet</p>
              <div className="mt-4 flex items-center gap-1 text-[12px] font-medium text-muted-foreground group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                <span>Create new</span>
                <ArrowUpRight size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </button>
          </div>
        </div>

        {/* NEEDS ATTENTION */}
        {needsAttentionJobs.length > 0 && (
          <div className="mb-8 md:mb-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">Needs Review</h2>
              <span className="text-[11px] font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 px-2 py-0.5 rounded-full">{needsAttentionJobs.length}</span>
            </div>
            <div className="bg-card rounded-xl border border-orange-200 dark:border-orange-900/50 shadow-sm overflow-hidden">
              {needsAttentionJobs.map((job, idx) => (
                <div 
                  key={job.id} 
                  onClick={() => navigate(`/extract/${job.id}/review`)} 
                  className={`p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 cursor-pointer group transition-colors min-h-[80px] sm:min-h-0 ${idx !== needsAttentionJobs.length - 1 ? 'border-b border-orange-100 dark:border-orange-900/30' : ''}`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                      {job.riskyCount || '!'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[14px] font-medium text-foreground truncate">{job.title}</h4>
                      <p className="text-[12px] text-orange-600 dark:text-orange-400 font-medium flex items-center gap-1 mt-0.5">
                        <Clock size={11} /> Pending verification
                      </p>
                    </div>
                  </div>
                  <button className="px-4 py-2.5 sm:py-2 text-[13px] font-medium text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/30 rounded-lg group-hover:bg-orange-100 dark:group-hover:bg-orange-950/50 transition-colors w-full sm:w-auto min-h-[44px] sm:min-h-0">
                    Review
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RECENT PROJECTS */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">Recent Projects</h2>
            {recentJobs.length > 0 && (
              <span className="text-[12px] text-muted-foreground hidden sm:inline">{recentJobs.length} projects</span>
            )}
          </div>
          
          {recentJobs.length === 0 ? (
            <div className="text-center py-12 md:py-16 bg-card rounded-2xl border border-dashed border-border px-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <FolderOpen size={24} className="text-muted-foreground" />
              </div>
              <h3 className="text-[15px] font-medium text-foreground mb-1">No projects yet</h3>
              <p className="text-[13px] text-muted-foreground mb-5 max-w-sm mx-auto leading-relaxed">
                Start by extracting PDFs, uploading a spreadsheet, or creating a new sheet.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                <button 
                  onClick={() => navigate('/extract/new')}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 md:py-2.5 text-[13px] font-medium text-white bg-foreground rounded-xl hover:bg-foreground/90 transition-colors min-h-[44px] md:min-h-0"
                >
                  <Plus size={14} />
                  New Project
                </button>
                <button 
                  onClick={handleLoadDemo}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 md:py-2.5 text-[13px] font-medium text-muted-foreground bg-background border border-border rounded-xl hover:border-border/80 hover:text-foreground transition-colors min-h-[44px] md:min-h-0"
                >
                  <Sparkles size={14} />
                  Try Demo
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentJobs.slice(0, 9).map(job => (
                <div 
                  key={job.id} 
                  onClick={() => navigate(`/sheet/${job.id}`)} 
                  className={`relative bg-card rounded-xl border border-border p-5 cursor-pointer group transition-all duration-200 hover:border-border/80 hover:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.3)] ${openMenuJobId === job.id ? 'z-20 border-blue-300 dark:border-blue-700 shadow-md' : 'z-0'}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${job.type === 'extraction' ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400' : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'}`}>
                      {job.type === 'extraction' ? <ScanText size={18} /> : <FileSpreadsheet size={18} />}
                    </div>
                    <div className="relative">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setOpenMenuJobId(openMenuJobId === job.id ? null : job.id); }} 
                        className={`p-1.5 rounded-lg transition-colors ${openMenuJobId === job.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {openMenuJobId === job.id && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-background border border-border rounded-xl shadow-lg overflow-hidden z-50">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setRenameJobId(job.id); setRenameTitle(job.title); setOpenMenuJobId(null); }} 
                            className="w-full text-left px-3 py-2.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2 transition-colors"
                          >
                            <Pencil size={13} /> Rename
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setDeleteJobId(job.id); setOpenMenuJobId(null); }} 
                            className="w-full text-left px-3 py-2.5 text-[13px] text-muted-foreground hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-2 border-t border-border transition-colors"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <h4 className="text-[14px] font-medium text-foreground mb-1 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{job.title}</h4>
                  
                  <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {getRelativeTime(job.updatedAt)}
                    </span>
                    {job.fileIds && job.fileIds.length > 0 && (
                      <span className="flex items-center gap-1">
                        <FileSpreadsheet size={11} />
                        {job.fileIds.length} file{job.fileIds.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  
                  {job.status === 'verified' && (
                    <div className="absolute top-4 right-12 flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">
                      <CheckCircle2 size={10} />
                      Verified
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RENAME MODAL */}
      {renameJobId && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4" onClick={() => setRenameJobId(null)}>
          <div className="bg-background p-4 md:p-6 rounded-2xl shadow-2xl w-full max-w-md border border-border" onClick={e => e.stopPropagation()}>
            <h3 className="text-base md:text-[17px] font-semibold text-foreground mb-4">Rename Project</h3>
            <input 
              className="w-full px-4 py-3 md:py-3 border border-border bg-background text-foreground rounded-xl text-[14px] mb-5 focus:outline-none focus:border-foreground focus:ring-1 focus:ring-foreground transition-all min-h-[44px]" 
              value={renameTitle} 
              onChange={(e) => setRenameTitle(e.target.value)} 
              autoFocus 
              onKeyDown={(e) => e.key === 'Enter' && (handleRenameJob(renameJobId, renameTitle), setRenameJobId(null))} 
            />
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <button onClick={() => setRenameJobId(null)} className="px-4 py-3 md:py-2.5 text-[13px] font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors min-h-[44px] md:min-h-0">Cancel</button>
              <button onClick={() => { handleRenameJob(renameJobId, renameTitle); setRenameJobId(null); }} className="px-5 py-3 md:py-2.5 text-[13px] font-medium text-white bg-foreground rounded-lg hover:bg-foreground/90 transition-colors min-h-[44px] md:min-h-0">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteJobId && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4" onClick={() => setDeleteJobId(null)}>
          <div className="bg-background p-4 md:p-6 rounded-2xl shadow-2xl w-full max-w-md border border-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-base md:text-[17px] font-semibold text-foreground">Delete Project?</h3>
            </div>
            <p className="text-sm md:text-[14px] text-muted-foreground leading-relaxed mb-6">This action cannot be undone. All associated files and data will be permanently removed.</p>
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <button onClick={() => setDeleteJobId(null)} className="px-4 py-3 md:py-2.5 text-[13px] font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors min-h-[44px] md:min-h-0">Cancel</button>
              <button onClick={() => { handleDeleteJob(deleteJobId); setDeleteJobId(null); }} className="px-5 py-3 md:py-2.5 text-[13px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors min-h-[44px] md:min-h-0">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Welcome Modal */}
      {showWelcomeModal && (
        <WelcomeModal
          userName={userName}
          onClose={() => {
            setShowWelcomeModal(false);
            localStorage.setItem('hasSeenWelcome', 'true');
          }}
          onTryDemo={handleLoadDemo}
          onExtract={() => navigate('/extract/new')}
          onUpload={() => document.getElementById('hidden-csv-upload')?.click()}
          onCreateSheet={handleCreateEmpty}
        />
      )}
    </div>
  );
};

export default Dashboard;
