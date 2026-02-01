import { Workflow, ExcelFile } from '../types';
import { resolveColumnIndex } from './workflow-utils';

interface StepResult {
  step: { type: string; description: string; params: any };
  success: boolean;
  index: number;
  error?: string;
}

export interface WorkflowRunnerCallbacks {
  addToast: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
  getCredits: () => number;
  onRollback?: (rolledBackFile: ExcelFile) => void | Promise<void>;
}

export async function runWorkflow(
  workflow: Workflow,
  targetFile: ExcelFile,
  callbacks: WorkflowRunnerCallbacks
): Promise<ExcelFile> {
  const { addToast, getCredits, onRollback } = callbacks;

  if (!workflow.steps || workflow.steps.length === 0) {
    addToast('error', 'Invalid Workflow', 'Workflow has no steps to execute.');
    return targetFile;
  }

  addToast('info', 'Running Workflow', `Executing ${workflow.name}...`);
  let data = targetFile.data.map((row) => [...row]);
  let columns = [...targetFile.columns];
  let styles = { ...targetFile.styles };
  const originalData = targetFile.data.map((row) => [...row]);
  const originalColumns = [...targetFile.columns];
  const originalStyles = { ...targetFile.styles };

  const deleteColSteps = workflow.steps.filter((s) => s.type === 'delete_col');
  const deleteRowSteps = workflow.steps.filter((s) => s.type === 'delete_row').sort((a, b) => b.params.rowIndex - a.params.rowIndex);
  const otherSteps = workflow.steps.filter((s) => s.type !== 'delete_col' && s.type !== 'delete_row');

  const stepResults: StepResult[] = [];
  let failedStepIndex: number | null = null;

  try {
    for (let stepIdx = 0; stepIdx < otherSteps.length; stepIdx++) {
      const step = otherSteps[stepIdx];
      const stepResult: StepResult = { step, success: false, index: stepIdx };

      try {
        if (step.type === 'sort') {
          const { action, r1, c1, r2, c2 } = step.params;
          if (r1 < 0 || r2 >= data.length || c1 < 0 || c2 >= (data[0]?.length || 0)) continue;
          for (let r = r1; r <= r2; r++) {
            for (let c = c1; c <= c2; c++) {
              if (data[r]?.[c] !== undefined) {
                let val = data[r][c];
                if (typeof val === 'string') {
                  if (action === 'trim') val = val.trim();
                  if (action === 'upper') val = val.toUpperCase();
                  if (action === 'lower') val = val.toLowerCase();
                  if (action === 'title') val = val.toLowerCase().split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                }
                data[r][c] = val;
              }
            }
          }
        }
        if (step.type === 'enrich') {
          const { prompt, colIndex, columnName } = step.params;
          const targetCol = resolveColumnIndex(columns, columnName, colIndex);
          if (targetCol === null) {
            addToast('warning', 'Column Not Found', `Column "${columnName || '?'}" not found in this file. Skipping enrich step.`);
            continue;
          }
          if (targetCol >= 0 && targetCol < (data[0]?.length || 0) && prompt) {
            try {
              const sourceData = data.slice(1).map((r) => r[targetCol]).filter((v) => v !== undefined && v !== null && v !== '');
              const allUniqueItems = Array.from(new Set(sourceData.map((v) => String(v).trim())));
              if (allUniqueItems.length > 0) {
                const { api } = await import('./api');
                const BATCH_SIZE = 100;
                const numBatches = Math.ceil(allUniqueItems.length / BATCH_SIZE);
                const batchCost = numBatches * 25;
                if (getCredits() < batchCost) {
                  addToast('error', 'Insufficient Credits', `Enrichment requires ${batchCost} credits.`);
                  continue;
                }
                const mergedResult: Record<string, any> = {};
                for (let i = 0; i < allUniqueItems.length; i += BATCH_SIZE) {
                  const batch = allUniqueItems.slice(i, i + BATCH_SIZE);
                  try {
                    const response = await api.enrich(batch, prompt);
                    Object.assign(mergedResult, response.result);
                  } catch (batchError: any) {
                    if (batchError?.message?.includes('Insufficient credits')) break;
                  }
                }
                const lookupMap = new Map<string, any>();
                for (const [key, value] of Object.entries(mergedResult)) {
                  lookupMap.set(String(key).trim().toLowerCase(), value);
                }
                const newColIdx = data[0].length;
                data[0][newColIdx] = 'Enriched Info';
                columns.push('Enriched Info');
                for (let r = 1; r < data.length; r++) {
                  if (!data[r]) data[r] = [];
                  const cellValue = data[r][targetCol];
                  if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
                    let enrichedValue = mergedResult[cellValue] || mergedResult[String(cellValue)];
                    if (enrichedValue === undefined) enrichedValue = lookupMap.get(String(cellValue).trim().toLowerCase());
                    if (enrichedValue !== undefined) data[r][newColIdx] = typeof enrichedValue === 'object' ? JSON.stringify(enrichedValue) : enrichedValue;
                  }
                }
              }
            } catch (e: any) {
              addToast('warning', 'Enrichment Failed', `Step "${step.description}" failed: ${e.message || 'Unknown error'}`);
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
          const { colIndex, operator, value, columnName } = step.params;
          const targetCol = resolveColumnIndex(columns, columnName, colIndex);
          if (targetCol === null) {
            addToast('warning', 'Column Not Found', `Column "${columnName || '?'}" not found. Skipping filter step.`);
            continue;
          }
          const needsValue = operator !== 'not_empty' && operator !== 'empty';
          if (targetCol >= 0 && targetCol < (data[0]?.length || 0) && operator && (!needsValue || value !== undefined)) {
            const headerRow = data[0];
            const filteredData = [headerRow];
            for (let r = 1; r < data.length; r++) {
              if (!data[r]) continue;
              const cellValue = data[r][targetCol];
              let shouldInclude = false;
              if (operator === 'equals') shouldInclude = String(cellValue) === String(value);
              else if (operator === 'contains') shouldInclude = String(cellValue).toLowerCase().includes(String(value).toLowerCase());
              else if (operator === 'greater') shouldInclude = Number(cellValue) > Number(value);
              else if (operator === 'less') shouldInclude = Number(cellValue) < Number(value);
              else if (operator === 'not_empty') shouldInclude = cellValue !== undefined && cellValue !== null && cellValue !== '';
              else if (operator === 'empty') shouldInclude = cellValue === undefined || cellValue === null || cellValue === '';
              if (shouldInclude) filteredData.push(data[r]);
            }
            data = filteredData;
          }
        }
        if (step.type === 'format') {
          const { styleKey, value, r1, r2, c1, c2 } = step.params;
          if (styleKey == null || value == null) continue;
          const rowCount = data.length;
          const colCount = rowCount > 0 ? Math.max(...data.map((r) => r?.length || 0), 1) : 0;
          const safeR1 = Math.max(0, r1 ?? 0);
          const safeR2 = Math.min(rowCount - 1, r2 ?? 0);
          const safeC1 = Math.max(0, c1 ?? 0);
          const safeC2 = Math.min(colCount - 1, c2 ?? 0);
          if (safeR1 <= safeR2 && safeC1 <= safeC2) {
            for (let r = safeR1; r <= safeR2; r++) {
              for (let c = safeC1; c <= safeC2; c++) {
                const key = `${r},${c}`;
                styles[key] = { ...(styles[key] || {}), [styleKey]: value };
              }
            }
          }
        }

        stepResult.success = true;
        stepResults.push(stepResult);
      } catch (stepError: any) {
        stepResult.error = stepError.message || 'Unknown error';
        stepResult.success = false;
        stepResults.push(stepResult);
        failedStepIndex = stepIdx;
        addToast('error', 'Step Failed', `Step ${stepIdx + 1}: "${step.description}" failed: ${stepResult.error}`);
      }
    }

    const criticalFailures = stepResults.filter((r) => !r.success && (r.step.type === 'enrich' || r.step.type === 'filter'));
    if (criticalFailures.length > 0 && failedStepIndex !== null) {
      addToast('warning', 'Workflow Partially Failed', `${criticalFailures.length} critical step(s) failed.`);
    }

    let remainingDeleteCol = [...deleteColSteps];
    let deleteColStepIdx = 0;
    while (remainingDeleteCol.length > 0) {
      const resolved = remainingDeleteCol
        .map((s) => ({ step: s, idx: resolveColumnIndex(columns, s.params.columnName, s.params.colIndex) }))
        .filter((r): r is { step: typeof r.step; idx: number } => r.idx !== null);
      if (resolved.length === 0) {
        remainingDeleteCol.forEach((s) => addToast('warning', 'Column Not Found', `Column "${s.params.columnName || '?'}" not found.`));
        break;
      }
      resolved.sort((a, b) => b.idx - a.idx);
      const { step, idx: colIndex } = resolved[0];
      try {
        if (colIndex >= 0 && colIndex < (data[0]?.length || 0)) {
          data = data.map((row) => row.filter((_, i) => i !== colIndex));
          if (columns.length > colIndex) columns = columns.filter((_, i) => i !== colIndex);
          const newStyles: Record<string, any> = {};
          for (const [key, style] of Object.entries(styles)) {
            const [r, c] = key.split(',').map(Number);
            if (c < colIndex) newStyles[key] = style;
            else if (c > colIndex) newStyles[`${r},${c - 1}`] = style;
          }
          styles = newStyles;
        }
      } catch (_) {}
      remainingDeleteCol = remainingDeleteCol.filter((s) => s !== step);
      deleteColStepIdx++;
    }

    for (let stepIdx = 0; stepIdx < deleteRowSteps.length; stepIdx++) {
      const step = deleteRowSteps[stepIdx];
      try {
        const { rowIndex } = step.params;
        if (rowIndex >= 0 && rowIndex < data.length) {
          data = data.filter((_, i) => i !== rowIndex);
          const newStyles: Record<string, any> = {};
          for (const [key, style] of Object.entries(styles)) {
            const [r, c] = key.split(',').map(Number);
            if (r < rowIndex) newStyles[key] = style;
            else if (r > rowIndex) newStyles[`${r - 1},${c}`] = style;
          }
          styles = newStyles;
        }
      } catch (_) {}
    }

    const successCount = stepResults.filter((r) => r.success).length;
    const failureCount = stepResults.filter((r) => !r.success).length;

    const updatedFile = { ...targetFile, data, columns, styles, lastModified: Date.now() };

    if (failureCount === 0) {
      addToast('success', 'Workflow Completed', `All ${successCount} step(s) executed successfully.`);
    } else {
      addToast('warning', 'Workflow Partially Completed', `${successCount} step(s) succeeded, ${failureCount} step(s) failed.`);
    }

    return updatedFile;
  } catch (error: any) {
    const rolledBackFile = { ...targetFile, data: originalData, columns: originalColumns, styles: originalStyles, lastModified: Date.now() };
    if (onRollback) await onRollback(rolledBackFile);
    addToast('error', 'Workflow Failed', `Workflow execution failed: ${error.message || 'Unknown error'}. Changes have been rolled back.`);
    throw error;
  }
}
