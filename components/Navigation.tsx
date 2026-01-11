
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, FileText, Plus, GitMerge, Table, 
  MoreHorizontal, Sparkles, History, ScanText, Workflow
} from 'lucide-react';
import { ExcelFile, Job } from '../types';

interface NavigationProps {
  activeView: 'sheet' | 'dashboard' | 'extraction' | 'workflows';
  files: ExcelFile[];
  jobs: Job[];
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMergeClick: () => void;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ 
  activeView, files, jobs, onFileUpload, onMergeClick
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="relative w-[68px] h-full flex-shrink-0 z-50 bg-white">
      <div className="group absolute top-0 left-0 h-full bg-white border-r border-gray-200 text-gray-500 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] w-[68px] hover:w-[260px] flex flex-col shadow-xl overflow-hidden">
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 space-y-6 scrollbar-hide pt-4">
            <div className="px-3 space-y-1">
                 <NavItem 
                   icon={<LayoutDashboard size={20} />} 
                   label="Dashboard" 
                   isActive={activeView === 'dashboard'} 
                   onClick={() => navigate('/dashboard')} 
                 />
                 <NavItem 
                   icon={<Workflow size={20} />} 
                   label="Workflows" 
                   isActive={activeView === 'workflows'} 
                   onClick={() => navigate('/workflows')} 
                 />
                 <NavItem 
                   icon={<ScanText size={20} />} 
                   label="Extraction" 
                   isActive={activeView === 'extraction'} 
                   onClick={() => navigate('/extract/new')} 
                 />
                 <NavItem 
                   icon={<GitMerge size={20} />} 
                   label="Merge Tool" 
                   isActive={false} 
                   onClick={onMergeClick} 
                 />
            </div>

            <div className="px-3">
                <div className="flex items-center justify-between mb-2 px-2 h-6">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap delay-75">
                        Files
                    </span>
                    <label className="cursor-pointer text-gray-400 hover:text-gray-900 transition-colors p-1 rounded hover:bg-gray-100 opacity-0 group-hover:opacity-100">
                        <Plus size={14} />
                        <input type="file" multiple className="hidden" onChange={onFileUpload} accept=".xlsx, .xls, .csv" />
                    </label>
                </div>
                
                <div className="space-y-1">
                    {files.length === 0 ? (
                        <div className="px-2 py-2 text-xs text-gray-400 italic opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity text-center group-hover:text-left">
                            No files
                        </div>
                    ) : (
                        files.map(f => {
                            // Find the job that contains this file
                            const job = jobs.find(j => j.fileIds.includes(f.id));
                            if (!job) return null;
                            return (
                                <NavItem
                                    key={f.id}
                                    icon={<FileText size={18} />}
                                    label={f.name}
                                    isActive={location.pathname === `/sheet/${job.id}`}
                                    onClick={() => navigate(`/sheet/${job.id}`)}
                                />
                            );
                        }).filter(Boolean)
                    )}
                </div>
            </div>
            
            <div className="px-3">
                <div className="px-2 mb-2 h-6 flex items-center">
                     <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap delay-75">
                        Recent
                     </span>
                </div>
                <div className="space-y-1">
                   <NavItem icon={<History size={18} />} label="Q4 Revenue Analysis" onClick={() => {}} />
                   <NavItem icon={<Sparkles size={18} />} label="Customer Churn" onClick={() => {}} />
                </div>
            </div>
        </div>

        <div className="p-3 border-t border-gray-200 bg-white">
            <button className="w-full flex items-center gap-3 px-2 py-2 hover:bg-gray-50 rounded-lg transition-colors group-hover:justify-start justify-center relative overflow-hidden">
                <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600 font-bold text-xs flex-shrink-0">
                    JD
                </div>
                <div className="flex-1 min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-left overflow-hidden delay-75">
                    <div className="text-sm font-medium text-gray-700 truncate">John Doe</div>
                    <div className="text-xs text-gray-500 truncate">Pro Member</div>
                </div>
                <MoreHorizontal size={16} className="text-gray-400 group-hover:text-gray-600 opacity-0 group-hover:opacity-100 absolute right-2" />
            </button>
        </div>
      </div>
    </div>
  );
};

const NavItem: React.FC<NavItemProps> = ({ icon, label, isActive, onClick }) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm transition-all duration-200 group-hover:justify-start justify-center relative overflow-hidden
            ${isActive 
                ? 'bg-gray-100 text-gray-900 shadow-sm ring-1 ring-gray-200 font-medium' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
        title={label} 
    >
        <div className={`flex-shrink-0 transition-colors ${isActive ? 'text-gray-800' : 'text-gray-400 group-hover:text-gray-600'}`}>
            {icon}
        </div>
        <span className="opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap overflow-hidden delay-75 text-left flex-1 truncate">
            {label}
        </span>
        {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gray-900 rounded-r-full hidden group-hover:block animate-in fade-in zoom-in" />} 
    </button>
);

export default Navigation;
