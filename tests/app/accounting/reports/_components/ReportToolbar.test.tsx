/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportToolbar } from '@/app/accounting/reports/_components/ReportToolbar';

describe('ReportToolbar', () => {
  const mockHandlers = {
    onExportPDF: vi.fn(),
    onExportExcel: vi.fn(),
    onExportCSV: vi.fn(),
    onPrint: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all export buttons', () => {
    render(<ReportToolbar {...mockHandlers} />);
    expect(screen.getByTestId('export-pdf')).toBeInTheDocument();
    expect(screen.getByTestId('export-excel')).toBeInTheDocument();
    expect(screen.getByTestId('export-csv')).toBeInTheDocument();
    expect(screen.getByTestId('print-button')).toBeInTheDocument();
  });

  it('calls onExportPDF when PDF button clicked', () => {
    render(<ReportToolbar {...mockHandlers} />);
    fireEvent.click(screen.getByTestId('export-pdf'));
    expect(mockHandlers.onExportPDF).toHaveBeenCalled();
  });

  it('calls onExportExcel when Excel button clicked', () => {
    render(<ReportToolbar {...mockHandlers} />);
    fireEvent.click(screen.getByTestId('export-excel'));
    expect(mockHandlers.onExportExcel).toHaveBeenCalled();
  });

  it('calls onExportCSV when CSV button clicked', () => {
    render(<ReportToolbar {...mockHandlers} />);
    fireEvent.click(screen.getByTestId('export-csv'));
    expect(mockHandlers.onExportCSV).toHaveBeenCalled();
  });

  it('calls onPrint when Print button clicked', () => {
    render(<ReportToolbar {...mockHandlers} />);
    fireEvent.click(screen.getByTestId('print-button'));
    expect(mockHandlers.onPrint).toHaveBeenCalled();
  });

  it('disables all buttons when disabled prop is true', () => {
    render(<ReportToolbar {...mockHandlers} disabled />);
    expect(screen.getByTestId('export-pdf')).toBeDisabled();
    expect(screen.getByTestId('export-excel')).toBeDisabled();
    expect(screen.getByTestId('export-csv')).toBeDisabled();
    expect(screen.getByTestId('print-button')).toBeDisabled();
  });
});
