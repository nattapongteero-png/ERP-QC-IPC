/**
 * ConfidentialityBanner Component Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfidentialityBanner, ConfidentialityBadge } from '@/components/bom/ConfidentialityBanner';
import type { BOMConfidentialityInfo } from '@/types/confidentiality';

describe('ConfidentialityBanner', () => {
  describe('Rendering behavior', () => {
    it('should not render when no confidential items', () => {
      const info: BOMConfidentialityInfo = {
        hasConfidentialItems: false,
        visibleLineCount: 5,
        totalLineCount: 5,
        userHasFullAccess: true,
      };

      const { container } = render(<ConfidentialityBanner confidentialityInfo={info} />);
      expect(container.firstChild).toBeNull();
    });

    it('should render banner when has confidential items', () => {
      const info: BOMConfidentialityInfo = {
        hasConfidentialItems: true,
        visibleLineCount: 3,
        totalLineCount: 5,
        userHasFullAccess: false,
      };

      render(<ConfidentialityBanner confidentialityInfo={info} />);
      expect(screen.getByTestId('confidentiality-banner')).toBeInTheDocument();
    });
  });

  describe('Full access message', () => {
    it('should show full access message when user has access', () => {
      const info: BOMConfidentialityInfo = {
        hasConfidentialItems: true,
        visibleLineCount: 5,
        totalLineCount: 5,
        userHasFullAccess: true,
      };

      render(<ConfidentialityBanner confidentialityInfo={info} />);
      expect(screen.getByText(/You have full access/)).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  describe('Limited access message', () => {
    it('should show limited access message with counts', () => {
      const info: BOMConfidentialityInfo = {
        hasConfidentialItems: true,
        visibleLineCount: 3,
        totalLineCount: 5,
        userHasFullAccess: false,
      };

      render(<ConfidentialityBanner confidentialityInfo={info} />);
      expect(screen.getByText(/2 confidential items/)).toBeInTheDocument();
      expect(screen.getByText(/Showing/)).toBeInTheDocument();
    });

    it('should show singular form for one hidden item', () => {
      const info: BOMConfidentialityInfo = {
        hasConfidentialItems: true,
        visibleLineCount: 4,
        totalLineCount: 5,
        userHasFullAccess: false,
      };

      render(<ConfidentialityBanner confidentialityInfo={info} />);
      expect(screen.getByText(/1 confidential item/)).toBeInTheDocument();
    });
  });

  describe('Variant styling', () => {
    it('should use amber styling for limited access', () => {
      const info: BOMConfidentialityInfo = {
        hasConfidentialItems: true,
        visibleLineCount: 3,
        totalLineCount: 5,
        userHasFullAccess: false,
      };

      render(<ConfidentialityBanner confidentialityInfo={info} />);
      const banner = screen.getByTestId('confidentiality-banner');
      expect(banner).toHaveClass('bg-amber-50');
    });

    it('should use blue styling for full access with info variant', () => {
      const info: BOMConfidentialityInfo = {
        hasConfidentialItems: true,
        visibleLineCount: 5,
        totalLineCount: 5,
        userHasFullAccess: true,
      };

      render(<ConfidentialityBanner confidentialityInfo={info} variant="info" />);
      const banner = screen.getByTestId('confidentiality-banner');
      expect(banner).toHaveClass('bg-blue-50');
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      const info: BOMConfidentialityInfo = {
        hasConfidentialItems: true,
        visibleLineCount: 3,
        totalLineCount: 5,
        userHasFullAccess: false,
      };

      render(<ConfidentialityBanner confidentialityInfo={info} className="my-custom-class" />);
      const banner = screen.getByTestId('confidentiality-banner');
      expect(banner).toHaveClass('my-custom-class');
    });
  });
});

describe('ConfidentialityBadge', () => {
  it('should not render when no confidential items', () => {
    const info: BOMConfidentialityInfo = {
      hasConfidentialItems: false,
      visibleLineCount: 5,
      totalLineCount: 5,
      userHasFullAccess: true,
    };

    const { container } = render(<ConfidentialityBadge confidentialityInfo={info} />);
    expect(container.firstChild).toBeNull();
  });

  it('should show "Full Access" for users with access', () => {
    const info: BOMConfidentialityInfo = {
      hasConfidentialItems: true,
      visibleLineCount: 5,
      totalLineCount: 5,
      userHasFullAccess: true,
    };

    render(<ConfidentialityBadge confidentialityInfo={info} />);
    expect(screen.getByText('Full Access')).toBeInTheDocument();
  });

  it('should show count ratio for limited access', () => {
    const info: BOMConfidentialityInfo = {
      hasConfidentialItems: true,
      visibleLineCount: 3,
      totalLineCount: 5,
      userHasFullAccess: false,
    };

    render(<ConfidentialityBadge confidentialityInfo={info} />);
    expect(screen.getByText('3/5')).toBeInTheDocument();
  });

  it('should have correct styling for full access', () => {
    const info: BOMConfidentialityInfo = {
      hasConfidentialItems: true,
      visibleLineCount: 5,
      totalLineCount: 5,
      userHasFullAccess: true,
    };

    render(<ConfidentialityBadge confidentialityInfo={info} />);
    const badge = screen.getByTestId('confidentiality-badge');
    expect(badge).toHaveClass('bg-blue-100');
  });

  it('should have correct styling for limited access', () => {
    const info: BOMConfidentialityInfo = {
      hasConfidentialItems: true,
      visibleLineCount: 3,
      totalLineCount: 5,
      userHasFullAccess: false,
    };

    render(<ConfidentialityBadge confidentialityInfo={info} />);
    const badge = screen.getByTestId('confidentiality-badge');
    expect(badge).toHaveClass('bg-amber-100');
  });
});
