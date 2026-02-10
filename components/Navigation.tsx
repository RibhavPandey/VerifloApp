
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, FileText, Plus, GitMerge,
  ScanText, Workflow, DollarSign
} from 'lucide-react';
import { ExcelFile, Job } from '../types';
import { supabase } from '../lib/supabase';

interface NavigationProps {
  activeView: 'sheet' | 'dashboard' | 'extraction' | 'workflows';
  files: ExcelFile[];
  jobs: Job[];
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMergeClick: () => void;
  isMobile?: boolean;
  onNavigate?: () => void;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick: () => void;
  isExpanded: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ 
  activeView, files, jobs, onFileUpload, onMergeClick, isMobile = false, onNavigate
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  const handleNavClick = (callback: () => void) => {
    callback();
    if (isMobile && onNavigate) {
      onNavigate();
    }
  };

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


  const getUserInitials = () => {
    if (!user?.name) return 'U';
    const names = user.name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return user.name.substring(0, 2).toUpperCase();
  };

  const isExpanded = isHovered || isMobile;

  // Mobile: render as simple content (will be wrapped in Sheet)
  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-sidebar">
        {/* New Project Button */}
        <div className="px-2 pt-4 pb-2">
          <label 
            className="flex items-center px-3 py-3 rounded-xl border border-border bg-background cursor-pointer hover:bg-muted overflow-hidden w-full gap-3 min-h-[44px]"
          >
            <Plus size={18} className="text-muted-foreground flex-shrink-0" strokeWidth={2} />
            <span className="text-[13px] font-medium text-foreground whitespace-nowrap">
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
              onClick={() => handleNavClick(() => navigate('/dashboard'))}
              isExpanded={true}
            />
            <NavItem 
              icon={<Workflow size={18} />} 
              label="Workflows" 
              isActive={activeView === 'workflows'} 
              onClick={() => handleNavClick(() => navigate('/workflows'))}
              isExpanded={true}
            />
            <NavItem 
              icon={<ScanText size={18} />} 
              label="Extraction" 
              isActive={activeView === 'extraction'} 
              onClick={() => handleNavClick(() => navigate('/extract/new'))}
              isExpanded={true}
            />
            <NavItem 
              icon={<DollarSign size={18} />} 
              label="Upgrade" 
              isActive={location.pathname === '/pricing'} 
              onClick={() => handleNavClick(() => navigate('/pricing'))}
              isExpanded={true}
            />
          </div>

          {/* Recent Section */}
          <div className="mt-6 px-2">
            <div className="flex items-center mb-1.5 px-2.5 h-5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
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
                    <div className="px-2.5 py-2 text-[12px] text-muted-foreground">
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
                    onClick={() => handleNavClick(() => navigate(`/sheet/${job.id}`))}
                    isExpanded={true}
                  />
                ));
              })()}
            </div>
          </div>
        </div>

        {/* User Section */}
        <div className="p-2 border-t border-sidebar-border bg-sidebar">
          <div className="flex items-center px-2.5 py-2 rounded-xl overflow-hidden w-full gap-2.5 min-h-[44px]">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-muted to-muted/80 flex items-center justify-center text-muted-foreground font-semibold text-[11px] flex-shrink-0 ring-1 ring-border">
              {getUserInitials()}
            </div>
            <div className="min-w-0 text-left flex-1">
              <div className="text-[13px] font-medium text-sidebar-foreground truncate">{user?.name || 'User'}</div>
              <div className="text-[11px] text-muted-foreground truncate">{user?.email || ''}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop: render as sidebar (width in layout so content is pushed, no overlap)
  return (
    <div
      ref={navRef}
      className="relative h-full flex-shrink-0 hidden md:block transition-[width] duration-300 ease-out overflow-hidden"
      style={{ width: isExpanded ? 260 : 68 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={(e) => {
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (relatedTarget && relatedTarget.closest('[data-radix-portal]')) {
          return;
        }
        setIsHovered(false);
      }}
    >
      <div
        className="group h-full min-w-[260px] w-[260px] bg-sidebar border-r border-sidebar-border flex flex-col shadow-[4px_0_24px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_24px_-2px_rgba(0,0,0,0.3)]"
        style={{ minHeight: '100%' }}
      >
        {/* New Project Button */}
        <div className="px-2 pt-4 pb-2">
          <label 
            style={{ transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
            className={`flex items-center px-3 py-3 rounded-xl border border-border bg-background cursor-pointer hover:bg-muted overflow-hidden ${isExpanded ? 'w-full gap-3' : 'w-[44px] gap-0'}`}
          >
            <Plus size={18} className="text-muted-foreground flex-shrink-0" strokeWidth={2} />
            <span 
              style={{ transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
              className={`text-[13px] font-medium text-foreground whitespace-nowrap ${isExpanded ? 'opacity-100' : 'opacity-0'}`}
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
            <NavItem 
              icon={<DollarSign size={18} />} 
              label="Upgrade" 
              isActive={location.pathname === '/pricing'} 
              onClick={() => navigate('/pricing')}
              isExpanded={isExpanded}
            />
          </div>

          {/* Recent Section */}
          <div className="mt-6 px-2">
            <div className={`flex items-center mb-1.5 px-2.5 h-5 transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
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
                    <div className={`px-2.5 py-2 text-[12px] text-muted-foreground transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
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
        <div className="p-2 border-t border-sidebar-border bg-sidebar">
          <div 
            style={{ transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
            className={`flex items-center px-2.5 py-2 rounded-xl overflow-hidden ${isExpanded ? 'w-full gap-2.5' : 'w-[48px] gap-0'}`}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-muted to-muted/80 flex items-center justify-center text-muted-foreground font-semibold text-[11px] flex-shrink-0 ring-1 ring-border">
              {getUserInitials()}
            </div>
            <div 
              style={{ transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
              className={`min-w-0 text-left flex-1 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}
            >
              <div className="text-[13px] font-medium text-sidebar-foreground truncate">{user?.name || 'User'}</div>
              <div className="text-[11px] text-muted-foreground truncate">{user?.email || ''}</div>
            </div>
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
    className={`flex items-center px-3 py-3 rounded-xl text-[13px] relative overflow-hidden min-h-[44px]
      ${isExpanded ? 'w-full gap-3' : 'w-[44px] gap-0'}
      ${isActive 
        ? 'bg-muted text-sidebar-foreground font-medium' 
        : 'text-sidebar-foreground/70 hover:bg-muted hover:text-sidebar-foreground'
      }`}
    title={label} 
  >
    <div className={`flex-shrink-0 ${isActive ? 'text-sidebar-foreground' : 'text-sidebar-foreground/70'}`}>
      {icon}
    </div>
    <span 
      style={{ transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
      className={`whitespace-nowrap text-left truncate flex-1 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}
    >
      {label}
    </span>
    {isActive && isExpanded && (
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-sidebar-primary rounded-r-full" />
    )}
  </button>
);

export default Navigation;
