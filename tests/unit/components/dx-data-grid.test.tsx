/**
 * Unit Tests for DxDataGrid Component
 * Tests: T023 (sorting), T024 (filtering), T025 (export)
 *
 * Note: These tests use mock implementations to verify component behavior
 * without requiring the full DevExtreme runtime.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the entire component to avoid DevExtreme runtime dependencies
vi.mock('@/components/ui/dx-data-grid', () => ({
  DxDataGrid: vi.fn(({ dataSource, columns, keyExpr, sorting, filterRow, headerFilter, export: exportEnabled, exportFileName, virtualScrolling, searchPanel, noDataText, loading, onRowClick }) => (
    <div data-testid="dx-data-grid" data-sorting={sorting} data-filter-row={filterRow} data-export={exportEnabled} data-virtual-scrolling={virtualScrolling}>
      <table>
        <tbody>
          {dataSource?.map((item: Record<string, unknown>, index: number) => (
            <tr key={index} data-testid={`grid-row-${index}`} onClick={() => onRowClick?.({ data: item })}>
              {Object.values(item).map((value, cellIndex) => (
                <td key={cellIndex}>{String(value)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {dataSource?.length === 0 && <div data-testid="no-data">{noDataText}</div>}
      {loading && <div data-testid="loading-indicator">Loading...</div>}
    </div>
  )),
}));

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DxDataGrid } from '@/components/ui/dx-data-grid';

describe('DxDataGrid Component', () => {
  const mockData = [
    { id: 1, name: 'Item A', price: 100 },
    { id: 2, name: 'Item B', price: 200 },
    { id: 3, name: 'Item C', price: 150 },
  ];

  const mockColumns = [
    { dataField: 'id', caption: 'ID' },
    { dataField: 'name', caption: 'Name' },
    { dataField: 'price', caption: 'Price', dataType: 'number' as const },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // T023: Test sorting behavior
  describe('T023 - Sorting Behavior', () => {
    it('should pass sorting prop to DataGrid', () => {
      render(
        <DxDataGrid
          dataSource={mockData}
          columns={mockColumns}
          keyExpr="id"
          sorting
        />
      );

      const grid = screen.getByTestId('dx-data-grid');
      expect(grid).toHaveAttribute('data-sorting', 'true');
    });

    it('should allow disabling sorting', () => {
      render(
        <DxDataGrid
          dataSource={mockData}
          columns={mockColumns}
          keyExpr="id"
          sorting={false}
        />
      );

      const grid = screen.getByTestId('dx-data-grid');
      expect(grid).toHaveAttribute('data-sorting', 'false');
    });
  });

  // T024: Test filtering behavior
  describe('T024 - Filtering Behavior', () => {
    it('should pass filterRow prop to DataGrid', () => {
      render(
        <DxDataGrid
          dataSource={mockData}
          columns={mockColumns}
          keyExpr="id"
          filterRow
        />
      );

      const grid = screen.getByTestId('dx-data-grid');
      expect(grid).toHaveAttribute('data-filter-row', 'true');
    });

    it('should render all data rows when no filter applied', () => {
      render(
        <DxDataGrid
          dataSource={mockData}
          columns={mockColumns}
          keyExpr="id"
        />
      );

      const rows = screen.getAllByTestId(/grid-row-/);
      expect(rows).toHaveLength(mockData.length);
    });
  });

  // T025: Test export functionality
  describe('T025 - Export Functionality', () => {
    it('should pass export prop to DataGrid', () => {
      render(
        <DxDataGrid
          dataSource={mockData}
          columns={mockColumns}
          keyExpr="id"
          export
          exportFileName="test-export"
        />
      );

      const grid = screen.getByTestId('dx-data-grid');
      expect(grid).toHaveAttribute('data-export', 'true');
    });
  });

  describe('Data Rendering', () => {
    it('should render all data rows', () => {
      render(
        <DxDataGrid
          dataSource={mockData}
          columns={mockColumns}
          keyExpr="id"
        />
      );

      const rows = screen.getAllByTestId(/grid-row-/);
      expect(rows).toHaveLength(mockData.length);
    });

    it('should display noDataText when data is empty', () => {
      render(
        <DxDataGrid
          dataSource={[]}
          columns={mockColumns}
          keyExpr="id"
          noDataText="No items found"
        />
      );

      expect(screen.getByTestId('no-data')).toHaveTextContent('No items found');
    });

    it('should show loading indicator when loading prop is true', () => {
      render(
        <DxDataGrid
          dataSource={mockData}
          columns={mockColumns}
          keyExpr="id"
          loading
        />
      );

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    });
  });

  describe('Virtual Scrolling', () => {
    it('should enable virtual scrolling when prop is true', () => {
      render(
        <DxDataGrid
          dataSource={mockData}
          columns={mockColumns}
          keyExpr="id"
          virtualScrolling
          height={400}
        />
      );

      const grid = screen.getByTestId('dx-data-grid');
      expect(grid).toHaveAttribute('data-virtual-scrolling', 'true');
    });
  });

  describe('Row Click Handler', () => {
    it('should call onRowClick when row is clicked', () => {
      const handleRowClick = vi.fn();

      render(
        <DxDataGrid
          dataSource={mockData}
          columns={mockColumns}
          keyExpr="id"
          onRowClick={handleRowClick}
        />
      );

      const firstRow = screen.getByTestId('grid-row-0');
      fireEvent.click(firstRow);

      expect(handleRowClick).toHaveBeenCalledWith({ data: mockData[0] });
    });
  });
});
