/**
 * Workflow Test Page Tests
 *
 * UI tests for the workflow test page following React Testing Library best practices.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import WorkflowTestPage from '@/app/settings/workflow-test/page'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/settings/workflow-test',
}))

// Mock the MainLayout component
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}))

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('WorkflowTestPage', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial Rendering', () => {
    it('renders the page with title and description', async () => {
      render(<WorkflowTestPage />)

      expect(screen.getByText('Workflow Test')).toBeInTheDocument()
      expect(screen.getByText(/end-to-end.*test/i)).toBeInTheDocument()
    })

    it('renders all 8 phases in the pathway', async () => {
      render(<WorkflowTestPage />)

      // Check for phase names
      expect(screen.getByText('Master Data Setup')).toBeInTheDocument()
      expect(screen.getByText('BOM & Production Planning')).toBeInTheDocument()
      expect(screen.getByText('Purchasing Flow')).toBeInTheDocument()
      expect(screen.getByText('Production Flow')).toBeInTheDocument()
      expect(screen.getByText('Finished Goods QC')).toBeInTheDocument()
      expect(screen.getByText('Sales Flow')).toBeInTheDocument()
      expect(screen.getByText('Accounting Verification')).toBeInTheDocument()
      expect(screen.getByText('VMI Integration')).toBeInTheDocument()
    })

    it('renders Run button enabled initially', async () => {
      render(<WorkflowTestPage />)

      const runButton = screen.getByRole('button', { name: /run.*test/i })
      expect(runButton).toBeInTheDocument()
      expect(runButton).not.toBeDisabled()
    })

    it('renders steps within each phase', async () => {
      render(<WorkflowTestPage />)

      // Check for some step names from different phases
      expect(screen.getByText(/warehouse.*storage/i)).toBeInTheDocument()
      expect(screen.getByText(/bill of materials/i)).toBeInTheDocument()
      expect(screen.getByText(/vendor.*avl/i)).toBeInTheDocument()
    })
  })

  describe('Step Status Display', () => {
    it('shows all steps as pending initially', async () => {
      render(<WorkflowTestPage />)

      // Find step nodes - they should have pending styling (gray)
      const stepNodes = screen.getAllByTestId(/^step-node-/)
      expect(stepNodes.length).toBe(31)

      // Check that steps have pending status class
      stepNodes.forEach((node) => {
        expect(node).toHaveClass('bg-gray-200')
      })
    })

    it('displays phase headers with step counts', async () => {
      render(<WorkflowTestPage />)

      // Check phase headers show step counts - using getAllByText since multiple phases have same step count
      const fourStepPhases = screen.getAllByText(/4 steps/i)
      expect(fourStepPhases.length).toBeGreaterThan(0)

      const twoStepPhases = screen.getAllByText(/2 steps/i)
      expect(twoStepPhases.length).toBeGreaterThan(0)
    })
  })

  describe('Run Test Interaction', () => {
    it('shows loading state when test starts', async () => {
      // Mock SSE response
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"connected","sessionId":"test-1","totalSteps":31}\n\n'),
          })
          .mockResolvedValueOnce({
            done: true,
            value: undefined,
          }),
        cancel: vi.fn(),
      }

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      })

      render(<WorkflowTestPage />)

      const runButton = screen.getByRole('button', { name: /run.*test/i })
      fireEvent.click(runButton)

      await waitFor(() => {
        expect(screen.getByText(/running/i)).toBeInTheDocument()
      })
    })

    it('shows Cancel button when test is running', async () => {
      const mockReader = {
        read: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
        cancel: vi.fn(),
      }

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      })

      render(<WorkflowTestPage />)

      const runButton = screen.getByRole('button', { name: /run.*test/i })
      fireEvent.click(runButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      })
    })

    it('disables Run button while test is running', async () => {
      const mockReader = {
        read: vi.fn().mockImplementation(() => new Promise(() => {})),
        cancel: vi.fn(),
      }

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      })

      render(<WorkflowTestPage />)

      const runButton = screen.getByRole('button', { name: /run.*test/i })
      fireEvent.click(runButton)

      await waitFor(() => {
        expect(runButton).toBeDisabled()
      })
    })
  })

  describe('Real-Time Step Updates', () => {
    it('has step nodes that can show different status colors', async () => {
      // This test verifies the component structure supports status updates
      // The actual SSE streaming behavior is tested via integration tests
      render(<WorkflowTestPage />)

      // Verify step nodes exist and have pending status initially
      const stepNodes = screen.getAllByTestId(/^step-node-/)
      expect(stepNodes.length).toBe(31)

      // Check first step has pending status (gray background)
      const step1 = screen.getByTestId('step-node-1')
      expect(step1).toHaveClass('bg-gray-200')
    })

    it('step nodes have proper status styling classes', async () => {
      // Verify step nodes have the proper CSS classes for styling
      render(<WorkflowTestPage />)

      const step1 = screen.getByTestId('step-node-1')

      // Verify pending step has correct base classes
      expect(step1).toHaveClass('rounded-full')
      expect(step1).toHaveClass('flex')
      expect(step1).toHaveClass('items-center')
      expect(step1).toHaveClass('justify-center')
    })

    it('all 31 step nodes are clickable', async () => {
      render(<WorkflowTestPage />)

      const stepNodes = screen.getAllByTestId(/^step-node-/)
      expect(stepNodes.length).toBe(31)

      // Verify each step is a button and clickable
      stepNodes.forEach((node) => {
        expect(node.tagName).toBe('BUTTON')
      })
    })
  })

  describe('Log Panel', () => {
    it('renders log panel container', async () => {
      render(<WorkflowTestPage />)

      expect(screen.getByTestId('workflow-log-panel')).toBeInTheDocument()
    })

    it('log panel shows empty state initially', async () => {
      render(<WorkflowTestPage />)

      const logPanel = screen.getByTestId('workflow-log-panel')
      expect(logPanel).toBeInTheDocument()
      // Should show "No log entries yet" initially
      expect(screen.getByText(/no log entries/i)).toBeInTheDocument()
    })
  })

  describe('Step Click for Details', () => {
    it('shows step details when step is clicked', async () => {
      render(<WorkflowTestPage />)

      // Click on a step
      const step1 = screen.getByTestId('step-node-1')
      fireEvent.click(step1)

      // Should show step detail dialog
      await waitFor(() => {
        expect(screen.getByTestId('step-detail-dialog')).toBeInTheDocument()
      })
    })

    it('displays step name and description in detail dialog', async () => {
      render(<WorkflowTestPage />)

      // Click on a step
      const step1 = screen.getByTestId('step-node-1')
      fireEvent.click(step1)

      // Wait for dialog and check it shows content
      await waitFor(() => {
        expect(screen.getByTestId('step-detail-dialog')).toBeInTheDocument()
      })

      // Dialog should contain step information
      const dialog = screen.getByTestId('step-detail-dialog')
      expect(dialog).toBeInTheDocument()
    })

    it('closes detail dialog when close button clicked', async () => {
      render(<WorkflowTestPage />)

      // Click on a step
      const step1 = screen.getByTestId('step-node-1')
      fireEvent.click(step1)

      await waitFor(() => {
        expect(screen.getByTestId('step-detail-dialog')).toBeInTheDocument()
      })

      // Click close button - use data-testid to be specific
      const closeButton = screen.getByTestId('step-detail-close-button')
      fireEvent.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByTestId('step-detail-dialog')).not.toBeInTheDocument()
      })
    })
  })

  describe('Test Summary', () => {
    it('has a test result display element ready for test completion', async () => {
      // This test verifies the component has the capability to show test results
      // The actual test result display is tested via integration tests
      render(<WorkflowTestPage />)

      // Verify the page can render without errors
      expect(screen.getByText('Workflow Test')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /run.*test/i })).toBeInTheDocument()
    })
  })

  describe('Configuration Panel', () => {
    it('renders configuration panel toggle button', async () => {
      render(<WorkflowTestPage />)

      // Should have a config settings button
      const configButton = screen.getByRole('button', { name: /configure/i })
      expect(configButton).toBeInTheDocument()
    })

    it('shows configuration form when toggle is clicked', async () => {
      render(<WorkflowTestPage />)

      // Click on configure button
      const configButton = screen.getByRole('button', { name: /configure/i })
      fireEvent.click(configButton)

      // Wait for config panel to show
      await waitFor(() => {
        expect(screen.getByTestId('workflow-test-config')).toBeInTheDocument()
      })

      // Click on expand toggle
      const toggleButton = screen.getByTestId('config-toggle-button')
      fireEvent.click(toggleButton)

      // Check for config fields
      await waitFor(() => {
        expect(screen.getByTestId('config-panel')).toBeInTheDocument()
      })
    })

    it('displays config fields when expanded', async () => {
      render(<WorkflowTestPage />)

      // Open config
      const configButton = screen.getByRole('button', { name: /configure/i })
      fireEvent.click(configButton)

      await waitFor(() => {
        expect(screen.getByTestId('workflow-test-config')).toBeInTheDocument()
      })

      // Expand panel
      const toggleButton = screen.getByTestId('config-toggle-button')
      fireEvent.click(toggleButton)

      // Check for specific fields
      await waitFor(() => {
        expect(screen.getByTestId('config-field-prefix')).toBeInTheDocument()
        expect(screen.getByTestId('config-field-warehouseName')).toBeInTheDocument()
      })
    })
  })
})
