/**
 * Issue Tracker AI Validation Service Unit Tests
 * Task 5: AI validation and duplicate detection tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock data
const mockCategory = {
  id: 1,
  name: 'Software Bug',
  description: 'Software-related issues',
  type: 'software' as const,
  requiredFields: ['summary', 'stepsToReproduce'],
  aiPrompt: 'Check that the bug report includes clear reproduction steps',
  isActive: true,
  createdAt: '2026-01-16T00:00:00.000Z',
  updatedAt: '2026-01-16T00:00:00.000Z',
};

const mockCategoryNoCustomPrompt = {
  id: 2,
  name: 'Operational Issue',
  description: 'Operational issues',
  type: 'operational' as const,
  requiredFields: ['summary', 'impact'],
  aiPrompt: null,
  isActive: true,
  createdAt: '2026-01-16T00:00:00.000Z',
  updatedAt: '2026-01-16T00:00:00.000Z',
};

const mockIssueData = {
  title: 'Login page crashes when clicking submit',
  description: {
    summary: 'The login page shows an error when clicking the submit button',
    impact: 'Users cannot log in to the system',
    environment: 'Production environment',
    expectedBehavior: 'User should be logged in successfully',
    actualBehavior: 'Page crashes with JavaScript error',
    stepsToReproduce: '1. Go to login page\n2. Enter credentials\n3. Click submit',
  },
};

const mockExistingIssues = [
  {
    id: 101,
    issueNumber: 'ISS-2026-0001',
    title: 'Login button not working',
    description: { summary: 'Login button does not respond when clicked' },
  },
  {
    id: 102,
    issueNumber: 'ISS-2026-0002',
    title: 'Dashboard loading slow',
    description: { summary: 'Dashboard takes too long to load' },
  },
  {
    id: 103,
    issueNumber: 'ISS-2026-0003',
    title: 'Report export fails',
    description: { summary: 'Cannot export reports to PDF' },
  },
];

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after global mock is set up
import {
  AI_CONFIG,
  validateIssue,
  checkDuplicates,
  buildValidationPrompt,
  buildDuplicateDetectionPrompt,
  getUnavailableValidationResult,
  getUnavailableDuplicateResult,
} from '@/lib/services/issues-ai.service';
import type { AIValidationResult, AIDuplicateResult } from '@/types/issues';

describe('Issues AI Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default env vars
    vi.stubEnv('OPENROUTER_API_KEY', 'test-api-key');
    vi.stubEnv('APP_URL', 'http://localhost:33021');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ============================================
  // Configuration Tests
  // ============================================
  describe('AI_CONFIG', () => {
    it('should have correct default configuration', () => {
      expect(AI_CONFIG.apiUrl).toBe('https://openrouter.ai/api/v1/chat/completions');
      expect(AI_CONFIG.model).toBe('google/gemini-3-flash-preview');
      expect(AI_CONFIG.timeout).toBe(10000);
    });
  });

  // ============================================
  // Prompt Building Tests
  // ============================================
  describe('buildValidationPrompt', () => {
    it('should build prompt with all issue fields', () => {
      const prompt = buildValidationPrompt(mockIssueData, mockCategory);

      expect(prompt).toContain('Category: Software Bug (software)');
      expect(prompt).toContain('Required fields for this category: summary, stepsToReproduce');
      expect(prompt).toContain(`Title: ${mockIssueData.title}`);
      expect(prompt).toContain(`Summary: ${mockIssueData.description.summary}`);
      expect(prompt).toContain(`Impact: ${mockIssueData.description.impact}`);
      expect(prompt).toContain(`Environment: ${mockIssueData.description.environment}`);
      expect(prompt).toContain(`Expected Behavior: ${mockIssueData.description.expectedBehavior}`);
      expect(prompt).toContain(`Actual Behavior: ${mockIssueData.description.actualBehavior}`);
      expect(prompt).toContain(`Steps to Reproduce: ${mockIssueData.description.stepsToReproduce}`);
    });

    it('should include custom AI prompt when provided', () => {
      const prompt = buildValidationPrompt(mockIssueData, mockCategory);

      expect(prompt).toContain('Additional validation instructions:');
      expect(prompt).toContain(mockCategory.aiPrompt);
    });

    it('should not include custom AI prompt section when aiPrompt is null', () => {
      const prompt = buildValidationPrompt(mockIssueData, mockCategoryNoCustomPrompt);

      expect(prompt).not.toContain('Additional validation instructions:');
    });

    it('should handle missing optional fields in description', () => {
      const minimalIssue = {
        title: 'Test Issue',
        description: {
          summary: 'Minimal issue',
        },
      };

      const prompt = buildValidationPrompt(minimalIssue, mockCategory);

      expect(prompt).toContain('Summary: Minimal issue');
      expect(prompt).toContain('Impact: (not provided)');
      expect(prompt).toContain('Environment: (not provided)');
      expect(prompt).toContain('Expected Behavior: (not provided)');
      expect(prompt).toContain('Actual Behavior: (not provided)');
      expect(prompt).toContain('Steps to Reproduce: (not provided)');
    });

    it('should handle empty required fields array', () => {
      const categoryNoRequiredFields = {
        ...mockCategory,
        requiredFields: [],
      };

      const prompt = buildValidationPrompt(mockIssueData, categoryNoRequiredFields);

      expect(prompt).toContain('Required fields for this category: summary (required by default)');
    });

    it('should include JSON response format in prompt', () => {
      const prompt = buildValidationPrompt(mockIssueData, mockCategory);

      expect(prompt).toContain('"pass": boolean');
      expect(prompt).toContain('"missingItems"');
      expect(prompt).toContain('"feedback"');
      expect(prompt).toContain('"followUpQuestions"');
    });
  });

  describe('buildDuplicateDetectionPrompt', () => {
    it('should build prompt with new issue and existing issues', () => {
      const prompt = buildDuplicateDetectionPrompt(mockIssueData, mockExistingIssues);

      expect(prompt).toContain(`Title: ${mockIssueData.title}`);
      expect(prompt).toContain(`Summary: ${mockIssueData.description.summary}`);
      expect(prompt).toContain('ISS-2026-0001');
      expect(prompt).toContain('Login button not working');
      expect(prompt).toContain('ISS-2026-0002');
      expect(prompt).toContain('Dashboard loading slow');
    });

    it('should include similarity scoring instructions', () => {
      const prompt = buildDuplicateDetectionPrompt(mockIssueData, mockExistingIssues);

      expect(prompt).toContain('similarity score (0-100)');
      expect(prompt).toContain('similarity >= 50');
      expect(prompt).toContain('Maximum 5 potential duplicates');
    });

    it('should handle empty summary in new issue', () => {
      const issueNoSummary = {
        title: 'Test Issue',
        description: { summary: '' },
      };

      const prompt = buildDuplicateDetectionPrompt(issueNoSummary, mockExistingIssues);

      expect(prompt).toContain('Summary: (not provided)');
    });
  });

  // ============================================
  // validateIssue Tests
  // ============================================
  describe('validateIssue', () => {
    it('should return proper structure when AI passes validation', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              pass: true,
              missingItems: [],
              feedback: [],
              followUpQuestions: [],
            }),
          },
        }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await validateIssue(mockIssueData, mockCategory);

      expect(result.pass).toBe(true);
      expect(result.missingItems).toEqual([]);
      expect(result.feedback).toEqual([]);
      expect(result.followUpQuestions).toEqual([]);
      expect(result.aiUnavailable).toBeUndefined();
    });

    it('should return proper structure when AI fails validation', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              pass: false,
              missingItems: ['stepsToReproduce'],
              feedback: [
                {
                  field: 'title',
                  issue: 'Too vague',
                  suggestion: 'Include the specific component affected',
                },
              ],
              followUpQuestions: ['What error message did you see?'],
            }),
          },
        }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await validateIssue(mockIssueData, mockCategory);

      expect(result.pass).toBe(false);
      expect(result.missingItems).toContain('stepsToReproduce');
      expect(result.feedback).toHaveLength(1);
      expect(result.feedback[0].field).toBe('title');
      expect(result.followUpQuestions).toContain('What error message did you see?');
    });

    it('should return aiUnavailable: true on timeout', async () => {
      // Simulate timeout error
      mockFetch.mockRejectedValueOnce(Object.assign(new Error('Timeout'), { name: 'TimeoutError' }));

      const result = await validateIssue(mockIssueData, mockCategory);

      expect(result.aiUnavailable).toBe(true);
      expect(result.pass).toBe(false);
      expect(result.missingItems).toEqual([]);
      expect(result.feedback).toEqual([]);
      expect(result.followUpQuestions).toEqual([]);
    });

    it('should return aiUnavailable: true on AbortError', async () => {
      mockFetch.mockRejectedValueOnce(Object.assign(new Error('Aborted'), { name: 'AbortError' }));

      const result = await validateIssue(mockIssueData, mockCategory);

      expect(result.aiUnavailable).toBe(true);
    });

    it('should return aiUnavailable: true on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await validateIssue(mockIssueData, mockCategory);

      expect(result.aiUnavailable).toBe(true);
    });

    it('should return aiUnavailable: true on HTTP error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await validateIssue(mockIssueData, mockCategory);

      expect(result.aiUnavailable).toBe(true);
    });

    it('should return aiUnavailable: true when API key is not set', async () => {
      vi.stubEnv('OPENROUTER_API_KEY', '');

      const result = await validateIssue(mockIssueData, mockCategory);

      expect(result.aiUnavailable).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return aiUnavailable: true on invalid JSON response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'not valid json',
          },
        }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await validateIssue(mockIssueData, mockCategory);

      expect(result.aiUnavailable).toBe(true);
    });

    it('should return aiUnavailable: true on missing pass field', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              missingItems: [],
              feedback: [],
              followUpQuestions: [],
            }),
          },
        }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await validateIssue(mockIssueData, mockCategory);

      expect(result.aiUnavailable).toBe(true);
    });

    it('should return aiUnavailable: true when response structure is invalid', async () => {
      const mockResponse = {
        choices: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await validateIssue(mockIssueData, mockCategory);

      expect(result.aiUnavailable).toBe(true);
    });

    it('should call OpenRouter API with correct headers', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              pass: true,
              missingItems: [],
              feedback: [],
              followUpQuestions: [],
            }),
          },
        }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await validateIssue(mockIssueData, mockCategory);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];

      expect(url).toBe(AI_CONFIG.apiUrl);
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toBe('Bearer test-api-key');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['HTTP-Referer']).toBe('http://localhost:33021');
      expect(options.headers['X-Title']).toBe('Herbal Medicine ERP Issue Tracker');
    });

    it('should use correct model in API request', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              pass: true,
              missingItems: [],
              feedback: [],
              followUpQuestions: [],
            }),
          },
        }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await validateIssue(mockIssueData, mockCategory);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);

      expect(body.model).toBe(AI_CONFIG.model);
      expect(body.response_format).toEqual({ type: 'json_object' });
    });

    it('should filter out invalid feedback items', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              pass: false,
              missingItems: ['summary'],
              feedback: [
                { field: 'title', issue: 'Too vague', suggestion: 'Be specific' },
                { field: 'summary' }, // Missing issue and suggestion
                { issue: 'Missing field', suggestion: 'Add field' }, // Missing field
                'invalid string',
                null,
              ],
              followUpQuestions: ['Question 1', 123, null, 'Question 2'],
            }),
          },
        }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await validateIssue(mockIssueData, mockCategory);

      expect(result.feedback).toHaveLength(1);
      expect(result.feedback[0].field).toBe('title');
      expect(result.followUpQuestions).toHaveLength(2);
      expect(result.followUpQuestions).toContain('Question 1');
      expect(result.followUpQuestions).toContain('Question 2');
    });
  });

  // ============================================
  // checkDuplicates Tests
  // ============================================
  describe('checkDuplicates', () => {
    it('should return proper structure with potential duplicates', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              potentialDuplicates: [
                {
                  issueId: 101,
                  similarity: 85,
                  reason: 'Both describe login issues',
                },
              ],
            }),
          },
        }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await checkDuplicates(mockIssueData, mockExistingIssues);

      expect(result.potentialDuplicates).toHaveLength(1);
      expect(result.potentialDuplicates[0].issueId).toBe(101);
      expect(result.potentialDuplicates[0].issueNumber).toBe('ISS-2026-0001');
      expect(result.potentialDuplicates[0].title).toBe('Login button not working');
      expect(result.potentialDuplicates[0].similarity).toBe(85);
      expect(result.potentialDuplicates[0].reason).toBe('Both describe login issues');
      expect(result.aiUnavailable).toBeUndefined();
    });

    it('should return empty array when no duplicates found', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              potentialDuplicates: [],
            }),
          },
        }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await checkDuplicates(mockIssueData, mockExistingIssues);

      expect(result.potentialDuplicates).toEqual([]);
      expect(result.aiUnavailable).toBeUndefined();
    });

    it('should return empty array when no existing issues to compare', async () => {
      const result = await checkDuplicates(mockIssueData, []);

      expect(result.potentialDuplicates).toEqual([]);
      expect(result.aiUnavailable).toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return aiUnavailable: true on timeout', async () => {
      mockFetch.mockRejectedValueOnce(Object.assign(new Error('Timeout'), { name: 'TimeoutError' }));

      const result = await checkDuplicates(mockIssueData, mockExistingIssues);

      expect(result.aiUnavailable).toBe(true);
      expect(result.potentialDuplicates).toEqual([]);
    });

    it('should return aiUnavailable: true on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await checkDuplicates(mockIssueData, mockExistingIssues);

      expect(result.aiUnavailable).toBe(true);
    });

    it('should return aiUnavailable: true on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      const result = await checkDuplicates(mockIssueData, mockExistingIssues);

      expect(result.aiUnavailable).toBe(true);
    });

    it('should return aiUnavailable: true when API key is not set', async () => {
      vi.stubEnv('OPENROUTER_API_KEY', '');

      const result = await checkDuplicates(mockIssueData, mockExistingIssues);

      expect(result.aiUnavailable).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return aiUnavailable: true on invalid JSON response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'not valid json',
          },
        }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await checkDuplicates(mockIssueData, mockExistingIssues);

      expect(result.aiUnavailable).toBe(true);
    });

    it('should clamp similarity scores to 0-100 range', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              potentialDuplicates: [
                { issueId: 101, similarity: 150, reason: 'Very similar' },
                { issueId: 102, similarity: -20, reason: 'Not similar' },
              ],
            }),
          },
        }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await checkDuplicates(mockIssueData, mockExistingIssues);

      expect(result.potentialDuplicates[0].similarity).toBe(100);
      expect(result.potentialDuplicates[1].similarity).toBe(0);
    });

    it('should filter out invalid duplicate entries', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              potentialDuplicates: [
                { issueId: 101, similarity: 80, reason: 'Valid entry' },
                { issueId: 'not-a-number', similarity: 70, reason: 'Invalid issueId' },
                { issueId: 102, similarity: 'high', reason: 'Invalid similarity' },
                { issueId: 103, similarity: 60 }, // Missing reason
                null,
                'invalid',
              ],
            }),
          },
        }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await checkDuplicates(mockIssueData, mockExistingIssues);

      expect(result.potentialDuplicates).toHaveLength(1);
      expect(result.potentialDuplicates[0].issueId).toBe(101);
    });

    it('should handle unknown issue IDs gracefully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              potentialDuplicates: [
                { issueId: 999, similarity: 75, reason: 'Unknown issue' },
              ],
            }),
          },
        }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await checkDuplicates(mockIssueData, mockExistingIssues);

      expect(result.potentialDuplicates).toHaveLength(1);
      expect(result.potentialDuplicates[0].issueId).toBe(999);
      expect(result.potentialDuplicates[0].issueNumber).toBe('ISS-????-????');
      expect(result.potentialDuplicates[0].title).toBe('Unknown');
    });
  });

  // ============================================
  // Utility Function Tests
  // ============================================
  describe('Utility Functions', () => {
    describe('getUnavailableValidationResult', () => {
      it('should return correct unavailable structure', () => {
        const result = getUnavailableValidationResult();

        expect(result.pass).toBe(false);
        expect(result.missingItems).toEqual([]);
        expect(result.feedback).toEqual([]);
        expect(result.followUpQuestions).toEqual([]);
        expect(result.aiUnavailable).toBe(true);
      });
    });

    describe('getUnavailableDuplicateResult', () => {
      it('should return correct unavailable structure', () => {
        const result = getUnavailableDuplicateResult();

        expect(result.potentialDuplicates).toEqual([]);
        expect(result.aiUnavailable).toBe(true);
      });
    });
  });

  // ============================================
  // Type Safety Tests
  // ============================================
  describe('Type Safety', () => {
    it('should match AIValidationResult interface', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              pass: true,
              missingItems: ['field1'],
              feedback: [{ field: 'f', issue: 'i', suggestion: 's' }],
              followUpQuestions: ['q1'],
            }),
          },
        }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result: AIValidationResult = await validateIssue(mockIssueData, mockCategory);

      expect(typeof result.pass).toBe('boolean');
      expect(Array.isArray(result.missingItems)).toBe(true);
      expect(Array.isArray(result.feedback)).toBe(true);
      expect(Array.isArray(result.followUpQuestions)).toBe(true);
    });

    it('should match AIDuplicateResult interface', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              potentialDuplicates: [{
                issueId: 1,
                similarity: 80,
                reason: 'test',
              }],
            }),
          },
        }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result: AIDuplicateResult = await checkDuplicates(mockIssueData, mockExistingIssues);

      expect(Array.isArray(result.potentialDuplicates)).toBe(true);
      if (result.potentialDuplicates.length > 0) {
        const dup = result.potentialDuplicates[0];
        expect(typeof dup.issueId).toBe('number');
        expect(typeof dup.issueNumber).toBe('string');
        expect(typeof dup.title).toBe('string');
        expect(typeof dup.similarity).toBe('number');
        expect(typeof dup.reason).toBe('string');
      }
    });
  });
});
