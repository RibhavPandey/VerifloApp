// Network utilities for retry logic, offline detection, and graceful degradation

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
  retryableStatuses?: number[];
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

// Check if we're online
export const isOnline = (): boolean => {
  return typeof navigator !== 'undefined' && navigator.onLine;
};

// Check if error is retryable
const isRetryableError = (error: any, retryableStatuses: number[]): boolean => {
  if (!isOnline()) return false;
  
  // Network errors (no response)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  
  // HTTP status codes
  if (error.status && retryableStatuses.includes(error.status)) {
    return true;
  }
  
  // Timeout errors
  if (error.message?.includes('timeout') || error.message?.includes('aborted')) {
    return true;
  }
  
  return false;
};

// Sleep utility
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Retry wrapper for fetch requests
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
  let lastError: any;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // Check if we're online before making request
      if (!isOnline()) {
        throw new Error('You are currently offline. Please check your internet connection.');
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // If response is ok, return it
      if (response.ok) {
        return response;
      }
      
      // Check if status is retryable
      const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      error.response = response;
      
      if (isRetryableError(error, opts.retryableStatuses) && attempt < opts.maxRetries) {
        lastError = error;
        const delay = opts.retryDelay * Math.pow(opts.backoffMultiplier, attempt);
        await sleep(delay);
        continue;
      }
      
      // Not retryable or max retries reached
      return response;
    } catch (error: any) {
      lastError = error;
      
      // Check if error is retryable
      if (isRetryableError(error, opts.retryableStatuses) && attempt < opts.maxRetries) {
        const delay = opts.retryDelay * Math.pow(opts.backoffMultiplier, attempt);
        await sleep(delay);
        continue;
      }
      
      // Not retryable or max retries reached
      throw error;
    }
  }
  
  // All retries exhausted
  throw lastError;
}

// Network status listener utility
export class NetworkStatus {
  private listeners: Set<(online: boolean) => void> = new Set();
  
  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.notifyListeners(true));
      window.addEventListener('offline', () => this.notifyListeners(false));
    }
  }
  
  private notifyListeners(online: boolean) {
    this.listeners.forEach(listener => listener(online));
  }
  
  subscribe(callback: (online: boolean) => void): () => void {
    this.listeners.add(callback);
    // Immediately call with current status
    callback(isOnline());
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }
  
  isOnline(): boolean {
    return isOnline();
  }
}

export const networkStatus = new NetworkStatus();