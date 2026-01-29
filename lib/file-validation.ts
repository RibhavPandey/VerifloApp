// File validation utilities

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export interface FileValidationOptions {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  allowedExtensions?: string[];
}

const DEFAULT_OPTIONS: Required<FileValidationOptions> = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: [],
  allowedExtensions: [],
};

// Validate file before upload
export function validateFile(
  file: File,
  options: FileValidationOptions = {}
): FileValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Check file size
  if (file.size > opts.maxSize) {
    const maxSizeMB = (opts.maxSize / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File "${file.name}" is too large. Maximum size is ${maxSizeMB}MB.`,
    };
  }

  // Check file type (MIME type)
  if (opts.allowedTypes.length > 0 && !opts.allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File "${file.name}" has an invalid type. Allowed types: ${opts.allowedTypes.join(', ')}`,
    };
  }

  // Check file extension
  if (opts.allowedExtensions.length > 0) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !opts.allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `File "${file.name}" has an invalid extension. Allowed: ${opts.allowedExtensions.join(', ')}`,
      };
    }
  }

  // Check if file is empty
  if (file.size === 0) {
    return {
      valid: false,
      error: `File "${file.name}" is empty.`,
    };
  }

  return { valid: true };
}

// Validate multiple files
export function validateFiles(
  files: File[],
  options: FileValidationOptions = {}
): { valid: File[]; invalid: Array<{ file: File; error: string }> } {
  const valid: File[] = [];
  const invalid: Array<{ file: File; error: string }> = [];

  files.forEach((file) => {
    const result = validateFile(file, options);
    if (result.valid) {
      valid.push(file);
    } else {
      invalid.push({ file, error: result.error || 'Invalid file' });
    }
  });

  return { valid, invalid };
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Get file extension
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

// Check if file is an image
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

// Check if file is a PDF
export function isPDFFile(file: File): boolean {
  return file.type === 'application/pdf' || getFileExtension(file.name) === 'pdf';
}

// Check if file is a spreadsheet
export function isSpreadsheetFile(file: File): boolean {
  const extension = getFileExtension(file.name);
  const spreadsheetTypes = ['csv', 'xlsx', 'xls'];
  const spreadsheetMimeTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  return spreadsheetTypes.includes(extension) || spreadsheetMimeTypes.includes(file.type);
}