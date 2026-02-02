import '@testing-library/jest-dom/vitest';

// Mock IntersectionObserver (jsdom doesn't provide it)
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe = () => null;
  unobserve = () => null;
  disconnect = () => null;
  takeRecords = () => [];
}
global.IntersectionObserver = MockIntersectionObserver as any;
