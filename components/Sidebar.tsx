
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, Send, ChartBar, Pin, TrendingUp, User, Calculator, PieChart, Download, FileText, ArrowRight, Split, ShieldCheck, Layers, Copy, FunctionSquare, Play, Save, Workflow as WorkflowIcon, Trash2, Plus, ChevronDown, MessageSquare, BarChart2, Check, Search, X, RotateCcw } from 'lucide-react';
import { ExcelFile, ChatMessage, DashboardItem, AnalysisResult, Workflow, AutomationStep } from '../types';
import ReactMarkdown from 'react-markdown';
import { api } from '../lib/api';
import { ChartRenderer, ChartModal } from './ChartRenderer';
import { AnalysisContent } from './AnalysisCards';
import html2canvas from 'html2canvas';
import { worker } from '../lib/worker';
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

const Sidebar: React.FC<SidebarProps> = ({
    activeFile, files, history, onUpdateHistory, onPinToDashboard, credits, onUseCredit
}) => {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'chat' | 'analysis'>('chat');
    const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
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

    // --- ANALYSIS STATE ---
    const [joinKey, setJoinKey] = useState<string | null>(null);
    const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisInput, setAnalysisInput] = useState('');
    const [needsColumnSelection, setNeedsColumnSelection] = useState(false);
    const [detectedColumns, setDetectedColumns] = useState<string[]>([]);

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
        if (activeTab === 'analysis' && files.length >= 2 && !joinKey) {
            const f1 = files[0];
            const f2 = files[1];
            const common = f1.columns.filter(c => f2.columns.includes(c));

            if (common.length === 1) {
                setJoinKey(common[0]);
                setNeedsColumnSelection(false);
            } else if (common.length > 1) {
                const preferred = common.find(c => /id|code|email|date/i.test(c));
                if (preferred && common.length < 3) {
                    setJoinKey(preferred);
                    setNeedsColumnSelection(false);
                } else {
                    setDetectedColumns(common.slice(0, 5));
                    setNeedsColumnSelection(true);
                }
            } else {
                setDetectedColumns(f1.columns.slice(0, 5));
                setNeedsColumnSelection(true);
            }
        }
    }, [activeTab, files, joinKey]);

    useEffect(() => {
        if (activeTab === 'chat' && scrollRef.current && !historySearchQuery) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history, activeTab, historySearchQuery]);

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
                content: "Hello! I'm your AI data analyst. I've cleared our previous conversation. What would you like to analyze next?"
            }]);
        }
    };

    const handleAISubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;

        if (credits < 5) {
            addToast('error', "Insufficient Credits", "You need 5 credits to send a message.");
            return;
        }

        const mentionRegex = /@([^\s]+)/g;
        const matches = [...prompt.matchAll(mentionRegex)];
        const mentionedFileNames = matches.map(m => m[1]);
        const referencedFiles = files.filter(f => mentionedFileNames.includes(f.name));
        if (referencedFiles.length === 0 && activeFile) referencedFiles.push(activeFile);

        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: prompt };
        const assistantId = (Date.now() + 1).toString();
        const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '' };

        onUpdateHistoryRef.current([...history, userMsg, assistantMsg]);
        const currentPrompt = prompt;
        setPrompt('');
        setIsLoading(true);
        // Credits are enforced server-side; UI will refresh via profile sync.

        setTimeout(async () => {
            try {
                const fileContext = referencedFiles.map(f => {
                    const sample = f.data.slice(0, 5);
                    return `File: "${f.name}"
Columns: ${f.columns.join(', ')}
Sample Data (Top 5 rows): ${JSON.stringify(sample)}
`;
                }).join('\n\n');

                const datasets: Record<string, any[][]> = {};
                referencedFiles.forEach(f => { datasets[f.name] = f.data || []; });
                const primaryFile = referencedFiles[0];
                const primaryData = primaryFile ? primaryFile.data : [];
                const isDataMode = referencedFiles.length > 0;

                const recentHistory = history.slice(-6);

                let accumulatedText = '';
                let executionResult: any = null;
                let hasExecuted = false;

                try {
                    const responseStream = api.chat(currentPrompt, fileContext, recentHistory, isDataMode);

                    for await (const text of responseStream) {
                        accumulatedText += text;

                    if (isDataMode && !hasExecuted) {
                        // Try to find complete code block - look for closing ```
                        const codeBlockRegex = /```(?:javascript|js)?\s*([\s\S]*?)```/i;
                        let codeMatch = accumulatedText.match(codeBlockRegex);
                        
                        // If no complete block found yet, check if we have an opening ```
                        if (!codeMatch) {
                            const openBlock = accumulatedText.match(/```(?:javascript|js)?\s*([\s\S]*)$/i);
                            if (openBlock) {
                                // Wait for more text - don't execute yet
                                continue;
                            }
                        }
                        
                        if (codeMatch) {
                            const codeToExecute = codeMatch[1].trim();
                            console.log('Executing code block (length:', codeToExecute.length, '):', codeToExecute.substring(0, 300));
                            
                            // Check if code has a return statement
                            if (!codeToExecute.includes('return')) {
                                console.warn('Code block does not contain return statement');
                            }
                            
                            try {
                                executionResult = await worker.executeCode(codeToExecute, datasets, primaryData);
                                console.log('Code execution result:', executionResult);
                                console.log('Result type:', typeof executionResult);
                                console.log('Has chartType?', executionResult?.chartType);
                                console.log('Has data?', Array.isArray(executionResult?.data));
                                if (executionResult !== undefined && executionResult !== null) {
                                    const resultStr = JSON.stringify(executionResult);
                                    console.log('Full result:', resultStr.length > 500 ? resultStr.substring(0, 500) : resultStr);
                                } else {
                                    console.log('Full result: undefined or null');
                                }
                                hasExecuted = true;
                            } catch (execError: any) {
                                console.error('Code execution error:', execError);
                                executionResult = { error: execError.message };
                                hasExecuted = true;
                            }
                        }
                    }

                    let visibleText = accumulatedText;
                    if (isDataMode && hasExecuted) {
                        visibleText = accumulatedText.replace(/```(?:javascript|js)?\s*([\s\S]*?)\s*```/i, '').trim();
                    }

                        onUpdateHistoryRef.current(prev => prev.map(m => {
                            if (m.id === assistantId) {
                                const updated = { ...m, content: visibleText };
                                const resultTitle = executionResult?.title || 'Analysis Result';
                                const isResultAdded = updated.parts?.some(p => p.title === resultTitle || p.title === 'Analysis Result');

                                if (executionResult !== null && !isResultAdded) {
                                    if (!updated.parts) updated.parts = [];

                                    // Check for errors first
                                    if (executionResult?.error) {
                                        console.error('Execution error:', executionResult.error);
                                        if (!updated.content.includes('Error:')) {
                                            updated.content += `\n\n⚠️ Code execution error: ${executionResult.error}`;
                                        }
                                    }
                                    // Check for chart data (highest priority)
                                    else if (typeof executionResult === 'object' && executionResult?.chartType && Array.isArray(executionResult.data)) {
                                        // Always add chart part if chartType is present, even if data is empty
                                        // This allows the ChartRenderer to show a "No data" message or we can debug why data is empty
                                        console.log('Adding chart to parts:', {
                                            chartType: executionResult.chartType,
                                            dataLength: executionResult.data.length,
                                            title: executionResult.title
                                        });
                                        
                                        updated.parts.push({
                                            type: 'chart',
                                            title: executionResult.title || 'Chart',
                                            data: executionResult.data,
                                            chartType: executionResult.chartType
                                        });
                                    }
                                    // Check for formula
                                    else if (typeof executionResult === 'object' && executionResult?.suggestedFormula) {
                                        if (!updated.parts.some(p => p.type === 'formula')) {
                                            updated.parts.push({
                                                type: 'formula',
                                                title: 'Suggested Formula',
                                                content: executionResult.suggestedFormula
                                            });
                                        }
                                    }
                                    else if (typeof executionResult === 'object' && 'data' in executionResult && !executionResult.chartType) {
                                        const d = executionResult.data;
                                        if (Array.isArray(d) && d.length > 0) {
                                            updated.parts.push({ type: 'table', title: executionResult.title || 'Analysis Result', data: d });
                                        } else if (typeof d === 'object' && d !== null) {
                                            updated.parts.push({ type: 'table', title: 'Analysis Result', data: [d] });
                                        } else {
                                            const resultStr = "\n\n**Result:** " + String(d);
                                            if (!updated.content.includes(resultStr.trim())) {
                                                updated.content = (updated.content + resultStr).trim();
                                            }
                                        }
                                    }
                                    else if (typeof executionResult !== 'object' && executionResult !== undefined && executionResult !== null) {
                                        const resultStr = "\n\n**Result:** " + String(executionResult);
                                        if (!updated.content.includes(resultStr.trim())) {
                                            updated.content = (updated.content + resultStr).trim();
                                        }
                                    }
                                }
                                return updated;
                            }
                            return m;
                        }));
                    }
                    
                    // Final check after stream completes - re-execute code if result was undefined or incomplete
                    if (isDataMode) {
                        const finalCodeMatch = accumulatedText.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
                        if (finalCodeMatch) {
                            const finalCode = finalCodeMatch[1].trim();
                            
                            // Re-execute if we didn't execute before, or if result was undefined
                            if (!hasExecuted || !executionResult || executionResult === undefined) {
                                console.log('Re-executing code block after stream completion');
                                try {
                                    executionResult = await worker.executeCode(finalCode, datasets, primaryData);
                                    console.log('Final execution result:', executionResult);
                                    console.log('Final result type:', typeof executionResult);
                                    
                                    // Update with final result
                                    if (executionResult && typeof executionResult === 'object') {
                                        onUpdateHistoryRef.current(prev => prev.map(m => {
                                            if (m.id === assistantId) {
                                                const updated = { ...m };
                                                if (!updated.parts) updated.parts = [];
                                                
                                // Check for chart
                                if (executionResult.chartType && Array.isArray(executionResult.data)) {
                                    const hasChart = updated.parts.some(p => p.type === 'chart');
                                    if (!hasChart) {
                                        console.log('Adding final chart:', executionResult);
                                        updated.parts.push({
                                            type: 'chart',
                                            title: executionResult.title || 'Chart',
                                            data: executionResult.data,
                                            chartType: executionResult.chartType
                                        });
                                    }
                                }
                                                // Check for table
                                                else if (executionResult.data && !executionResult.chartType) {
                                                    const d = executionResult.data;
                                                    if (Array.isArray(d) && d.length > 0) {
                                                        const hasTable = updated.parts.some(p => p.type === 'table');
                                                        if (!hasTable) {
                                                            updated.parts.push({ 
                                                                type: 'table', 
                                                                title: executionResult.title || 'Analysis Result', 
                                                                data: d 
                                                            });
                                                        }
                                                    }
                                                }
                                                
                                                return updated;
                                            }
                                            return m;
                                        }));
                                    }
                                } catch (e) {
                                    console.error('Final code execution failed:', e);
                                }
                            }
                        }
                    }
                } catch (streamErr: any) {
                    throw streamErr;
                }
            } catch (err: any) {
                console.error(err);
                onUpdateHistoryRef.current(prev => prev.map(m => {
                    if (m.id === assistantId) {
                        return { ...m, content: `⚠️ Error: ${err.message}` };
                    }
                    return m;
                }));
            } finally {
                setIsLoading(false);
                // Refresh credits after server-side charging
                onUseCredit(0);
            }
        }, 10);
    };

    // --- ANALYSIS LOGIC ---
    const handleAnalysisSubmit = async (queryOverride?: string) => {
        const query = queryOverride || analysisInput;
        if (!query || files.length < 1) return;

        if (credits < 20) {
            addToast('error', "Insufficient Credits", "Analysis requires 20 credits.");
            return;
        }

        setIsAnalyzing(true);
        setAnalysisInput('');
        // Credits are enforced server-side; UI will refresh via profile sync.

        try {
            const fileContext = files.map(f => {
                const sample = f.data.slice(0, 5);
                return `File: ${f.name}\nColumns: ${f.columns.join(', ')}\nSample Data: ${JSON.stringify(sample)}`;
            }).join('\n\n');

            const json = await api.analyze(query, fileContext);

            setAnalysisResults(prev => [{ id: Date.now().toString(), query, ...json }, ...prev]);

        } catch (err: any) {
            console.error("Analysis failed", err);
            addToast('error', 'Analysis Failed', 'Could not generate insights.');
        } finally {
            setIsAnalyzing(false);
            // Refresh credits after server-side charging
            onUseCredit(0);
        }
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

    return (
        <div className="flex flex-col h-full bg-white relative">

            {/* HEADER for Search and Title */}
            {activeTab === 'chat' && (
                <div className="h-12 border-b border-gray-100 flex items-center justify-between px-4 bg-white z-10">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">AI Assistant</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleResetChat}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
                            title="Reset Chat History"
                        >
                            <RotateCcw size={16} />
                        </button>
                        {showHistorySearch ? (
                            <div className="flex items-center bg-gray-100 rounded-md px-2 py-1 animate-in slide-in-from-right-2">
                                <Search size={14} className="text-gray-400 mr-2" />
                                <input
                                    autoFocus
                                    className="bg-transparent border-none outline-none text-xs w-28 text-gray-700"
                                    placeholder="Search history..."
                                    value={historySearchQuery}
                                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                                    onBlur={() => { if (!historySearchQuery) setShowHistorySearch(false); }}
                                />
                                <button
                                    onMouseDown={(e) => { e.preventDefault(); setHistorySearchQuery(''); setShowHistorySearch(false); }}
                                    className="ml-1 text-gray-400 hover:text-gray-600"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowHistorySearch(true)}
                                className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
                                title="Search History"
                            >
                                <Search size={16} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Unified Main Content Area */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
                {activeTab === 'chat' && (
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                        {displayedHistory.length === 0 && historySearchQuery && (
                            <div className="text-center py-8 text-xs text-gray-400">
                                No messages found matching "{historySearchQuery}"
                            </div>
                        )}
                        {displayedHistory.map((m) => (
                            <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === 'user' ? 'bg-blue-600' : 'bg-gray-100 text-blue-500'}`}>
                                    {m.role === 'user' ? <User size={14} className="text-white" /> : <Sparkles size={14} />}
                                </div>
                                <div className="flex flex-col max-w-[85%]">
                                    <div className={`p-3 rounded-2xl text-[13px] leading-relaxed shadow-sm border ${m.role === 'assistant'
                                            ? 'bg-white text-gray-700 border-gray-100'
                                            : 'bg-blue-50 text-blue-900 border-blue-100 font-medium'
                                        }`}>
                                        {m.role === 'assistant' ? (
                                            <div className="[&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:mb-2 [&>ol]:list-decimal [&>ol]:pl-4 [&>ol]:mb-2 [&>strong]:text-gray-900 [&>h3]:font-bold [&>h3]:mb-1 [&>h3]:text-sm [&>pre]:bg-gray-800 [&>pre]:text-white [&>pre]:p-2 [&>pre]:rounded-lg [&>pre]:text-xs [&>pre]:overflow-x-auto">
                                                <ReactMarkdown>{m.content}</ReactMarkdown>
                                                {isLoading && m.id === history[history.length - 1].id && (
                                                    <span className="inline-block w-1.5 h-3 bg-blue-400 ml-1 animate-pulse"></span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="whitespace-pre-wrap">{m.content}</div>
                                        )}

                                        {m.parts?.map((part, idx) => (
                                            <div key={idx} className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-500">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                                        {part.type === 'chart' ? (part.chartType === 'pie' ? <PieChart size={12} /> : <ChartBar size={12} />) :
                                                            part.type === 'table' ? <Calculator size={12} /> :
                                                                part.type === 'formula' ? <FunctionSquare size={12} /> :
                                                                    <TrendingUp size={12} />}
                                                        {part.title || 'Result'}
                                                    </span>
                                                    <div className="flex gap-1">
                                                        {part.type !== 'formula' && <button onClick={() => onPinToDashboard({ title: part.title || 'Pinned Analysis', type: part.type, data: part.data || [], chartType: part.chartType })} className="p-1 hover:bg-white rounded transition-colors text-gray-400 hover:text-blue-500" title="Pin to Dashboard"><Pin size={12} /></button>}
                                                    </div>
                                                </div>

                                                {/* FORMULA PART */}
                                                {part.type === 'formula' && (
                                                    <div className="bg-green-50 border border-green-100 rounded-lg p-3 group relative">
                                                        <div className="text-[10px] font-bold text-green-700 uppercase mb-1 flex items-center gap-1">
                                                            <FunctionSquare size={12} /> Excel Formula
                                                        </div>
                                                        <code className="text-sm font-mono text-gray-800 break-all">{part.content}</code>
                                                        <button
                                                            onClick={() => {
                                                                if (part.content) navigator.clipboard.writeText(part.content);
                                                            }}
                                                            className="absolute top-2 right-2 p-1.5 bg-white text-gray-500 rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-600"
                                                            title="Copy Formula"
                                                        >
                                                            <Copy size={14} />
                                                        </button>
                                                    </div>
                                                )}

                                                {part.type === 'chart' && part.data && (
                                                    <div className="h-64 w-full flex items-center justify-center bg-white rounded-lg border border-gray-100 p-2 overflow-hidden">
                                                        <ChartRenderer type={part.chartType || 'bar'} data={part.data} title={part.title || 'Chart'} isThumbnail={true} onExpand={() => setExpandedChart({ type: part.chartType || 'bar', data: part.data || [], title: part.title || 'Analysis Chart' })} />
                                                    </div>
                                                )}
                                                {part.type === 'table' && (
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-xs">
                                                            <tbody>
                                                                {part.data?.slice(0, 5).map((row: any, i: number) => (
                                                                    <tr key={i} className="border-b border-gray-100 last:border-0">
                                                                        {typeof row === 'object' && row !== null ? (
                                                                            Object.entries(row).map(([k, val]: [string, any], j: number) => (
                                                                                <td key={j} className="py-1 px-2 text-gray-600">
                                                                                    <span className="font-semibold text-gray-400 mr-1">{k}:</span>
                                                                                    {typeof val === 'object' && val !== null ? JSON.stringify(val) : val}
                                                                                </td>
                                                                            ))
                                                                        ) : (
                                                                            <td className="py-1 px-2 text-gray-600">{row}</td>
                                                                        )}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                        {part.data && part.data.length > 5 && <div className="text-[10px] text-gray-400 mt-1 italic">... {part.data.length - 5} more rows</div>}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'analysis' && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {needsColumnSelection && (
                            <div className="p-4 bg-white border-b border-gray-200 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                        <Split size={18} />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-gray-800 text-sm mb-1">How should we match rows?</h4>
                                        <p className="text-xs text-gray-500 mb-3">Select the unique identifier common to both files.</p>
                                        <div className="flex flex-wrap gap-2">
                                            {detectedColumns.map(col => (
                                                <button
                                                    key={col}
                                                    onClick={() => { setJoinKey(col); setNeedsColumnSelection(false); }}
                                                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-bold text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
                                                >
                                                    {col}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {files.length < 2 && analysisResults.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400 mt-12">
                                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                    <Split size={24} />
                                </div>
                                <h3 className="font-bold text-gray-700 mb-2">Multi-File Analysis</h3>
                                <p className="text-sm">Please upload at least two files to enable deep comparison and variance analysis.</p>
                            </div>
                        ) : (
                            <>
                                {analysisResults.map((result) => (
                                    <div key={result.id} id={`analysis-card-${result.id}`} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 group">
                                        <div className="p-5 border-b border-gray-100 relative">
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="p-1.5 bg-gray-100 rounded text-gray-500">
                                                    {result.intent === 'SANITY_CHECK' ? <ShieldCheck size={16} /> :
                                                        result.intent === 'DIMENSION_ANALYSIS' ? <Layers size={16} /> :
                                                            <TrendingUp size={16} />}
                                                </div>
                                                <h3 className="font-bold text-gray-800 text-lg">{result.title}</h3>
                                            </div>

                                            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" data-html2canvas-ignore="true">
                                                <button
                                                    onClick={() => handleDownloadImage(result.id, result.title)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Download Image"
                                                >
                                                    <Download size={16} />
                                                </button>
                                                <button
                                                    onClick={() => onPinToDashboard({ title: result.title, type: 'analysis_card', data: [result], chartType: 'bar' })}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Pin Card to Dashboard"
                                                >
                                                    <Pin size={16} />
                                                </button>
                                            </div>

                                            <AnalysisContent result={result} />
                                        </div>

                                        <div className="p-5 bg-gray-50/50">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Analysis Explanation</h4>
                                            <p className="text-sm text-gray-700 leading-relaxed mb-4">{result.explanation}</p>
                                        </div>

                                        <div className="p-3 bg-white border-t border-gray-100 flex flex-wrap gap-2" data-html2canvas-ignore="true">
                                            {result.followUps.map((q, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => handleAnalysisSubmit(q)}
                                                    className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors"
                                                >
                                                    {q}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {isAnalyzing && (
                                    <div className="p-8 text-center">
                                        <Sparkles className="animate-spin text-blue-500 mx-auto mb-3" size={32} />
                                        <p className="text-sm font-bold text-gray-500">Analyzing Variance...</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Unified Bottom Input Section */}
            <div className="p-3 border-t border-gray-200 bg-white relative z-20">
                {isModeMenuOpen && (
                    <div className="absolute bottom-full left-4 mb-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-1 animate-in fade-in slide-in-from-bottom-2 overflow-hidden z-50">
                        <button
                            onClick={() => { setActiveTab('chat'); setIsModeMenuOpen(false); }}
                            className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${activeTab === 'chat' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
                        >
                            <MessageSquare size={16} />
                            <span className="font-medium text-sm">AI Chat</span>
                            {activeTab === 'chat' && <Check size={14} className="ml-auto" />}
                        </button>
                        <button
                            onClick={() => { setActiveTab('analysis'); setIsModeMenuOpen(false); }}
                            className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${activeTab === 'analysis' ? 'bg-purple-50 text-purple-600' : 'text-gray-700'}`}
                        >
                            <BarChart2 size={16} />
                            <span className="font-medium text-sm">Analysis & Charts</span>
                            {activeTab === 'analysis' && <Check size={14} className="ml-auto" />}
                        </button>
                    </div>
                )}

                {activeTab === 'chat' && showMentionList && filteredFiles.length > 0 && (
                    <div className="absolute bottom-full left-12 mb-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-30 animate-in fade-in slide-in-from-bottom-2">
                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            Mention File
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                            {filteredFiles.map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => insertMention(f.name)}
                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm text-gray-700 flex items-center gap-2 transition-colors"
                                >
                                    <FileText size={14} className="text-blue-500" />
                                    <span className="truncate">{f.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="relative flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:bg-white transition-all shadow-sm">

                    <button
                        onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
                        className="flex items-center gap-2 pl-3 pr-2 py-2 rounded-xl hover:bg-white hover:shadow-sm text-gray-700 transition-all flex-shrink-0"
                        title="Change Mode"
                    >
                        {activeTab === 'chat' && <Sparkles size={18} className="text-blue-600" />}
                        {activeTab === 'analysis' && <Split size={18} className="text-purple-600" />}
                        <ChevronDown size={14} className="text-gray-400" />
                    </button>

                    <div className="w-px h-6 bg-gray-200 mx-1"></div>

                    <div className="flex-1 relative">
                        {activeTab === 'chat' && (
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
                                    placeholder={files.length > 0 ? "Ask anything": "Upload files to start chat"}
                                    disabled={isLoading}
                                    className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-sm py-2 px-1 resize-none max-h-32 placeholder-gray-400 leading-relaxed"
                                    style={{ minHeight: '40px' }}
                                />
                            </form>
                        )}

                        {activeTab === 'analysis' && (
                            <form onSubmit={(e) => { e.preventDefault(); handleAnalysisSubmit(); }} className="w-full">
                                <input
                                    type="text"
                                    className="w-full bg-transparent border-none focus:ring-0 text-sm py-2 px-1 placeholder-gray-400 h-[40px]"
                                    placeholder={analysisResults.length > 0 ? "Ask follow up... (20 credits)" : "Ask about changes (e.g. 'Revenue Variance')"}
                                    value={analysisInput}
                                    onChange={(e) => setAnalysisInput(e.target.value)}
                                    disabled={isAnalyzing || needsColumnSelection}
                                />
                            </form>
                        )}
                    </div>

                    {activeTab === 'chat' && (
                        <button
                            onClick={(e) => handleAISubmit(e as any)}
                            disabled={isLoading || !prompt.trim()}
                            className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-300 transition-all shadow-sm"
                        >
                            <Send size={16} />
                        </button>
                    )}
                    {activeTab === 'analysis' && (
                        <button
                            onClick={() => handleAnalysisSubmit()}
                            disabled={isAnalyzing || !analysisInput.trim() || needsColumnSelection}
                            className="p-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:bg-gray-300 transition-all shadow-sm"
                        >
                            <ArrowRight size={16} />
                        </button>
                    )}
                </div>

                {activeTab === 'analysis' && analysisResults.length === 0 && !isAnalyzing && (
                    <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {["📉 Revenue Variance", "📦 Cost Analysis", "🌍 Regional Shift", "🛡️ Sanity Check"].map(q => (
                            <button
                                key={q}
                                onClick={() => handleAnalysisSubmit(q)}
                                className="whitespace-nowrap px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors"
                                disabled={needsColumnSelection}
                            >
                                {q}
                            </button>
                        ))}
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
