
export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: 'left' | 'center' | 'right';
  color?: string;
  bg?: string;
}

export interface FileSnapshot {
  data: any[][];
  styles: Record<string, CellStyle>;
  columns: string[];
}

export interface ExcelFile {
  id: string;
  name: string;
  data: any[][];
  columns: string[];
  styles: Record<string, CellStyle>; // Key "row,col"
  lastModified: number;
  history: FileSnapshot[];
  currentHistoryIndex: number;
}

export enum JoinType {
  INNER = 'inner',
  OUTER = 'outer',
  LEFT = 'left',
  RIGHT = 'right'
}

export type AIResponsePartType = 'text' | 'chart' | 'table' | 'forecast' | 'analysis_card' | 'formula';

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: any;
}

export interface AIResponsePart {
  type: AIResponsePartType;
  content?: string;
  data?: any[];
  chartType?: 'bar' | 'line' | 'pie' | 'area';
  title?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parts?: AIResponsePart[];
  followUps?: string[];
}

export interface DashboardItem {
  id: string;
  title: string;
  type: AIResponsePartType;
  data: any[];
  chartType?: 'bar' | 'line' | 'pie' | 'area';
  w: number;
  h: number;
}

// Analysis Types
export type AnalysisIntent = 'SUMMARY' | 'CHANGE_EXPLANATION' | 'DIMENSION_ANALYSIS' | 'SANITY_CHECK';

export interface BucketItem {
  label: string; // "Removed", "Modified", "Added"
  count: number;
  impact: string;
  color: 'red' | 'yellow' | 'green';
}

export interface SanityData {
  score: number; // 0-100
  riskLevel: 'Low' | 'Medium' | 'High';
  warnings: string[];
  suggestion: string;
}

export interface AnalysisResult {
  id: string;
  intent: AnalysisIntent;
  query: string;
  title: string;
  metrics: {
    oldLabel: string;
    oldValue: string;
    newLabel: string;
    newValue: string;
    delta: string;
    percent: string;
    isNegative: boolean;
  };
  buckets?: BucketItem[];
  drivers: { name: string; value: string; isPositive: boolean }[];
  sanity?: SanityData;
  explanation: string;
  followUps: string[];
}

// --- NEW TYPES FOR AUTOMATION ---

export type ActionType = 'enrich' | 'filter' | 'sort' | 'delete_col' | 'delete_row' | 'formula' | 'extraction' | 'format';

export interface AutomationStep {
  id: string;
  type: ActionType;
  description: string;
  params: any; // Flexible params: { prompt: "...", colIndex: 1, etc. }
}

export interface Workflow {
  id: string;
  name: string;
  sourceType: 'spreadsheet' | 'pdf';
  steps: AutomationStep[];
  createdAt: number;
  lastRun?: number;
  lastRunStatus?: 'success' | 'failed';
}

// --- NEW TYPES FOR VERIFICATION VIEW & JOBS ---

export interface ExtractedField {
  key: string;
  value: string;
  confidence: number;
  box2d?: number[]; // [ymin, xmin, ymax, xmax] normalized 0-1000
  flagged?: boolean; // If true, requires review
}

export interface FieldChange {
  fieldKey: string;
  oldValue: string;
  newValue: string;
  timestamp: number;
  oldConfidence: number;
}

export interface LineItem {
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  lineTotal: string | number;
  confidence?: number;
}

export interface VerificationDocument {
  id: string;
  fileName: string;
  mimeType: string;
  fileData: string; // Base64
  fields: ExtractedField[];
  lineItems?: LineItem[];
  status: 'pending' | 'reviewed';
  auditTrail?: FieldChange[]; // Track all changes made during review
}

export type JobStatus = 'uploading' | 'setup' | 'processing' | 'needs_review' | 'verified' | 'completed';

export interface Job {
  id: string;
  title: string;
  type: 'spreadsheet' | 'extraction';
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  fileIds: string[]; // IDs of ExcelFiles or VerificationDocuments associated
  riskyCount?: number;
  config?: {
    template: 'invoice' | 'receipt' | 'custom';
    fields: string[];
    includeLineItems?: boolean;
  };
  chatHistory?: ChatMessage[];
}