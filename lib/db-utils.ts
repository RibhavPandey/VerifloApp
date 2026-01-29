// Database utility functions for error handling and retries

import { PostgrestError } from '@supabase/supabase-js';

export interface DbError {
  message: string;
  code?: string;
  details?: string;
  isTransient: boolean;
  shouldRetry: boolean;
}

// Check if error is transient (can be retried)
export function isTransientError(error: PostgrestError | null): boolean {
  if (!error) return false;
  
  // Network/connection errors
  if (error.message?.includes('fetch') || error.message?.includes('network')) {
    return true;
  }
  
  // Timeout errors
  if (error.message?.includes('timeout') || error.message?.includes('aborted')) {
    return true;
  }
  
  // Specific Supabase error codes that are transient
  const transientCodes = ['PGRST301', 'PGRST302', '08000', '08003', '08006', '08001'];
  if (error.code && transientCodes.includes(error.code)) {
    return true;
  }
  
  return false;
}

// Parse database error into user-friendly message
export function parseDbError(error: PostgrestError | null): DbError {
  if (!error) {
    return {
      message: 'An unknown error occurred',
      isTransient: false,
      shouldRetry: false,
    };
  }
  
  const isTransient = isTransientError(error);
  
  // Map common error codes to user-friendly messages
  let userMessage = error.message || 'Database operation failed';
  
  switch (error.code) {
    case 'PGRST116':
      // Not found - this is expected in some cases, not really an error
      return {
        message: 'Record not found',
        code: error.code,
        isTransient: false,
        shouldRetry: false,
      };
    
    case '42501':
      // Permission denied
      userMessage = 'Permission denied. Please check your account permissions.';
      break;
    
    case '23505':
      // Unique violation
      userMessage = 'This record already exists.';
      break;
    
    case '23503':
      // Foreign key violation
      userMessage = 'Cannot delete this record because it is in use.';
      break;
    
    case 'PGRST301':
    case 'PGRST302':
      // Connection errors
      userMessage = 'Connection to database failed. Please check your internet connection.';
      break;
    
    default:
      if (isTransient) {
        userMessage = 'Temporary connection issue. Please try again.';
      }
  }
  
  return {
    message: userMessage,
    code: error.code,
    details: error.details || error.hint,
    isTransient,
    shouldRetry: isTransient,
  };
}

// Retry wrapper for database operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if error is retryable
      const dbError = parseDbError(error);
      
      if (!dbError.shouldRetry || attempt >= maxRetries) {
        throw error;
      }
      
      // Wait before retrying with exponential backoff
      const waitTime = delay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
}

// Sleep utility
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};