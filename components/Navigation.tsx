
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, FileText, Plus, GitMerge, Table, 
  MoreHorizontal, Sparkles, History, ScanText, Workflow, LogOut
} from 'lucide-react';
import { ExcelFile, Job } from '../types';
import { supabase } from '../lib/supabase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

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
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser({
          email: user.email,
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User'
        });
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  };

  const getUserInitials = () => {
    if (!user?.name) return 'U';
    const names = user.name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return user.name.substring(0, 2).toUpperCase();
  };

  const isExpanded = isHovered || isDropdownOpen;

  return (
    <div ref={navRef} className="relative w-[68px] h-full flex-shrink-0 z-50" style={{ backgroundColor: 'white' }}>
      <div 
        className={`group absolute top-0 left-0 h-full border-r border-gray-200 text-gray-500 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col shadow-xl ${isExpanded ? 'w-[260px]' : 'w-[68px]'}`}
        style={{ 
          backgroundColor: 'white',
          overflow: isDropdownOpen ? 'visible' : 'hidden',
          minHeight: '100%'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={(e) => {
          // Don't collapse if dropdown is open
          if (isDropdownOpen) return;
          // Check if mouse is moving to dropdown menu (which is in a portal)
          const relatedTarget = e.relatedTarget as HTMLElement;
          if (relatedTarget && relatedTarget.closest('[data-radix-portal]')) {
            return;
          }
          setIsHovered(false);
        }}
      >
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 space-y-6 scrollbar-hide pt-4" style={{ backgroundColor: 'white' }}>
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
                        Active Files
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
                    {(() => {
                        const recentJobs = jobs
                            .filter(j => j.status !== 'needs_review')
                            .sort((a, b) => b.updatedAt - a.updatedAt)
                            .slice(0, 5);
                        
                        if (recentJobs.length === 0) {
                            return (
                                <div className="px-2 py-2 text-xs text-gray-400 italic opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity text-center group-hover:text-left">
                                    No recent projects
                                </div>
                            );
                        }
                        
                        return recentJobs.map(job => (
                            <NavItem
                                key={job.id}
                                icon={job.type === 'extraction' ? <ScanText size={18} /> : <FileText size={18} />}
                                label={job.title}
                                isActive={location.pathname === `/sheet/${job.id}`}
                                onClick={() => navigate(`/sheet/${job.id}`)}
                            />
                        ));
                    })()}
                </div>
            </div>
        </div>

        <div 
          className="p-3 border-t border-gray-200 relative z-10" 
          style={{ backgroundColor: 'white', position: 'relative' }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => {
            // Only collapse if dropdown is closed and we're actually leaving the area
            if (!isDropdownOpen) {
              // Use a small delay to allow dropdown to open
              setTimeout(() => {
                if (!isDropdownOpen) setIsHovered(false);
              }, 100);
            }
          }}
        >
            <div className="relative">
                <button 
                  className="w-full flex items-center gap-1 px-2 py-2 hover:bg-gray-50 rounded-lg transition-colors group-hover:justify-start justify-center relative overflow-visible"
                  onMouseEnter={() => setIsHovered(true)}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                    <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600 font-bold text-xs flex-shrink-0">
                        {getUserInitials()}
                    </div>
                    <div className="flex-1 min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-left overflow-hidden delay-75">
                        <div className="text-sm font-medium text-gray-700 truncate">{user?.name || 'User'}</div>
                        <div className="text-xs text-gray-500 truncate">{user?.email || ''}</div>
                    </div>
                    <MoreHorizontal size={16} className="text-gray-400 group-hover:text-gray-600 opacity-0 group-hover:opacity-100 absolute right-2" />
                </button>
                
                {isDropdownOpen && (
                  <div 
                    className="absolute bottom-full right-0 mb-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-[60]"
                    style={{ backgroundColor: 'white' }}
                    onMouseEnter={() => {
                      setIsHovered(true);
                      setIsDropdownOpen(true);
                    }}
                    onMouseLeave={() => setIsDropdownOpen(false)}
                  >
                    <div className="px-2 py-1.5 border-b border-gray-100">
                        <div className="text-sm font-medium text-gray-900">{user?.name || 'User'}</div>
                        <div className="text-xs text-gray-500 truncate">{user?.email || ''}</div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-sm transition-colors cursor-pointer"
                    >
                        <LogOut className="h-4 w-4" />
                        <span>Log out</span>
                    </button>
                  </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

const NavItem: React.FC<NavItemProps> = ({ icon, label, isActive, onClick }) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center gap-1 px-2.5 py-2.5 rounded-lg text-sm transition-all duration-200 group-hover:justify-start justify-center relative overflow-hidden
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
