// Issue Tracker Validation Schemas
import { z } from 'zod';

// Enums
export const issueSeveritySchema = z.enum(['critical', 'major', 'minor']);
export const issuePrioritySchema = z.enum(['immediate', 'urgent', 'scheduled', 'backlog']);
export const issueStatusSchema = z.enum(['draft', 'submitted', 'triaged', 'in_progress', 'resolved', 'verified', 'closed']);
export const issueCategoryTypeSchema = z.enum(['software', 'operational']);

// Structured description schema
export const issueDescriptionSchema = z.object({
  summary: z.string().min(10, 'Summary must be at least 10 characters').max(2000),
  impact: z.string().max(1000).optional(),
  environment: z.string().max(500).optional(),
  expectedBehavior: z.string().max(1000).optional(),
  actualBehavior: z.string().max(1000).optional(),
  stepsToReproduce: z.string().max(2000).optional(),
});

// Issue Create Schema
export const issueCreateSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(255),
  description: issueDescriptionSchema,
  categoryId: z.number().int().positive(),
  severity: issueSeveritySchema,
  tagIds: z.array(z.number().int().positive()).optional(),
});

// Issue Update Schema
export const issueUpdateSchema = z.object({
  title: z.string().min(5).max(255).optional(),
  description: issueDescriptionSchema.optional(),
  categoryId: z.number().int().positive().optional(),
  severity: issueSeveritySchema.optional(),
  priority: issuePrioritySchema.optional().nullable(),
  status: issueStatusSchema.optional(),
  assigneeId: z.number().int().positive().optional().nullable(),
  tagIds: z.array(z.number().int().positive()).optional(),
});

// Category Create Schema
export const issueCategoryCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  type: issueCategoryTypeSchema,
  requiredFields: z.array(z.string()).optional(),
  aiPrompt: z.string().max(2000).optional(),
});

// Category Update Schema
export const issueCategoryUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  type: issueCategoryTypeSchema.optional(),
  requiredFields: z.array(z.string()).optional(),
  aiPrompt: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
});

// Comment Create Schema
export const issueCommentCreateSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(10000),
});

// Comment Update Schema
export const issueCommentUpdateSchema = z.object({
  content: z.string().min(1).max(10000),
});

// Tag Create Schema
export const issueTagCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color'),
});

// Status change schema
export const issueStatusChangeSchema = z.object({
  status: issueStatusSchema,
  comment: z.string().max(500).optional(),
});

// Assign schema
export const issueAssignSchema = z.object({
  assigneeId: z.number().int().positive().nullable(),
});

// Merge schema
export const issueMergeSchema = z.object({
  targetIssueId: z.number().int().positive(),
});

// Type exports
export type IssueCreateInput = z.infer<typeof issueCreateSchema>;
export type IssueUpdateInput = z.infer<typeof issueUpdateSchema>;
export type IssueCategoryCreateInput = z.infer<typeof issueCategoryCreateSchema>;
export type IssueCategoryUpdateInput = z.infer<typeof issueCategoryUpdateSchema>;
export type IssueCommentCreateInput = z.infer<typeof issueCommentCreateSchema>;
export type IssueCommentUpdateInput = z.infer<typeof issueCommentUpdateSchema>;
export type IssueTagCreateInput = z.infer<typeof issueTagCreateSchema>;
export type IssueStatusChangeInput = z.infer<typeof issueStatusChangeSchema>;
export type IssueAssignInput = z.infer<typeof issueAssignSchema>;
export type IssueMergeInput = z.infer<typeof issueMergeSchema>;
