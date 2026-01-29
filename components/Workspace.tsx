
import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  Bell, Cloud, Coins, Download, Loader2, Plus, 
  StopCircle, Zap, Workflow as WorkflowIcon, Play, CheckCircle2, X, Trash2, FileSpreadsheet, ScanText
} from 'lucide-react';
import { ExcelFile, Job, Workflow, AutomationStep } from '../types';
import Navigation from './Navigation';
import MergeModal from './MergeModal';
import { db } from '../lib/db'; 
import { useToast } from './ui/toast';
import { worker } from '../lib/worker';
import ExcelJS from 'exceljs';
import { validateFiles, formatFileSize } from '../lib/file-validation';

export interface WorkspaceContextType {
    jobs: Job[];
    files: ExcelFile[];
    credits: number;
    handleUseCredit: (amount: number) => void;
    refreshData: () => void;
    handleRecordAction: (type: AutomationStep['type'], description: string, params: any) => void;
    onJobCreated: (job: Job, file?: ExcelFile) => void;
    handleCSVUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onCreateWorkflow: () => void;
}

const Workspace: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  
  // --- CORE STATE ---
  const [jobs, setJobs] = useState<Job[]>([]);
  const [files, setFiles] = useState<ExcelFile[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [credits, setCredits] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // --- UI STATE ---
  const [showMergeModal, setShowMergeModal] = useState(false);
  
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
          if (profile) setCredits(profile.credits);
          
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
  }, []);

  const handleUseCredit = async (amount: number) => {
      // Credits are enforced server-side. Keep this as a lightweight "refresh credits" helper
      // to avoid double-charging from the client.
      try {
          const profile = await db.getUserProfile();
          if (profile) setCredits(profile.credits);
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

  // Workflow execution engine
  const runWorkflow = async (workflow: Workflow, targetFile: ExcelFile): Promise<ExcelFile> => {
      // Validation
      if (!workflow.steps || workflow.steps.length === 0) {
          addToast('error', 'Invalid Workflow', 'Workflow has no steps to execute.');
          return targetFile; // Return original file if validation fails
      }

      addToast('info', 'Running Workflow', `Executing ${workflow.name}...`);
      let data = targetFile.data.map(row => [...row]);
      let columns = [...targetFile.columns];
      let styles = { ...targetFile.styles }; // Preserve styles
      
      // Note: Enrich steps calculate and deduct their own cost based on unique items
      // We don't deduct upfront to avoid double-deduction

      // Separate steps by type for proper execution order
      const deleteColSteps = workflow.steps.filter(s => s.type === 'delete_col').sort((a, b) => b.params.colIndex - a.params.colIndex);
      const deleteRowSteps = workflow.steps.filter(s => s.type === 'delete_row').sort((a, b) => b.params.rowIndex - a.params.rowIndex);
      const otherSteps = workflow.steps.filter(s => s.type !== 'delete_col' && s.type !== 'delete_row');

      try {
          // Execute other steps first (sort, enrich, etc.)
          for (let stepIdx = 0; stepIdx < otherSteps.length; stepIdx++) {
              const step = otherSteps[stepIdx];
              const stepResult: StepResult = {
                step,
                success: false,
                index: stepIdx,
              };
              
              try {
                  if (step.type === 'sort') {
                       const { action, r1, c1, r2, c2 } = step.params;
                       // Bounds checking
                       if (r1 < 0 || r2 >= data.length || c1 < 0 || c2 >= (data[0]?.length || 0)) {
                           console.warn(`Step "${step.description}": Range out of bounds, skipping`);
                           continue;
                       }
                       for(let r = r1; r <= r2; r++) {
                           for(let c = c1; c <= c2; c++) {
                               if (data[r] && data[r][c] !== undefined) {
                                   let val = data[r][c];
                                   if (typeof val === 'string') {
                                       if (action === 'trim') val = val.trim();
                                       if (action === 'upper') val = val.toUpperCase();
                                       if (action === 'lower') val = val.toLowerCase();
                                       if (action === 'title') {
                                           val = val.toLowerCase().split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                                       }
                                   }
                                   data[r][c] = val;
                               }
                           }
                       }
                  }
                  if (step.type === 'enrich') {
                       const { prompt, colIndex } = step.params;
                       // If colIndex not recorded, try to extract from description or use first column
                       const targetCol = colIndex !== undefined ? colIndex : 0;
                       if (targetCol >= 0 && targetCol < (data[0]?.length || 0) && prompt) {
                           try {
                               const sourceData = data.slice(1).map(r => r[targetCol]).filter(v => v !== undefined && v !== null && v !== '');
                               const allUniqueItems = Array.from(new Set(sourceData.map(v => String(v).trim())));
                               
                               if (allUniqueItems.length > 0) {
                                   const { api } = await import('../lib/api');
                                   const BATCH_SIZE = 100; // Process 100 items per API call (backend limit)
                                   const numBatches = Math.ceil(allUniqueItems.length / BATCH_SIZE);
                                   const batchCost = numBatches * 25; // 25 credits per batch
                                   
                                   // Check if user has enough credits for all batches
                                   if (credits < batchCost) {
                                       addToast('error', 'Insufficient Credits', `Enrichment requires ${batchCost} credits (${allUniqueItems.length} unique items in ${numBatches} batches). You have ${credits}.`);
                                       continue; // Skip this enrich step
                                   }
                                   
                                   // Credits are enforced server-side per API call; do not deduct client-side.
                                   
                                   const mergedResult: Record<string, any> = {};
                                   
                                   // Process in batches
                                   for (let i = 0; i < allUniqueItems.length; i += BATCH_SIZE) {
                                       const batch = allUniqueItems.slice(i, i + BATCH_SIZE);
                                       try {
                                           const response = await api.enrich(batch, prompt);
                                           Object.assign(mergedResult, response.result);
                                       } catch (batchError: any) {
                                           console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, batchError);
                                           // If credits run out mid-run, stop further batches
                                           if (batchError?.message?.includes('Insufficient credits')) break;
                                           // Continue with other batches even if one fails
                                       }
                                   }
                                   
                                   // Create normalized lookup map for flexible matching
                                   const lookupMap = new Map<string, any>();
                                   for (const [key, value] of Object.entries(mergedResult)) {
                                       const normalizedKey = String(key).trim().toLowerCase();
                                       lookupMap.set(normalizedKey, value);
                                   }
                                   
                                   // Add enriched data to new column
                                   const newColIdx = data[0].length;
                                   data[0][newColIdx] = "Enriched Info";
                                   columns.push("Enriched Info");
                                   
                                   // Match and populate enriched data for ALL rows
                                   for(let r = 1; r < data.length; r++) {
                                       if (!data[r]) data[r] = [];
                                       const cellValue = data[r][targetCol];
                                       
                                       if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
                                           // Try exact match first (preserves original behavior)
                                           let enrichedValue = mergedResult[cellValue] || mergedResult[String(cellValue)];
                                           
                                           // If no exact match, try normalized lookup (handles case/whitespace differences)
                                           if (enrichedValue === undefined) {
                                               const normalizedCellValue = String(cellValue).trim().toLowerCase();
                                               enrichedValue = lookupMap.get(normalizedCellValue);
                                           }
                                           
                                           if (enrichedValue !== undefined) {
                                               data[r][newColIdx] = typeof enrichedValue === 'object' ? JSON.stringify(enrichedValue) : enrichedValue;
                                           }
                                       }
                                   }
                               }
                           } catch (enrichError: any) {
                               console.error('Enrichment step failed:', enrichError);
                               addToast('warning', 'Enrichment Failed', `Step "${step.description}" failed: ${enrichError.message || 'Unknown error'}`);
                           }
                       }
                  }
                  if (step.type === 'formula') {
                       const { formula, rowIndex, colIndex } = step.params;
                       if (formula && rowIndex >= 0 && rowIndex < data.length && colIndex >= 0 && colIndex < (data[0]?.length || 0)) {
                           if (!data[rowIndex]) data[rowIndex] = [];
                           data[rowIndex][colIndex] = formula;
                       }
                  }
                  if (step.type === 'filter') {
                       const { colIndex, operator, value } = step.params;
                       // Filter rows based on column criteria
                       if (colIndex >= 0 && colIndex < (data[0]?.length || 0) && operator && value !== undefined) {
                           const headerRow = data[0];
                           const filteredData = [headerRow]; // Keep header
                           
                           for (let r = 1; r < data.length; r++) {
                               if (!data[r]) continue;
                               const cellValue = data[r][colIndex];
                               let shouldInclude = false;
                               
                               if (operator === 'equals') {
                                   shouldInclude = String(cellValue) === String(value);
                               } else if (operator === 'contains') {
                                   shouldInclude = String(cellValue).toLowerCase().includes(String(value).toLowerCase());
                               } else if (operator === 'greater') {
                                   shouldInclude = Number(cellValue) > Number(value);
                               } else if (operator === 'less') {
                                   shouldInclude = Number(cellValue) < Number(value);
                               } else if (operator === 'not_empty') {
                                   shouldInclude = cellValue !== undefined && cellValue !== null && cellValue !== '';
                               } else if (operator === 'empty') {
                                   shouldInclude = cellValue === undefined || cellValue === null || cellValue === '';
                               }
                               
                               if (shouldInclude) {
                                   filteredData.push(data[r]);
                               }
                           }
                           
                           data = filteredData;
                       }
                  }
                  if (step.type === 'format') {
                       const { styleKey, value, r1, r2, c1, c2 } = step.params;
                       if (r1 >= 0 && r2 < data.length && c1 >= 0 && c2 < (data[0]?.length || 0)) {
                           for (let r = r1; r <= r2; r++) {
                               for (let c = c1; c <= c2; c++) {
                                   const key = `${r},${c}`;
                                   const current = styles[key] || {};
                                   if (styleKey === 'align') {
                                       styles[key] = { ...current, [styleKey]: value };
                                   } else {
                                       styles[key] = { ...current, [styleKey]: value };
                                   }
                               }
                           }
                       }
                  }
                  if (step.type === 'extraction') {
                       // Extraction steps are for PDF workflows, not spreadsheet workflows
                       // This is a placeholder - actual extraction happens during PDF processing
                       console.warn('Extraction step in spreadsheet workflow - skipping (extraction is for PDF workflows)');
                  }
                  
                  // Mark step as successful
                  stepResult.success = true;
                  stepResults.push(stepResult);
              } catch (stepError: any) {
                  console.error(`Step "${step.description}" failed:`, stepError);
                  stepResult.error = stepError.message || 'Unknown error';
                  stepResult.success = false;
                  stepResults.push(stepResult);
                  failedStepIndex = stepIdx;
                  
                  // Show detailed error
                  addToast('error', 'Step Failed', `Step ${stepIdx + 1}: "${step.description}" failed: ${stepResult.error}`);
                  
                  // Ask user if they want to continue or rollback
                  // For now, we'll continue but mark the failure
                  // In a more advanced version, we could show a dialog here
              }
          }
          
          // If critical steps failed, consider rollback
          const criticalFailures = stepResults.filter(r => !r.success && 
            (r.step.type === 'enrich' || r.step.type === 'filter'));
          
          if (criticalFailures.length > 0 && failedStepIndex !== null) {
              // Show summary of failures
              const failureSummary = criticalFailures.map(f => 
                `Step ${f.index + 1}: ${f.step.description}`
              ).join(', ');
              addToast('warning', 'Workflow Partially Failed', 
                `${criticalFailures.length} critical step(s) failed: ${failureSummary}. Some changes may be incomplete.`);
          }

          // Execute delete_col steps in reverse order (highest index first) to avoid index shifting
          for (let stepIdx = 0; stepIdx < deleteColSteps.length; stepIdx++) {
              const step = deleteColSteps[stepIdx];
              const stepResult: StepResult = {
                step,
                success: false,
                index: otherSteps.length + stepIdx,
              };
              
              try {
                  const { colIndex } = step.params;
                  if (colIndex >= 0 && colIndex < (data[0]?.length || 0)) {
                      data = data.map(row => row.filter((_, i) => i !== colIndex));
                      if (columns && columns.length > colIndex) {
                          columns = columns.filter((_, i) => i !== colIndex);
                      }
                      // Remove styles for deleted column and shift remaining column styles
                      const newStyles: Record<string, any> = {};
                      for (const [key, style] of Object.entries(styles)) {
                          const [r, c] = key.split(',').map(Number);
                          if (c < colIndex) {
                              newStyles[key] = style; // Keep styles before deleted column
                          } else if (c > colIndex) {
                              newStyles[`${r},${c - 1}`] = style; // Shift styles after deleted column
                          }
                          // Skip styles for deleted column (c === colIndex)
                      }
                      styles = newStyles;
                      stepResult.success = true;
                  } else {
                      stepResult.error = 'Column index out of bounds';
                  }
                  stepResults.push(stepResult);
              } catch (stepError: any) {
                  console.error(`Delete column step failed:`, stepError);
                  stepResult.error = stepError.message || 'Unknown error';
                  stepResults.push(stepResult);
                  addToast('error', 'Step Failed', `Delete column step failed: ${stepResult.error}`);
              }
          }

          // Execute delete_row steps in reverse order (highest index first) to avoid index shifting
          for (let stepIdx = 0; stepIdx < deleteRowSteps.length; stepIdx++) {
              const step = deleteRowSteps[stepIdx];
              const stepResult: StepResult = {
                step,
                success: false,
                index: otherSteps.length + deleteColSteps.length + stepIdx,
              };
              
              try {
                  const { rowIndex } = step.params;
                  if (rowIndex >= 0 && rowIndex < data.length) {
                      data = data.filter((_, i) => i !== rowIndex);
                      // Remove styles for deleted row and shift remaining row styles
                      const newStyles: Record<string, any> = {};
                      for (const [key, style] of Object.entries(styles)) {
                          const [r, c] = key.split(',').map(Number);
                          if (r < rowIndex) {
                              newStyles[key] = style; // Keep styles before deleted row
                          } else if (r > rowIndex) {
                              newStyles[`${r - 1},${c}`] = style; // Shift styles after deleted row
                          }
                          // Skip styles for deleted row (r === rowIndex)
                      }
                      styles = newStyles;
                      stepResult.success = true;
                  } else {
                      stepResult.error = 'Row index out of bounds';
                  }
                  stepResults.push(stepResult);
              } catch (stepError: any) {
                  console.error(`Delete row step failed:`, stepError);
                  stepResult.error = stepError.message || 'Unknown error';
                  stepResults.push(stepResult);
                  addToast('error', 'Step Failed', `Delete row step failed: ${stepResult.error}`);
              }
          }
          
          // Summary of execution
          const successCount = stepResults.filter(r => r.success).length;
          const failureCount = stepResults.filter(r => !r.success).length;
          
          if (failureCount > 0) {
              console.warn(`Workflow execution completed with ${failureCount} failure(s) out of ${stepResults.length} steps`);
          }

          // Update the file
          const updatedFile = { ...targetFile, data, columns, styles, lastModified: Date.now() };
          setFiles(prev => prev.map(f => f.id === targetFile.id ? updatedFile : f));
          await db.upsertFile(updatedFile);

          // Update workflow last run status
          const updatedWorkflow = { ...workflow, lastRun: Date.now(), lastRunStatus: 'success' as const };
          await db.upsertWorkflow(updatedWorkflow);
          setWorkflows(prev => prev.map(w => w.id === workflow.id ? updatedWorkflow : w));

          // Show completion message with summary
          if (failureCount === 0) {
              addToast('success', 'Workflow Completed', `All ${successCount} step(s) executed successfully.`);
          } else {
              addToast('warning', 'Workflow Partially Completed', 
                `${successCount} step(s) succeeded, ${failureCount} step(s) failed.`);
          }
          
          return updatedFile;
      } catch (error: any) {
          console.error('Workflow execution failed:', error);
          
          // Rollback: restore original file state
          try {
              const rolledBackFile = { 
                  ...targetFile, 
                  data: originalData, 
                  columns: originalColumns, 
                  styles: originalStyles,
                  lastModified: Date.now()
              };
              setFiles(prev => prev.map(f => f.id === targetFile.id ? rolledBackFile : f));
              await db.upsertFile(rolledBackFile);
              addToast('info', 'Workflow Rolled Back', 'Changes have been reverted due to critical error.');
          } catch (rollbackError) {
              console.error('Failed to rollback workflow:', rollbackError);
              addToast('error', 'Rollback Failed', 'Failed to restore original file. Please reload the page.');
          }
          
          const updatedWorkflow = { ...workflow, lastRun: Date.now(), lastRunStatus: 'failed' as const };
          await db.upsertWorkflow(updatedWorkflow);
          setWorkflows(prev => prev.map(w => w.id === workflow.id ? updatedWorkflow : w));
          addToast('error', 'Workflow Failed', `Workflow execution failed: ${error.message || 'Unknown error'}. Changes have been rolled back.`);
          throw error; // Re-throw so caller knows it failed
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
    
    // Process valid files
    validationResult.valid.forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const ab = e.target?.result as ArrayBuffer;
            if (!ab) {
                addToast('error', 'File Error', `Failed to read ${file.name}`);
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
                    chatHistory: [{ id: '1', role: 'assistant', content: "Hello! I'm your AI data analyst." }]
                };

                await db.upsertJob(newJob);
                await db.upsertFile(newFile);
                handleJobCreated(newJob, newFile);
                addToast('success', 'File Uploaded', `${file.name} loaded successfully.`);

            } catch (err: any) {
                console.error(err);
                const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                addToast('error', 'File Error', `Failed to parse ${file.name}: ${errorMsg}`);
            }
        };
        
        reader.onerror = () => {
            addToast('error', 'File Error', `Failed to read ${file.name}`);
        };
        
        reader.readAsArrayBuffer(file);
    });
    
    // Reset input
    event.target.value = '';
  };

  return (
    <div className="h-screen flex bg-white overflow-hidden text-[#111827]">
      {/* GLOBAL HIDDEN INPUT FOR DASHBOARD UPLOAD TRIGGER */}
      <input 
        type="file" 
        id="hidden-csv-upload" 
        className="hidden" 
        multiple 
        accept=".xlsx,.xls,.csv" 
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
         <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 z-[100]">
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
                            onClick={handleAutomateClick}
                            disabled={isWorkflowRunning}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                       >
                           {isWorkflowRunning ? (
                               <Loader2 size={16} className="animate-spin text-gray-500" />
                           ) : (
                           <Zap size={16} className={showAutomateMenu ? "text-purple-600 fill-purple-100" : "text-gray-400"} />
                           )}
                           {isWorkflowRunning ? "Running..." : "Automate"}
                       </button>
                   )}

                   {showAutomateMenu && !isRecording && (
                       <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-[110] overflow-hidden animate-in fade-in slide-in-from-top-2">
                           <div className="p-2 border-b border-gray-100">
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
                           
                           <div className="p-2">
                               <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Saved Workflows</div>
                               {workflows.length === 0 ? (
                                   <div className="px-3 py-2 text-xs text-gray-400 italic">No workflows yet.</div>
                               ) : (
                                   workflows.filter(w => w.sourceType === 'spreadsheet').map(w => (
                                       <button 
                                           key={w.id}
                                           className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg flex items-center justify-between group transition-colors"
                                           disabled={isWorkflowRunning}
                                           onClick={() => { setShowAutomateMenu(false); handleExecuteWorkflow(w); }}
                                       >
                                           <div className="flex items-center gap-2 overflow-hidden">
                                               <WorkflowIcon size={14} className="text-gray-400 group-hover:text-purple-600 shrink-0" />
                                               <span className="text-sm text-gray-700 truncate">{w.name}</span>
                                           </div>
                                           {isWorkflowRunning && runningWorkflowId === w.id ? (
                                               <Loader2 size={12} className="animate-spin text-gray-500" />
                                           ) : (
                                           <Play size={12} className="text-gray-300 group-hover:text-green-600 opacity-0 group-hover:opacity-100 transition-all" />
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
               
               <div className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 rounded-lg border border-blue-200 text-sm font-semibold mr-2 shadow-sm">
                  <Coins size={16} className="text-blue-600" />
                  <span>{credits} Credits</span>
               </div>

               <div className="h-6 w-px bg-gray-200 mx-1"></div>
               <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><Bell size={20} /></button>
            </div>
         </header>

         <div className="flex-1 flex overflow-hidden relative">
            <main className="flex-1 relative overflow-hidden bg-[#F9FAFB] flex flex-col">
                <Outlet context={{ 
                    jobs, files, credits, handleUseCredit, refreshData: loadData, handleRecordAction, onJobCreated: handleJobCreated, handleCSVUpload, onCreateWorkflow: handleCreateWorkflow
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
                                         <div className="text-[10px] text-gray-400 font-mono truncate">{JSON.stringify(step.params)}</div>
                                     </div>
                                     <button 
                                         onClick={() => handleDeleteStep(step.id)}
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
                             onClick={() => { setShowWorkflowEditor(false); setIsRecording(false); setSessionSteps([]); }}
                             className="px-6 py-2.5 font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors text-sm"
                         >
                             Discard
                         </button>
                         <button 
                             onClick={handleSaveWorkflowFromEditor}
                             disabled={!newWorkflowName.trim() || sessionSteps.length === 0}
                             className="px-6 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 shadow-lg active:scale-95 transition-all text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="absolute bottom-6 right-6 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 animate-in fade-in slide-in-from-bottom-4 overflow-hidden">
              <div className="bg-red-50 px-4 py-2 border-b border-red-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase tracking-wider">
                      <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                      Recording Actions
                  </div>
                  <span className="text-[10px] text-red-500">{sessionSteps.length} steps</span>
              </div>
              <div className="max-h-48 overflow-y-auto p-2 space-y-2">
                  {sessionSteps.length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-4 italic">
                          Perform actions on the sheet to record...
                      </div>
                  ) : (
                      sessionSteps.map((step, idx) => (
                          <div key={step.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100 text-xs">
                              <div className="w-4 h-4 rounded-full bg-white border border-gray-200 flex items-center justify-center font-bold text-gray-500 shrink-0">
                                  {idx + 1}
                              </div>
                              <span className="truncate text-gray-700">{step.description}</span>
                          </div>
                      ))
                  )}
              </div>
          </div>
      )}

      {/* Create Workflow Type Modal */}
      {createWorkflowTypeModal && (
          <div className="fixed inset-0 z-[300] bg-[#0f172a]/40 flex items-center justify-center backdrop-blur-md">
              <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in fade-in zoom-in duration-200 border border-white/20">
                  <h2 className="text-[18px] font-semibold text-[#0a0a0a] mb-1.5 tracking-[-0.01em]">Create New Workflow</h2>
                  <p className="text-[#666] mb-5 text-[13px]">What type of data process do you want to automate?</p>
                  
                  <div className="space-y-2.5">
                      <button 
                          onClick={() => { 
                              setCreateWorkflowTypeModal(false); 
                              navigate('/extract/new'); 
                              setIsRecording(true); 
                              setSessionSteps([]); 
                          }}
                          className="w-full p-3.5 border border-[#e5e5e5] rounded-xl flex items-center gap-3 hover:border-orange-300 hover:bg-orange-50/50 transition-all group text-left"
                      >
                          <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                              <ScanText size={18} />
                          </div>
                          <div>
                              <div className="font-medium text-[14px] text-[#0a0a0a]">PDF Extraction</div>
                              <div className="text-[12px] text-[#666]">Automate invoice/receipt processing</div>
                          </div>
                      </button>

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
                          className="w-full p-3.5 border border-[#e5e5e5] rounded-xl flex items-center gap-3 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all group text-left"
                      >
                          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                              <FileSpreadsheet size={18} />
                          </div>
                          <div>
                              <div className="font-medium text-[14px] text-[#0a0a0a]">Spreadsheet Action</div>
                              <div className="text-[12px] text-[#666]">Automate cleaning, sorting, formulas</div>
                          </div>
                      </button>
                  </div>
                  
                  <button 
                      onClick={() => setCreateWorkflowTypeModal(false)}
                      className="mt-4 w-full py-2 text-[12px] text-[#999] font-medium hover:text-[#666] transition-colors"
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
