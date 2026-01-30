
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, FileText, Plus, GitMerge,
  MoreHorizontal, ScanText, Workflow, LogOut, Settings, ChevronRight
} from 'lucide-react';
import { ExcelFile, Job } from '../types';
import { supabase } from '../lib/supabase';

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
  isExpanded: boolean;
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
    <div ref={navRef} className="relative w-[68px] h-full flex-shrink-0 z-[200]">
      <div 
        className={`group absolute top-0 left-0 h-full bg-[#f9f9f9] border-r border-[#e5e5e5] transition-all duration-300 ease-out flex flex-col ${isExpanded ? 'w-[260px] shadow-[4px_0_24px_-2px_rgba(0,0,0,0.08)]' : 'w-[68px]'}`}
        style={{ 
          overflow: isDropdownOpen ? 'visible' : 'hidden',
          minHeight: '100%'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={(e) => {
          if (isDropdownOpen) return;
          const relatedTarget = e.relatedTarget as HTMLElement;
          if (relatedTarget && relatedTarget.closest('[data-radix-portal]')) {
            return;
          }
          setIsHovered(false);
        }}
      >
        {/* New Project Button */}
        <div className="px-2 pt-4 pb-2">
          <label 
            style={{ transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
            className={`flex items-center px-3 py-3 rounded-xl border border-[#e0e0e0] bg-white cursor-pointer hover:bg-[#f5f5f5] overflow-hidden ${isExpanded ? 'w-full gap-3' : 'w-[44px] gap-0'}`}
          >
            <Plus size={18} className="text-[#666] flex-shrink-0" strokeWidth={2} />
            <span 
              style={{ transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
              className={`text-[13px] font-medium text-[#333] whitespace-nowrap ${isExpanded ? 'opacity-100' : 'opacity-0'}`}
            >
              New Project
            </span>
            <input type="file" multiple className="hidden" onChange={onFileUpload} accept=".xlsx, .xls, .csv" />
          </label>
        </div>
        
        {/* Main Navigation */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
          <div className="px-2 space-y-0.5">
            <NavItem 
              icon={<LayoutDashboard size={18} />} 
              label="Dashboard" 
              isActive={activeView === 'dashboard'} 
              onClick={() => navigate('/dashboard')}
              isExpanded={isExpanded}
            />
            <NavItem 
              icon={<Workflow size={18} />} 
              label="Workflows" 
              isActive={activeView === 'workflows'} 
              onClick={() => navigate('/workflows')}
              isExpanded={isExpanded}
            />
            <NavItem 
              icon={<ScanText size={18} />} 
              label="Extraction" 
              isActive={activeView === 'extraction'} 
              onClick={() => navigate('/extract/new')}
              isExpanded={isExpanded}
            />
          </div>

          {/* Recent Section */}
          <div className="mt-6 px-2">
            <div className={`flex items-center mb-1.5 px-2.5 h-5 transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
              <span className="text-[11px] font-semibold text-[#999] uppercase tracking-wide">
                Recent
              </span>
            </div>
            <div className="space-y-0.5">
              {(() => {
                const recentJobs = jobs
                  .filter(j => j.status !== 'needs_review')
                  .sort((a, b) => b.updatedAt - a.updatedAt)
                  .slice(0, 5);
                
                if (recentJobs.length === 0) {
                  return (
                    <div className={`px-2.5 py-2 text-[12px] text-[#999] transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                      No recent projects
                    </div>
                  );
                }
                
                return recentJobs.map(job => (
                  <NavItem
                    key={job.id}
                    icon={job.type === 'extraction' ? <ScanText size={16} /> : <FileText size={16} />}
                    label={job.title}
                    isActive={location.pathname === `/sheet/${job.id}`}
                    onClick={() => navigate(`/sheet/${job.id}`)}
                    isExpanded={isExpanded}
                  />
                ));
              })()}
            </div>
          </div>
        </div>

        {/* User Section */}
        <div 
          className="p-2 border-t border-[#e5e5e5] bg-[#f9f9f9]"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => {
            if (!isDropdownOpen) {
              setTimeout(() => {
                if (!isDropdownOpen) setIsHovered(false);
              }, 100);
            }
          }}
        >
          <div className="relative">
            <button 
              style={{ transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
              className={`flex items-center px-2.5 py-2 rounded-xl hover:bg-[#ebebeb] overflow-hidden ${isExpanded ? 'w-full gap-2.5' : 'w-[48px] gap-0'}`}
              onMouseEnter={() => setIsHovered(true)}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#e8e8e8] to-[#d4d4d4] flex items-center justify-center text-[#555] font-semibold text-[11px] flex-shrink-0 ring-1 ring-[#ddd]">
                {getUserInitials()}
              </div>
              <div 
                style={{ transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
                className={`min-w-0 text-left flex-1 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}
              >
                <div className="text-[13px] font-medium text-[#333] truncate">{user?.name || 'User'}</div>
                <div className="text-[11px] text-[#888] truncate">{user?.email || ''}</div>
              </div>
              <MoreHorizontal 
                size={16} 
                style={{ transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
                className={`text-[#888] flex-shrink-0 ${isExpanded ? 'opacity-100' : 'opacity-0'}`} 
              />
            </button>
            
            {isDropdownOpen && (
              <div 
                className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-[#e5e5e5] rounded-xl shadow-lg overflow-hidden z-[60]"
                onMouseEnter={() => {
                  setIsHovered(true);
                  setIsDropdownOpen(true);
                }}
                onMouseLeave={() => setIsDropdownOpen(false)}
              >
                <div className="px-3 py-2.5 border-b border-[#f0f0f0] bg-[#fafafa]">
                  <div className="text-[13px] font-medium text-[#333]">{user?.name || 'User'}</div>
                  <div className="text-[11px] text-[#888] truncate">{user?.email || ''}</div>
                </div>
                <div className="p-1">
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setIsHovered(false);
                      navigate('/settings');
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-[13px] text-[#444] hover:bg-[#f5f5f5] rounded-lg transition-colors"
                  >
                    <Settings size={15} className="text-[#666]" />
                    <span>Settings</span>
                    <ChevronRight size={14} className="ml-auto text-[#999]" />
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-[13px] text-[#dc2626] hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <LogOut size={15} />
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const NavItem: React.FC<NavItemProps> = ({ icon, label, isActive, onClick, isExpanded }) => (
  <button 
    onClick={onClick}
    style={{ transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
    className={`flex items-center px-3 py-3 rounded-xl text-[13px] relative overflow-hidden
      ${isExpanded ? 'w-full gap-3' : 'w-[44px] gap-0'}
      ${isActive 
        ? 'bg-[#ebebeb] text-[#1a1a1a] font-medium' 
        : 'text-[#555] hover:bg-[#ebebeb] hover:text-[#1a1a1a]'
      }`}
    title={label} 
  >
    <div className={`flex-shrink-0 ${isActive ? 'text-[#1a1a1a]' : 'text-[#666]'}`}>
      {icon}
    </div>
    <span 
      style={{ transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
      className={`whitespace-nowrap text-left truncate flex-1 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}
    >
      {label}
    </span>
    {isActive && isExpanded && (
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-[#1a1a1a] rounded-r-full" />
    )}
  </button>
);

export default Navigation;
