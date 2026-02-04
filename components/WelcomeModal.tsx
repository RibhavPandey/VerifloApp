import React from 'react';
import { X, Sparkles, ScanText, FileSpreadsheet, Plus, Zap, MessageSquare } from 'lucide-react';

interface WelcomeModalProps {
  userName: string;
  onClose: () => void;
  onTryDemo: () => void;
  onExtract: () => void;
  onUpload: () => void;
  onCreateSheet: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({
  userName,
  onClose,
  onTryDemo,
  onExtract,
  onUpload,
  onCreateSheet,
}) => {
  return (
    <div 
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      style={{ animation: 'fadeIn 0.2s ease-in' }}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-[#e5e5e5] max-h-[90vh] overflow-y-auto"
        style={{ animation: 'fadeInScale 0.2s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 md:px-6 pt-4 md:pt-6 pb-4 flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <Sparkles size={20} className="text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg md:text-[20px] font-semibold text-[#0a0a0a] tracking-[-0.01em] truncate">
                  Welcome{userName ? `, ${userName}` : ''}
                </h2>
                <p className="text-xs md:text-[13px] text-[#666] mt-0.5">Let's get you started</p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#999] hover:text-[#0a0a0a] min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 md:px-6 pb-4 md:pb-6">
          <p className="text-[14px] text-[#666] leading-relaxed mb-6">
            Here's what you can do to get started:
          </p>

          {/* Quick Actions */}
          <div className="space-y-2 mb-6">
            <button
              onClick={() => { onExtract(); onClose(); }}
              className="w-full flex items-center gap-3 p-3.5 md:p-3.5 rounded-xl border border-[#e5e5e5] hover:border-[#ccc] hover:bg-[#fafafa] transition-all text-left group min-h-[64px] md:min-h-0"
            >
              <div className="w-9 h-9 rounded-lg bg-[#0a0a0a] flex items-center justify-center group-hover:scale-105 transition-transform">
                <ScanText size={18} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-medium text-[#0a0a0a]">Extract from PDFs</div>
                <div className="text-[12px] text-[#666]">Upload PDFs and extract structured data</div>
              </div>
            </button>

            <button
              onClick={() => { onUpload(); onClose(); }}
              className="w-full flex items-center gap-3 p-3.5 md:p-3.5 rounded-xl border border-[#e5e5e5] hover:border-[#ccc] hover:bg-[#fafafa] transition-all text-left group min-h-[64px] md:min-h-0"
            >
              <div className="w-9 h-9 rounded-lg bg-[#f5f5f5] flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                <FileSpreadsheet size={18} className="text-[#666] group-hover:text-blue-600 transition-colors" />
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-medium text-[#0a0a0a]">Upload Spreadsheet</div>
                <div className="text-[12px] text-[#666]">Import CSV or Excel files for analysis</div>
              </div>
            </button>

            <button
              onClick={() => { onCreateSheet(); onClose(); }}
              className="w-full flex items-center gap-3 p-3.5 md:p-3.5 rounded-xl border border-[#e5e5e5] hover:border-[#ccc] hover:bg-[#fafafa] transition-all text-left group min-h-[64px] md:min-h-0"
            >
              <div className="w-9 h-9 rounded-lg bg-[#f5f5f5] flex items-center justify-center group-hover:bg-green-50 transition-colors">
                <Plus size={18} className="text-[#666] group-hover:text-green-600 transition-colors" />
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-medium text-[#0a0a0a]">Create New Sheet</div>
                <div className="text-[12px] text-[#666]">Start with a blank spreadsheet</div>
              </div>
            </button>
          </div>

          {/* Additional Features */}
          <div className="pt-4 border-t border-[#f0f0f0]">
            <p className="text-[12px] text-[#999] mb-3 font-medium uppercase tracking-wide">Also Available</p>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5">
                <Zap size={14} className="text-[#999] mt-0.5 shrink-0" />
                <div>
                  <div className="text-[13px] font-medium text-[#0a0a0a]">Automate Workflows</div>
                  <div className="text-[12px] text-[#666]">Record actions once, run them automatically on any file</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MessageSquare size={14} className="text-[#999] mt-0.5 shrink-0" />
                <div>
                  <div className="text-[13px] font-medium text-[#0a0a0a]">AI Chat</div>
                  <div className="text-[12px] text-[#666]">After uploading a file, use AI to analyze your data</div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => { onTryDemo(); onClose(); }}
              className="flex-1 px-4 py-3 md:py-2.5 text-[13px] font-medium text-white bg-[#0a0a0a] rounded-xl hover:bg-[#262626] transition-colors flex items-center justify-center gap-2 min-h-[44px] md:min-h-0"
            >
              <Sparkles size={14} />
              Try Demo
            </button>
            <button
              onClick={onClose}
              className="px-4 py-3 md:py-2.5 text-[13px] font-medium text-[#666] hover:bg-[#f5f5f5] rounded-xl transition-colors min-h-[44px] md:min-h-0"
            >
              Explore
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;
