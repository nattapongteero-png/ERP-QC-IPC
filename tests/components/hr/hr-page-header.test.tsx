import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HrPageHeader } from '@/components/hr/hr-page-header';
import { Users } from 'lucide-react';

describe('HrPageHeader', () => {
  it('renders title and subtitle', () => {
    render(
      <HrPageHeader
        title="Employees"
        subtitle="Manage employee records"
        icon={Users}
      />
    );
    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(screen.getByText('Manage employee records')).toBeInTheDocument();
  });

  it('renders title without subtitle when subtitle is not provided', () => {
    render(
      <HrPageHeader
        title="Employees"
        icon={Users}
      />
    );
    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(screen.queryByText('Manage employee records')).not.toBeInTheDocument();
  });

  it('renders action buttons when provided', () => {
    render(
      <HrPageHeader
        title="Employees"
        icon={Users}
        actions={<button>Add Employee</button>}
      />
    );
    expect(screen.getByText('Add Employee')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(
      <HrPageHeader
        title="Employees"
        icon={Users}
      >
        <span>Child Content</span>
      </HrPageHeader>
    );
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('shows refresh button and calls onRefresh when clicked', async () => {
    const onRefresh = vi.fn();
    render(
      <HrPageHeader
        title="Employees"
        icon={Users}
        onRefresh={onRefresh}
      />
    );
    const refreshBtn = screen.getByText('Refresh');
    expect(refreshBtn).toBeInTheDocument();
    fireEvent.click(refreshBtn);
    expect(onRefresh).toHaveBeenCalled();
  });

  it('disables refresh button when isRefreshing is true', () => {
    const onRefresh = vi.fn();
    render(
      <HrPageHeader
        title="Employees"
        icon={Users}
        onRefresh={onRefresh}
        isRefreshing={true}
      />
    );
    const refreshBtn = screen.getByText('Refresh');
    expect(refreshBtn.closest('div[role="button"]')).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not render refresh button when onRefresh is not provided', () => {
    render(
      <HrPageHeader
        title="Employees"
        icon={Users}
      />
    );
    expect(screen.queryByText('Refresh')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <HrPageHeader
        title="Employees"
        icon={Users}
        className="custom-class"
      />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('applies custom iconClassName', () => {
    const { container } = render(
      <HrPageHeader
        title="Employees"
        icon={Users}
        iconClassName="from-purple-500 to-purple-600"
      />
    );
    // The icon container should have the custom gradient class
    const iconContainer = container.querySelector('.from-purple-500');
    expect(iconContainer).toBeInTheDocument();
  });
});
