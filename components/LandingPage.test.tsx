import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './LandingPage';

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('LandingPage', () => {
  it('renders main heading', () => {
    renderWithRouter(<LandingPage onStart={() => {}} onPricing={() => {}} />);
    expect(screen.getByText(/Done in seconds/i)).toBeInTheDocument();
  });

  it('renders Start Free Trial button', () => {
    renderWithRouter(<LandingPage onStart={() => {}} onPricing={() => {}} />);
    const startBtns = screen.getAllByRole('button', { name: /Start Free Trial/i });
    expect(startBtns.length).toBeGreaterThan(0);
  });
});
