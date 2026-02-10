import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './LandingPage';

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>);

describe('LandingPage', () => {
  it('renders main heading', () => {
    renderWithRouter(<LandingPage onStart={() => {}} onPricing={() => {}} />);
    expect(screen.getByText(/Stop copy-pasting invoices/i)).toBeInTheDocument();
  });

  it('renders Try Demo button', () => {
    renderWithRouter(<LandingPage onStart={() => {}} onPricing={() => {}} />);
    const demoBtns = screen.getAllByRole('button', { name: /Try Demo/i });
    expect(demoBtns.length).toBeGreaterThan(0);
  });
});
