
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, Send, ChartBar, Pin, TrendingUp, User, Calculator, PieChart, Download, FileText, ShieldCheck, Layers, Copy, FunctionSquare, Search, X, RotateCcw, RefreshCw, Undo2 } from 'lucide-react';
import { ExcelFile, ChatMessage, DashboardItem, AnalysisResult, Workflow, AutomationStep } from '../types';
import ReactMarkdown from 'react-markdown';
import { api } from '../lib/api';
import { ChartRenderer, ChartModal } from './ChartRenderer';
import { AnalysisContent } from './AnalysisCards';
import html2canvas from 'html2canvas';
import { worker } from '../lib/worker';
import { buildFileContext, getValidColumnsForPrompts, getValueColumnForMultiFile } from '../lib/fileContext';
import { useToast } from './ui/toast';

interface SidebarProps {
    activeFile: ExcelFile | undefined;
    files: ExcelFile[];
    history: ChatMessage[];
    onUpdateHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    onPinToDashboard: (item: Omit<DashboardItem, 'id' | 'w' | 'h'>) => void;
    credits: number;
    onUseCredit: (amount: number) => void;
}

// Detect if query is analysis-style (variance, compare, etc.)
const isAnalysisQuery = (query: string): boolean => {
    const q = query.toLowerCase().trim();
    const keywords = [
        'variance', 'compare', 'what changed', 'cost analysis', 'revenue', 'sanity check', 'regional', 'dimension',
        'explain by', 'who caused', 'difference', ' vs ', 'between', 'month over month', 'changes', 'drivers',
        'breakdown', 'trust', 'data quality', 'anomaly', 'trend', 'shift', 'increase', 'decrease'
    ];
    return keywords.some(kw => q.includes(kw));
};

// Parse follow-ups from AI response - multiple format patterns
const parseFollowUps = (content: string): string[] => {
    const patterns = [
        /Want me to:?\s*([\s\S]*?)(?=\n\n|$)/i,
        /(?:You could (?:also )?ask|Next steps?|Follow-up questions?):?\s*([\s\S]*?)(?=\n\n|$)/i,
        /(?:Try asking|Suggested questions?):?\s*([\s\S]*?)(?=\n\n|$)/i,
    ];
    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
            const section = match[1].trim();
            const lines = section.split(/\n|[\u2022\u2023\u25E6\•]|[-*]\s+/)
                .map(s => s.replace(/^\s*[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim())
                .filter(s => s.length > 5 && s.length < 80);
            if (lines.length > 0) return lines.slice(0, 3);
        }
    }
    return [];
};

// Strip follow-up section from content so it only appears as buttons (no duplication)
const stripFollowUpSection = (content: string): string => {
    const patterns = [
        /\n\nWant me to:?\s*[\s\S]*$/i,
        /\n\n(?:You could (?:also )?ask|Next steps?|Follow-up questions?):?\s*[\s\S]*$/i,
        /\n\n(?:Try asking|Suggested questions?):?\s*[\s\S]*$/i,
    ];
    let out = content;
    for (const p of patterns) {
        out = out.replace(p, '').trim();
    }
    return out;
};

// Fallback follow-ups when parsing returns empty (uses validated columns)
const getFallbackFollowUps = (content: string, file?: ExcelFile): string[] => {
    const hasChart = content.includes('chart') || content.includes('Chart');
    const hasTable = content.includes('table') || content.includes('Table');
    const { numericCol, categoryCol } = file ? getValidColumnsForPrompts(file) : { numericCol: null, categoryCol: null };
    const chartCol = categoryCol || numericCol || 'this column';
    const fallbacks: string[] = [];
    if (!hasChart) fallbacks.push(`Create a chart of ${chartCol}`);
    if (!hasTable) fallbacks.push('Show me the raw data');
    fallbacks.push('Explain in more detail');
    return fallbacks.slice(0, 3);
};

// Detect if assistant message had a code execution error (for free retry)
const messageHadExecutionError = (m: ChatMessage): boolean => {
    const c = (m.content || '').toLowerCase();
    return c.includes('available columns:') || c.includes('could not calculate') || c.includes('try rephrasing or click regenerate');
};

// Map code execution errors to user-friendly messages
const mapExecutionError = (error: string, columns: string[]): string => {
    const err = String(error).toLowerCase();
    if (err.includes('findcol') || err.includes('column') || err.includes('not found') || err.includes('-1')) {
        const colList = columns.length > 0 ? columns.join(', ') : 'none';
        return `Column not found. Available columns: ${colList}. Try asking for a specific column, e.g. "What's the sum of [column name]?"`;
    }
    if (err.includes('undefined') || err.includes('null') || err.includes('cannot read') || err.includes('of undefined') || err.includes('reduce')) {
        return `Could not calculate. Try asking more specifically, e.g. "What's the total of [column]?"`;
    }
    if (err.includes('is not a function') || err.includes('is not defined')) {
        return `Something went wrong. Try rephrasing or click Regenerate.`;
    }
    return `Something went wrong. Try rephrasing or click Regenerate.`;
};

// Get suggested prompts using validated column names (only columns that exist and pass numeric/category test)
const getSuggestedPrompts = (files: ExcelFile[], activeFile?: ExcelFile): string[] => {
    const file = activeFile || files[0];
    if (!file || files.length === 0) return [];
    if (files.length >= 2) {
        const valueCol = getValueColumnForMultiFile(files);
        const prompts: string[] = ['What changed between files?'];
        if (valueCol) prompts.push(`Compare variance of ${valueCol}`, `${valueCol} analysis`);
        return prompts.slice(0, 3);
    }
    const { numericCol, categoryCol } = getValidColumnsForPrompts(file);
    const cols = file.columns || [];
    if (cols.length === 0) return ['Summarize this data', 'What does this data show?', 'Analyze the data'];
    const prompts: string[] = ['Summarize this data'];
    if (numericCol) prompts.push(`What's the total of ${numericCol}?`);
    if (categoryCol) {
        prompts.push(`Create a bar chart of ${categoryCol}`);
        if (numericCol) prompts.push(`Top 5 ${numericCol} by ${categoryCol}`);
    }
    return prompts.slice(0, 4);
};

const Sidebar: React.FC<SidebarProps> = ({
    activeFile, files, history, onUpdateHistory, onPinToDashboard, credits, onUseCredit
}) => {
    const { addToast } = useToast();
    const [showHistorySearch, setShowHistorySearch] = useState(false);
    const [historySearchQuery, setHistorySearchQuery] = useState('');

    // Use Ref for onUpdateHistory to prevent stale closures in async stream loops
    const onUpdateHistoryRef = useRef(onUpdateHistory);
    useEffect(() => { onUpdateHistoryRef.current = onUpdateHistory; }, [onUpdateHistory]);

    // --- CHAT STATE ---
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [expandedChart, setExpandedChart] = useState<{ type: any, data: any[], title: string } | null>(null);
    const [showMentionList, setShowMentionList] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [cursorIndex, setCursorIndex] = useState(0);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Filter history for search
    const displayedHistory = useMemo(() => {
        if (!historySearchQuery.trim()) return history;
        const q = historySearchQuery.toLowerCase();
        return history.filter(m => {
            const contentMatch = m.content.toLowerCase().includes(q);
            const partsMatch = m.parts?.some(p =>
                (p.title && p.title.toLowerCase().includes(q)) ||
                (p.content && p.content.toLowerCase().includes(q))
            );
            return contentMatch || partsMatch;
        });
    }, [history, historySearchQuery]);

    useEffect(() => {
        if (scrollRef.current && !historySearchQuery) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history, historySearchQuery]);

    // Auto-expand textarea with content (up to ~6 lines), no scrollbar
    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }, [prompt]);

    // --- CHAT LOGIC ---
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        const selectionStart = e.target.selectionStart;
        setPrompt(val);
        setCursorIndex(selectionStart);

        const lastAt = val.lastIndexOf('@', selectionStart - 1);
        if (lastAt !== -1) {
            if (lastAt === 0 || val[lastAt - 1] === ' ' || val[lastAt - 1] === '\n') {
                const query = val.substring(lastAt + 1, selectionStart);
                if (!query.includes(' ')) {
                    setMentionQuery(query);
                    setShowMentionList(true);
                    return;
                }
            }
        }
        setShowMentionList(false);
    };

    const insertMention = (fileName: string) => {
        const lastAt = prompt.lastIndexOf('@', cursorIndex - 1);
        if (lastAt !== -1) {
            const before = prompt.substring(0, lastAt);
            const after = prompt.substring(cursorIndex);
            const newText = `${before}@${fileName} ${after}`;
            setPrompt(newText);
            setShowMentionList(false);
            if (inputRef.current) {
                inputRef.current.focus();
                setTimeout(() => {
                    const newPos = lastAt + fileName.length + 2;
                    inputRef.current?.setSelectionRange(newPos, newPos);
                }, 0);
            }
        }
    };

    const filteredFiles = useMemo(() => {
        if (!mentionQuery) return files;
        return files.filter(f => f.name.toLowerCase().includes(mentionQuery.toLowerCase()));
    }, [files, mentionQuery]);

    const handleResetChat = () => {
        if (window.confirm("Are you sure you want to clear the chat history?")) {
            onUpdateHistoryRef.current([{
                id: Date.now().toString(),
                role: 'assistant',
                content: "Conversation cleared. Ask anything about your data—sums, charts, comparisons. Try the suggestions below to get started."
            }]);
        }
    };

    const handleUndo = () => {
        if (history.length < 3) return;
        const last = history[history.length - 1];
        const prev = history[history.length - 2];
        if (last.role !== 'assistant' || prev.role !== 'user') return;
        onUpdateHistoryRef.current(history.slice(0, -2));
    };

    const canUndo = history.length >= 3 && history[history.length - 1].role === 'assistant' && history[history.length - 2].role === 'user';

    const handleCopyMessage = async (m: ChatMessage) => {
        const text = m.content || '';
        try {
            await navigator.clipboard.writeText(text);
            addToast('success', 'Copied', 'Message copied to clipboard.');
        } catch {
            addToast('error', 'Copy failed', 'Could not copy to clipboard.');
        }
    };

    const runMessageFlow = (textToSend: string, assistantId: string, recentHistoryForApi: ChatMessage[], retryOnError?: boolean) => {
        const mentionRegex = /@([^\s]+)/g;
        const matches = [...textToSend.matchAll(mentionRegex)];
        const mentionedFileNames = matches.map(m => m[1]);
        const referencedFiles = files.filter(f => mentionedFileNames.includes(f.name));
        const refFiles = referencedFiles.length > 0 ? referencedFiles : (activeFile ? [activeFile] : []);
        const useAnalysis = files.length >= 2 && isAnalysisQuery(textToSend);

        setTimeout(async () => {
            try {
                if (useAnalysis) {
                    const fileContext = buildFileContext(files);
                    const json = await api.analyze(textToSend, fileContext);
                    const result: AnalysisResult = { id: assistantId, query: textToSend, ...json };
                    onUpdateHistoryRef.current(prev => prev.map(m => m.id === assistantId ? { ...m, content: result.explanation, parts: [{ type: 'analysis_card', data: [result], title: result.title }], followUps: result.followUps || [] } : m));
                } else {
                    const fileContext = refFiles.length > 0 ? buildFileContext(refFiles) : '';
                    const datasets: Record<string, any[][]> = {};
                    refFiles.forEach(f => { datasets[f.name] = f.data || []; });
                    const primaryFile = refFiles[0];
                    const primaryData = primaryFile ? primaryFile.data : [];
                    const isDataMode = refFiles.length > 0;
                    const recentHistory = recentHistoryForApi.slice(-10);
                    let accumulatedText = '';
                    let executionResult: any = null;
                    let hasExecuted = false;
                    try {
                        const responseStream = api.chat(textToSend, fileContext, recentHistory, isDataMode, retryOnError);
                        for await (const text of responseStream) {
                            accumulatedText += text;
                            if (isDataMode && !hasExecuted) {
                                const codeBlockRegex = /```(?:javascript|js)?\s*([\s\S]*?)```/i;
                                let codeMatch = accumulatedText.match(codeBlockRegex);
                                if (!codeMatch) {
                                    const openBlock = accumulatedText.match(/```(?:javascript|js)?\s*([\s\S]*)$/i);
                                    if (openBlock) continue;
                                }
                                if (codeMatch) {
                                    try {
                                        executionResult = await worker.executeCode(codeMatch[1].trim(), datasets, primaryData);
                                        hasExecuted = true;
                                    } catch (execError: any) {
                                        executionResult = { error: execError.message };
                                        hasExecuted = true;
                                    }
                                }
                            }
                            let visibleText = isDataMode && hasExecuted ? accumulatedText.replace(/```(?:javascript|js)?\s*([\s\S]*?)\s*```/i, '').trim() : accumulatedText;
                            onUpdateHistoryRef.current(prev => prev.map(m => {
                                if (m.id !== assistantId) return m;
                                const updated = { ...m, content: visibleText };
                                if (executionResult !== null && !updated.parts?.some(p => p.title === (executionResult?.title || 'Analysis Result'))) {
                                    if (!updated.parts) updated.parts = [];
                                    if (executionResult?.error) {
                                        const friendly = mapExecutionError(executionResult.error, primaryFile?.columns || []);
                                        updated.content += `\n\n${friendly}`;
                                        if (friendly.includes('Available columns') && !updated.followUps?.length) {
                                            const { numericCol } = primaryFile ? getValidColumnsForPrompts(primaryFile) : { numericCol: null };
                                            updated.followUps = numericCol ? [`Try: What's the sum of ${numericCol}?`] : ['Try rephrasing your question'];
                                        }
                                    }
                                    else if (executionResult?.chartType && Array.isArray(executionResult?.data)) updated.parts.push({ type: 'chart', title: executionResult.title || 'Chart', data: executionResult.data, chartType: executionResult.chartType });
                                    else if (executionResult?.suggestedFormula) updated.parts.push({ type: 'formula', title: 'Suggested Formula', content: executionResult.suggestedFormula });
                                    else if (executionResult?.data && !executionResult?.chartType) updated.parts.push({ type: 'table', title: executionResult.title || 'Analysis Result', data: Array.isArray(executionResult.data) ? executionResult.data : [executionResult.data] });
                                    else if (typeof executionResult === 'number' || typeof executionResult === 'string') updated.content += `\n\n**Result:** ${executionResult}`;
                                }
                                return updated;
                            }));
                        }
                        if (isDataMode) {
                            const finalCodeMatch = accumulatedText.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
                            if (finalCodeMatch && (!hasExecuted || !executionResult)) {
                                try {
                                    executionResult = await worker.executeCode(finalCodeMatch[1].trim(), datasets, primaryData);
                                    if (executionResult?.chartType && Array.isArray(executionResult?.data)) {
                                        onUpdateHistoryRef.current(prev => prev.map(m => m.id === assistantId && !m.parts?.some(p => p.type === 'chart') ? { ...m, parts: [...(m.parts || []), { type: 'chart', title: executionResult.title || 'Chart', data: executionResult.data, chartType: executionResult.chartType }] } : m));
                                    } else if (executionResult?.data && !executionResult?.chartType) {
                                        onUpdateHistoryRef.current(prev => prev.map(m => m.id === assistantId && !m.parts?.some(p => p.type === 'table') ? { ...m, parts: [...(m.parts || []), { type: 'table', title: executionResult.title || 'Analysis Result', data: Array.isArray(executionResult.data) ? executionResult.data : [executionResult.data] }] } : m));
                                    }
                                } catch {}
                            }
                        }
                        const parsedFollowUps = parseFollowUps(accumulatedText);
                        const followUpsToUse = parsedFollowUps.length > 0 ? parsedFollowUps : getFallbackFollowUps(accumulatedText, primaryFile);
                        if (followUpsToUse.length > 0) {
                            onUpdateHistoryRef.current(prev => prev.map(m => {
                                if (m.id !== assistantId) return m;
                                return { ...m, followUps: m.followUps?.length ? m.followUps : followUpsToUse };
                            }));
                        }
                    } catch (streamErr: any) { throw streamErr; }
                }
            } catch (err: any) {
                onUpdateHistoryRef.current(prev => prev.map(m => m.id === assistantId ? { ...m, content: `⚠️ Error: ${err.message}` } : m));
            } finally {
                setIsLoading(false);
                onUseCredit(0);
            }
        }, 10);
    };

    const handleRegenerate = (assistantMsg: ChatMessage) => {
        const idx = history.findIndex(h => h.id === assistantMsg.id);
        if (idx <= 0) return;
        const userMsg = history[idx - 1];
        if (userMsg.role !== 'user') return;
        const textToSend = userMsg.content.trim();
        if (!textToSend) return;
        const useAnalysis = files.length >= 2 && isAnalysisQuery(textToSend);
        const retryOnError = !useAnalysis && messageHadExecutionError(assistantMsg);
        const creditsNeeded = useAnalysis ? 15 : (retryOnError ? 0 : 3);
        if (credits < creditsNeeded) {
            addToast('error', "Insufficient Credits", creditsNeeded === 15 ? "Analysis requires 15 credits." : "You need 3 credits to regenerate.");
            return;
        }
        const historyWithoutAssistant = history.filter(m => m.id !== assistantMsg.id);
        const assistantId = (Date.now() + 1).toString();
        onUpdateHistoryRef.current([...historyWithoutAssistant, { id: assistantId, role: 'assistant', content: '' }]);
        setIsLoading(true);
        runMessageFlow(textToSend, assistantId, historyWithoutAssistant, retryOnError);
    };

    const handleAISubmit = async (e: React.FormEvent, promptOverride?: string) => {
        e.preventDefault();
        const textToSend = (promptOverride ?? prompt).trim();
        if (!textToSend) return;

        const creditsNeeded = files.length >= 2 && isAnalysisQuery(textToSend) ? 15 : 3;
        if (credits < creditsNeeded) {
            addToast('error', "Insufficient Credits", creditsNeeded === 15 ? "Analysis requires 15 credits." : "You need 3 credits to send a message.");
            return;
        }

        const mentionRegex = /@([^\s]+)/g;
        const matches = [...textToSend.matchAll(mentionRegex)];
        const mentionedFileNames = matches.map(m => m[1]);
        const referencedFiles = files.filter(f => mentionedFileNames.includes(f.name));
        if (referencedFiles.length === 0 && activeFile) referencedFiles.push(activeFile);

        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: textToSend };
        const assistantId = (Date.now() + 1).toString();
        const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '' };

        onUpdateHistoryRef.current([...history, userMsg, assistantMsg]);
        if (!promptOverride) setPrompt('');
        setIsLoading(true);
        runMessageFlow(textToSend, assistantId, history);
    };

    const handleDownloadImage = async (id: string, title: string) => {
        const element = document.getElementById(`analysis-card-${id}`);
        if (!element) return;

        try {
            const canvas = await html2canvas(element, {
                backgroundColor: '#ffffff',
                scale: 2,
                logging: false,
                ignoreElements: (element) => {
                    return element.getAttribute('data-html2canvas-ignore') === 'true';
                }
            });
            const link = document.createElement('a');
            link.download = `${title.replace(/\s+/g, '_')}_Analysis.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error("Download failed", err);
        }
    };

    const handleCopyChart = async (elementId: string) => {
        const element = document.getElementById(elementId);
        if (!element) return;
        try {
            const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2, logging: false });
            canvas.toBlob(async (blob) => {
                if (!blob) return;
                try {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                    addToast('success', 'Copied', 'Chart copied to clipboard.');
                } catch {
                    addToast('error', 'Copy failed', 'Copy to clipboard not supported. Use Download instead.');
                }
            });
        } catch {
            addToast('error', 'Copy failed', 'Could not copy chart.');
        }
    };

    const handleCopyTable = (data: any[]) => {
        if (!data?.length) return;
        const first = data[0];
        if (typeof first === 'object' && first !== null) {
            const keys = Object.keys(first);
            const header = keys.join('\t');
            const rows = data.map(row => keys.map(k => {
                const v = (row as Record<string, unknown>)[k];
                return typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '');
            }).join('\t'));
            navigator.clipboard.writeText([header, ...rows].join('\n'));
        } else {
            navigator.clipboard.writeText(data.map(String).join('\n'));
        }
        addToast('success', 'Copied', 'Table copied to clipboard.');
    };

    return (
        <div className="flex flex-col h-full bg-white relative w-full" style={{ width: '100%', maxWidth: '100%' }}>

            {/* HEADER */}
            <div className="h-12 border-b border-slate-100 flex items-center justify-between px-4 bg-white z-10">
                    <span className="text-sm font-medium text-slate-600">AI Assistant</span>
                    <div className="flex items-center gap-2">
                        {canUndo && (
                            <button
                                onClick={handleUndo}
                                className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                                title="Undo last message"
                            >
                                <Undo2 size={16} />
                            </button>
                        )}
                        <button
                            onClick={handleResetChat}
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                            title="Reset Chat History"
                        >
                            <RotateCcw size={16} />
                        </button>
                        {showHistorySearch ? (
                            <div className="flex items-center bg-slate-50 rounded-md px-2 py-1 animate-in slide-in-from-right-2">
                                <Search size={14} className="text-slate-400 mr-2" />
                                <input
                                    autoFocus
                                    className="bg-transparent border-none outline-none text-xs w-28 text-slate-700"
                                    placeholder="Search history..."
                                    value={historySearchQuery}
                                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                                    onBlur={() => { if (!historySearchQuery) setShowHistorySearch(false); }}
                                />
                                <button
                                    onMouseDown={(e) => { e.preventDefault(); setHistorySearchQuery(''); setShowHistorySearch(false); }}
                                    className="ml-1 text-slate-400 hover:text-slate-600"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowHistorySearch(true)}
                                className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                                title="Search History"
                            >
                                <Search size={16} />
                            </button>
                        )}
                    </div>
                </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                        {displayedHistory.length === 0 && historySearchQuery && (
                            <div className="text-center py-8 text-xs text-slate-500">
                                No messages found matching "{historySearchQuery}"
                            </div>
                        )}
                        {displayedHistory.map((m) => (
                            <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === 'user' ? 'bg-slate-500' : 'bg-slate-100 text-slate-500'}`}>
                                    {m.role === 'user' ? <User size={14} className="text-white" /> : <Sparkles size={14} />}
                                </div>
                                <div className="flex flex-col max-w-[85%] group/msg">
                                    <div className={`p-3 rounded-xl text-[13px] leading-relaxed shadow-sm border relative ${m.role === 'assistant'
                                            ? 'bg-white text-slate-700 border-slate-100'
                                            : 'bg-slate-100 text-slate-800 border-slate-200 font-medium'
                                        }`}>
                                        {m.role === 'assistant' && (
                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity z-10">
                                                <button onClick={() => handleCopyMessage(m)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600" title="Copy"><Copy size={12} /></button>
                                                <button onClick={() => handleRegenerate(m)} disabled={isLoading} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 disabled:opacity-50" title={messageHadExecutionError(m) ? "Regenerate (free retry)" : "Regenerate"}><RefreshCw size={12} /></button>
                                            </div>
                                        )}
                                        {m.role === 'assistant' ? (
                                            <div className="[&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:mb-2 [&>ol]:list-decimal [&>ol]:pl-4 [&>ol]:mb-2 [&>strong]:text-slate-900 [&>h3]:font-bold [&>h3]:mb-1 [&>h3]:text-sm [&>pre]:bg-slate-800 [&>pre]:text-white [&>pre]:p-2 [&>pre]:rounded-lg [&>pre]:text-xs [&>pre]:overflow-x-auto pr-12">
                                                {m.content ? <ReactMarkdown>{m.followUps?.length ? stripFollowUpSection(m.content) : m.content}</ReactMarkdown> : null}
                                                {isLoading && history.length > 0 && m.id === history[history.length - 1].id && (
                                                    <span className="inline-flex items-center gap-1 text-slate-500 text-sm mt-1">
                                                        Analyzing
                                                        <span className="inline-flex gap-0.5">
                                                            <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                                            <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                                            <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                                        </span>
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="whitespace-pre-wrap">{m.content}</div>
                                        )}

                                        {m.parts?.map((part, idx) => (
                                            <div key={idx} className="mt-4 p-3 bg-slate-50/50 border border-slate-100 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-500">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                                        {part.type === 'chart' ? (part.chartType === 'pie' ? <PieChart size={12} /> : <ChartBar size={12} />) :
                                                            part.type === 'table' ? <Calculator size={12} /> :
                                                                part.type === 'formula' ? <FunctionSquare size={12} /> :
                                                                    part.type === 'analysis_card' ? <ShieldCheck size={12} /> :
                                                                        <TrendingUp size={12} />}
                                                        {part.title || 'Result'}
                                                    </span>
                                                    <div className="flex gap-1">
                                                        {part.type !== 'formula' && (
                                                            <>
                                                                {part.type === 'analysis_card' && part.data?.[0] && (
                                                                    <button onClick={() => handleDownloadImage((part.data[0] as AnalysisResult).id, (part.data[0] as AnalysisResult).title)} className="p-1 hover:bg-white rounded transition-colors text-slate-400 hover:text-slate-600" title="Download Image"><Download size={12} /></button>
                                                                )}
                                                                {part.type === 'table' && (
                                                                    <button onClick={() => handleCopyTable(part.data || [])} className="p-1 hover:bg-white rounded transition-colors text-slate-400 hover:text-slate-600" title="Copy table"><Copy size={12} /></button>
                                                                )}
                                                                <button onClick={() => onPinToDashboard({ title: part.title || 'Pinned Analysis', type: part.type, data: part.data || [], chartType: part.chartType })} className="p-1 hover:bg-white rounded transition-colors text-slate-400 hover:text-slate-600" title="Pin to Dashboard"><Pin size={12} /></button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* FORMULA PART */}
                                                {part.type === 'formula' && (
                                                    <div className="bg-green-50 border border-green-100 rounded-lg p-3 group relative">
                                                        <div className="text-xs font-medium text-green-700 mb-1 flex items-center gap-1">
                                                            <FunctionSquare size={12} /> Excel Formula
                                                        </div>
                                                        <code className="text-sm font-mono text-slate-800 break-all">{part.content}</code>
                                                        <button
                                                            onClick={() => {
                                                                if (part.content) navigator.clipboard.writeText(part.content);
                                                            }}
                                                            className="absolute top-2 right-2 p-1.5 bg-white text-slate-500 rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:text-slate-600"
                                                            title="Copy Formula"
                                                        >
                                                            <Copy size={14} />
                                                        </button>
                                                    </div>
                                                )}

                                                {part.type === 'chart' && part.data && (
                                                    <div id={`chart-${m.id}-${idx}`} className="relative h-64 w-full flex items-center justify-center bg-white rounded-lg border border-slate-100 p-2 overflow-hidden">
                                                        <ChartRenderer type={part.chartType || 'bar'} data={part.data} title={part.title || 'Chart'} isThumbnail={true} onExpand={() => setExpandedChart({ type: part.chartType || 'bar', data: part.data || [], title: part.title || 'Analysis Chart' })} />
                                                        <button onClick={() => handleCopyChart(`chart-${m.id}-${idx}`)} className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded shadow-sm text-slate-500 hover:text-slate-700 transition-opacity opacity-0 group-hover/msg:opacity-100" title="Copy chart"><Copy size={12} /></button>
                                                    </div>
                                                )}
                                                {part.type === 'table' && (
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-xs">
                                                            <tbody>
                                                                {part.data?.slice(0, 5).map((row: any, i: number) => (
                                                                    <tr key={i} className="border-b border-slate-100 last:border-0">
                                                                        {typeof row === 'object' && row !== null ? (
                                                                            Object.entries(row).map(([k, val]: [string, any], j: number) => (
                                                                                <td key={j} className="py-1 px-2 text-slate-600">
                                                                                    <span className="font-semibold text-slate-400 mr-1">{k}:</span>
                                                                                    {typeof val === 'object' && val !== null ? JSON.stringify(val) : val}
                                                                                </td>
                                                                            ))
                                                                        ) : (
                                                                            <td className="py-1 px-2 text-slate-600">{row}</td>
                                                                        )}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                        {part.data && part.data.length > 5 && <div className="text-xs text-slate-500 mt-1 italic">... {part.data.length - 5} more rows</div>}
                                                    </div>
                                                )}
                                                {part.type === 'analysis_card' && part.data?.[0] && (
                                                    <div id={`analysis-card-${(part.data[0] as AnalysisResult).id}`} className="bg-white rounded-xl border border-slate-100 p-3">
                                                        <AnalysisContent result={part.data[0] as AnalysisResult} />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {m.role === 'assistant' && m.followUps && m.followUps.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                                                {m.followUps.map((q, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={(e) => handleAISubmit(e, q)}
                                                        className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors"
                                                    >
                                                        {q}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
            </div>

            {/* Bottom Input Section */}
            <div className="p-3 border-t border-slate-200 bg-slate-50/50 relative z-20">
                {showMentionList && filteredFiles.length > 0 && (
                    <div className="absolute bottom-full left-12 mb-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-30 animate-in fade-in slide-in-from-bottom-2">
                        <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 text-xs font-medium text-slate-500">
                            Mention File
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                            {filteredFiles.map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => insertMention(f.name)}
                                    className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm text-slate-700 flex items-center gap-2 transition-colors"
                                >
                                    <FileText size={14} className="text-slate-500" />
                                    <span className="truncate">{f.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="relative flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-slate-300/30 focus-within:bg-white transition-all shadow-sm">
                    <div className="flex items-center pl-3 pr-2 py-2 flex-shrink-0">
                        <Sparkles size={16} className="text-slate-400" />
                    </div>
                    <div className="w-px h-6 bg-slate-200 mx-1"></div>
                    <div className="flex-1 relative">
                        <form onSubmit={handleAISubmit} className="w-full">
                            <textarea
                                ref={inputRef}
                                rows={1}
                                value={prompt}
                                onChange={handleInputChange}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        if (showMentionList && filteredFiles.length > 0) {
                                            insertMention(filteredFiles[0].name);
                                        } else {
                                            handleAISubmit(e as any);
                                        }
                                    }
                                    if (e.key === 'Escape') setShowMentionList(false);
                                }}
                                placeholder={files.length > 0 ? (() => {
                                    const file = activeFile || files[0];
                                    const { numericCol } = file ? getValidColumnsForPrompts(file) : { numericCol: null };
                                    const col = numericCol || file?.columns?.[0];
                                    const base = col ? `e.g. What's the sum of ${col}?` : "e.g. What's the sum? Create a chart";
                                    return files.length >= 2 ? "Type @ to mention a file" : base;
                                })() : "Upload files to start chat"}
                                disabled={isLoading}
                                className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-sm py-2 px-1 resize-none overflow-hidden placeholder-slate-400 leading-relaxed"
                                style={{ minHeight: '40px', maxHeight: '160px' }}
                            />
                        </form>
                    </div>
                    <button
                        onClick={(e) => handleAISubmit(e as any)}
                        disabled={isLoading || !prompt.trim()}
                        className="p-2 bg-slate-800 text-white rounded-full hover:bg-slate-900 disabled:opacity-50 disabled:bg-slate-300 transition-all shadow-sm"
                    >
                        <Send size={16} />
                    </button>
                </div>

                {displayedHistory.length <= 1 && !historySearchQuery && !isLoading && (
                    <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {getSuggestedPrompts(files, activeFile).length > 0 ? (
                            getSuggestedPrompts(files, activeFile).map(q => (
                                <button
                                    key={q}
                                    onClick={(e) => handleAISubmit(e, q)}
                                    className="whitespace-nowrap px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                                >
                                    {q}
                                </button>
                            ))
                        ) : (
                            <span className="text-xs text-slate-500 px-2 py-1.5">Upload files to get started</span>
                        )}
                    </div>
                )}
            </div>

            {expandedChart && (
                <ChartModal
                    type={expandedChart.type}
                    data={expandedChart.data}
                    title={expandedChart.title}
                    onClose={() => setExpandedChart(null)}
                />
            )}
        </div>
    );
};

export default Sidebar;
