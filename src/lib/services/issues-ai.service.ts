/**
 * Issue Tracker AI Validation Service
 *
 * Provides AI-powered issue validation and duplicate detection using OpenRouter API.
 * Part of the Issue Tracker module (Task 5).
 */

import type {
  IssueDescription,
  IssueCategory,
  AIValidationResult,
  AIDuplicateResult,
} from '@/types/issues';

// ============================================
// Configuration
// ============================================

export const AI_CONFIG = {
  apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'google/gemini-3-flash-preview',
  timeout: 10000, // 10 seconds
};

// ============================================
// Types
// ============================================

export interface IssueValidationInput {
  title: string;
  description: IssueDescription;
}

export interface ExistingIssueInfo {
  id: number;
  issueNumber: string;
  title: string;
  description: IssueDescription;
}

// ============================================
// Prompt Building Functions
// ============================================

/**
 * Build the validation prompt for AI issue validation
 */
export function buildValidationPrompt(
  issueData: IssueValidationInput,
  category: IssueCategory
): string {
  const desc = issueData.description;
  const requiredFieldsList = category.requiredFields.length > 0
    ? category.requiredFields.join(', ')
    : 'summary (required by default)';

  const customPrompt = category.aiPrompt ? `\n\nAdditional validation instructions:\n${category.aiPrompt}` : '';

  return `You are an issue quality validator. Evaluate this issue submission:

Category: ${category.name} (${category.type})
Required fields for this category: ${requiredFieldsList}

Issue Data:
- Title: ${issueData.title}
- Summary: ${desc.summary || '(not provided)'}
- Impact: ${desc.impact || '(not provided)'}
- Environment: ${desc.environment || '(not provided)'}
- Expected Behavior: ${desc.expectedBehavior || '(not provided)'}
- Actual Behavior: ${desc.actualBehavior || '(not provided)'}
- Steps to Reproduce: ${desc.stepsToReproduce || '(not provided)'}
${customPrompt}

Respond in JSON:
{
  "pass": boolean,
  "missingItems": ["field1", "field2"],
  "feedback": [
    { "field": "title", "issue": "Too vague", "suggestion": "Include the specific component or area affected" }
  ],
  "followUpQuestions": ["What error message did you see?", "..."]
}`;
}

/**
 * Build the duplicate detection prompt
 */
export function buildDuplicateDetectionPrompt(
  newIssue: IssueValidationInput,
  existingIssues: ExistingIssueInfo[]
): string {
  const existingList = existingIssues.map((issue) => ({
    id: issue.id,
    issueNumber: issue.issueNumber,
    title: issue.title,
    summary: issue.description.summary || '(no summary)',
  }));

  return `Compare this new issue against existing open issues.
Return potential duplicates with similarity score (0-100).

New Issue:
- Title: ${newIssue.title}
- Summary: ${newIssue.description.summary || '(not provided)'}

Existing Issues:
${JSON.stringify(existingList, null, 2)}

Respond in JSON:
{
  "potentialDuplicates": [
    { "issueId": 123, "issueNumber": "ISS-2026-0001", "title": "Original issue title", "similarity": 85, "reason": "Both describe login timeout" }
  ]
}

Rules:
- Only include issues with similarity >= 50
- Maximum 5 potential duplicates
- If no duplicates found, return empty array
- Be careful to distinguish between similar-sounding but functionally different issues`;
}

// ============================================
// API Call Functions
// ============================================

/**
 * Make a call to the OpenRouter API
 * Returns null if the API call fails (timeout, network error, etc.)
 */
async function callOpenRouterAPI(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.warn('OPENROUTER_API_KEY not configured');
    return null;
  }

  try {
    const response = await fetch(AI_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'Herbal Medicine ERP Issue Tracker',
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(AI_CONFIG.timeout),
    });

    if (!response.ok) {
      console.error(`OpenRouter API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    // Extract the message content from the API response
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      console.error('Invalid OpenRouter API response structure');
      return null;
    }

    return content;
  } catch (error) {
    if (error instanceof Error) {
      // Handle timeout specifically
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        console.warn('OpenRouter API call timed out');
      } else {
        console.error('OpenRouter API call failed:', error.message);
      }
    }
    return null;
  }
}

/**
 * Parse and validate AI validation response
 */
function parseValidationResponse(content: string): AIValidationResult | null {
  try {
    const parsed = JSON.parse(content);

    // Validate structure
    if (typeof parsed.pass !== 'boolean') {
      console.error('Invalid AI response: missing or invalid "pass" field');
      return null;
    }

    return {
      pass: parsed.pass,
      missingItems: Array.isArray(parsed.missingItems) ? parsed.missingItems : [],
      feedback: Array.isArray(parsed.feedback)
        ? parsed.feedback.filter(
            (f: unknown): f is { field: string; issue: string; suggestion: string } =>
              typeof f === 'object' &&
              f !== null &&
              typeof (f as Record<string, unknown>).field === 'string' &&
              typeof (f as Record<string, unknown>).issue === 'string' &&
              typeof (f as Record<string, unknown>).suggestion === 'string'
          )
        : [],
      followUpQuestions: Array.isArray(parsed.followUpQuestions)
        ? parsed.followUpQuestions.filter((q: unknown) => typeof q === 'string')
        : [],
    };
  } catch (error) {
    console.error('Failed to parse AI validation response:', error);
    return null;
  }
}

/**
 * Parse and validate AI duplicate detection response
 */
function parseDuplicateResponse(
  content: string,
  existingIssues: ExistingIssueInfo[]
): AIDuplicateResult | null {
  try {
    const parsed = JSON.parse(content);

    // Create a lookup map for existing issues
    const issueMap = new Map(
      existingIssues.map((issue) => [issue.id, issue])
    );

    const potentialDuplicates = Array.isArray(parsed.potentialDuplicates)
      ? parsed.potentialDuplicates
          .filter((d: unknown): d is { issueId: number; similarity: number; reason: string } => {
            if (typeof d !== 'object' || d === null) return false;
            const obj = d as Record<string, unknown>;
            return (
              typeof obj.issueId === 'number' &&
              typeof obj.similarity === 'number' &&
              typeof obj.reason === 'string'
            );
          })
          .map((d: { issueId: number; similarity: number; reason: string }) => {
            const existingIssue = issueMap.get(d.issueId);
            return {
              issueId: d.issueId,
              issueNumber: existingIssue?.issueNumber || `ISS-????-????`,
              title: existingIssue?.title || 'Unknown',
              similarity: Math.max(0, Math.min(100, d.similarity)), // Clamp to 0-100
              reason: d.reason,
            };
          })
      : [];

    return {
      potentialDuplicates,
    };
  } catch (error) {
    console.error('Failed to parse AI duplicate response:', error);
    return null;
  }
}

// ============================================
// Public API Functions
// ============================================

/**
 * Validate an issue submission using AI
 *
 * Returns a validation result with pass/fail status, missing items,
 * feedback, and follow-up questions.
 *
 * If the AI is unavailable (timeout, error, no API key), returns
 * { aiUnavailable: true } with empty fields.
 *
 * @param issueData The issue data to validate
 * @param category The category with validation rules
 */
export async function validateIssue(
  issueData: IssueValidationInput,
  category: IssueCategory
): Promise<AIValidationResult> {
  // Build the prompt
  const prompt = buildValidationPrompt(issueData, category);

  // Call the API
  const response = await callOpenRouterAPI(prompt);

  // If API failed, return aiUnavailable
  if (response === null) {
    return {
      pass: false,
      missingItems: [],
      feedback: [],
      followUpQuestions: [],
      aiUnavailable: true,
    };
  }

  // Parse the response
  const result = parseValidationResponse(response);

  // If parsing failed, return aiUnavailable
  if (result === null) {
    return {
      pass: false,
      missingItems: [],
      feedback: [],
      followUpQuestions: [],
      aiUnavailable: true,
    };
  }

  return result;
}

/**
 * Check for potential duplicate issues using AI
 *
 * Compares a new issue against a list of existing open issues and
 * returns potential duplicates with similarity scores.
 *
 * If the AI is unavailable (timeout, error, no API key), returns
 * { aiUnavailable: true } with empty duplicates array.
 *
 * @param newIssue The new issue data to check
 * @param existingIssues List of existing open issues to compare against
 */
export async function checkDuplicates(
  newIssue: IssueValidationInput,
  existingIssues: ExistingIssueInfo[]
): Promise<AIDuplicateResult> {
  // If no existing issues, no duplicates possible
  if (existingIssues.length === 0) {
    return {
      potentialDuplicates: [],
    };
  }

  // Build the prompt
  const prompt = buildDuplicateDetectionPrompt(newIssue, existingIssues);

  // Call the API
  const response = await callOpenRouterAPI(prompt);

  // If API failed, return aiUnavailable
  if (response === null) {
    return {
      potentialDuplicates: [],
      aiUnavailable: true,
    };
  }

  // Parse the response
  const result = parseDuplicateResponse(response, existingIssues);

  // If parsing failed, return aiUnavailable
  if (result === null) {
    return {
      potentialDuplicates: [],
      aiUnavailable: true,
    };
  }

  return result;
}

/**
 * Get default unavailable result for validation
 * Utility function for API routes when AI validation should be skipped
 */
export function getUnavailableValidationResult(): AIValidationResult {
  return {
    pass: false,
    missingItems: [],
    feedback: [],
    followUpQuestions: [],
    aiUnavailable: true,
  };
}

/**
 * Get default unavailable result for duplicate check
 * Utility function for API routes when duplicate check should be skipped
 */
export function getUnavailableDuplicateResult(): AIDuplicateResult {
  return {
    potentialDuplicates: [],
    aiUnavailable: true,
  };
}
