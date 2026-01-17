'use client';

/**
 * Comment Editor Component
 * Feature: Issue Tracker
 *
 * Allows users to add, edit, and delete comments on issues.
 * Supports @mentions for user references.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { IssueComment } from '@/types/issues';

// ============================================
// Types
// ============================================

export interface CommentEditorProps {
  issueId: number;
  comment?: IssueComment | null;
  onSave?: (comment: IssueComment) => void;
  onCancel?: () => void;
  onDelete?: (commentId: number) => void;
  placeholder?: string;
  className?: string;
}

interface UserSuggestion {
  id: number;
  name: string;
  email: string;
}

// ============================================
// API Functions
// ============================================

async function createComment(issueId: number, content: string): Promise<IssueComment> {
  const response = await fetch(`/api/issues/${issueId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to create comment');
  }
  return result.data;
}

async function updateComment(
  issueId: number,
  commentId: number,
  content: string
): Promise<IssueComment> {
  const response = await fetch(`/api/issues/${issueId}/comments/${commentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to update comment');
  }
  return result.data;
}

async function deleteComment(issueId: number, commentId: number): Promise<void> {
  const response = await fetch(`/api/issues/${issueId}/comments/${commentId}`, {
    method: 'DELETE',
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete comment');
  }
}

async function searchUsers(query: string): Promise<UserSuggestion[]> {
  if (query.length < 2) return [];
  const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&limit=5`);
  const result = await response.json();
  if (!result.success) return [];
  return result.data || [];
}

// ============================================
// Component
// ============================================

export function CommentEditor({
  issueId,
  comment,
  onSave,
  onCancel,
  onDelete,
  placeholder = 'Add a comment... Use @username to mention someone',
  className = '',
}: CommentEditorProps) {
  const isEditing = !!comment;
  const queryClient = useQueryClient();
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const [content, setContent] = useState(comment?.content || '');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: () => createComment(issueId, content),
    onSuccess: (newComment) => {
      queryClient.invalidateQueries({ queryKey: ['issue-comments', issueId] });
      queryClient.invalidateQueries({ queryKey: ['issue-timeline', issueId] });
      setContent('');
      onSave?.(newComment);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: () => updateComment(issueId, comment!.id, content),
    onSuccess: (updatedComment) => {
      queryClient.invalidateQueries({ queryKey: ['issue-comments', issueId] });
      queryClient.invalidateQueries({ queryKey: ['issue-timeline', issueId] });
      onSave?.(updatedComment);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteComment(issueId, comment!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue-comments', issueId] });
      queryClient.invalidateQueries({ queryKey: ['issue-timeline', issueId] });
      onDelete?.(comment!.id);
    },
  });

  // Handle content change and detect @mentions
  const handleContentChange = useCallback(async (value: string | undefined) => {
    const newContent = value || '';
    setContent(newContent);

    // Check for @mention pattern
    const cursorPos = textAreaRef.current?.selectionStart || 0;
    const textBeforeCursor = newContent.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      setShowMentions(true);
      setSelectedIndex(0);

      // Fetch user suggestions
      if (query.length >= 2) {
        const users = await searchUsers(query);
        setSuggestions(users);
      } else {
        setSuggestions([]);
      }
    } else {
      setShowMentions(false);
      setSuggestions([]);
    }
  }, []);

  // Insert mention
  const insertMention = useCallback((user: UserSuggestion) => {
    const cursorPos = textAreaRef.current?.selectionStart || 0;
    const textBeforeCursor = content.slice(0, cursorPos);
    const textAfterCursor = content.slice(cursorPos);

    // Find the start of the @mention
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const mentionStart = cursorPos - mentionMatch[0].length;
      const newContent =
        content.slice(0, mentionStart) +
        `@${user.name} ` +
        textAfterCursor;
      setContent(newContent);
    }

    setShowMentions(false);
    setSuggestions([]);
    textAreaRef.current?.focus();
  }, [content]);

  // Handle keyboard navigation in mention suggestions
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showMentions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
        e.preventDefault();
        insertMention(suggestions[selectedIndex]);
        break;
      case 'Escape':
        setShowMentions(false);
        break;
    }
  }, [showMentions, suggestions, selectedIndex, insertMention]);

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!content.trim()) return;

    if (isEditing) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  }, [content, isEditing, createMutation, updateMutation]);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (!comment) return;
    setIsDeleting(true);
  }, [comment]);

  const confirmDelete = useCallback(() => {
    deleteMutation.mutate();
  }, [deleteMutation]);

  const cancelDelete = useCallback(() => {
    setIsDeleting(false);
  }, []);

  // Calculate mention dropdown position
  useEffect(() => {
    if (showMentions && textAreaRef.current) {
      // Simple positioning - place below the textarea
      const rect = textAreaRef.current.getBoundingClientRect();
      setMentionPosition({
        top: rect.height + 4,
        left: 0,
      });
    }
  }, [showMentions]);

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error || deleteMutation.error;

  // Delete confirmation dialog
  if (isDeleting) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <p className="text-red-700 mb-3">
          Are you sure you want to delete this comment? This action cannot be undone.
        </p>
        <div className="flex gap-2">
          <DxButton
            text="Cancel"
            type="normal"
            stylingMode="outlined"
            onClick={cancelDelete}
            disabled={deleteMutation.isPending}
            data-testid="comment-delete-cancel"
          />
          <DxButton
            text={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            type="danger"
            stylingMode="contained"
            onClick={confirmDelete}
            disabled={deleteMutation.isPending}
            data-testid="comment-delete-confirm"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} data-testid="comment-editor">
      {/* Text Area */}
      <div className="relative" onKeyDown={handleKeyDown}>
        <DxTextArea
          value={content}
          onValueChange={handleContentChange}
          placeholder={placeholder}
          height={isEditing ? 100 : 80}
          data-testid="comment-content"
        />

        {/* Mention Suggestions Dropdown */}
        {showMentions && suggestions.length > 0 && (
          <div
            className="absolute z-10 w-64 bg-white border border-gray-200 rounded-lg shadow-lg"
            style={{ top: mentionPosition.top, left: mentionPosition.left }}
          >
            {suggestions.map((user, index) => (
              <button
                key={user.id}
                className={`w-full px-3 py-2 text-left hover:bg-gray-100 ${
                  index === selectedIndex ? 'bg-blue-50' : ''
                } ${index === 0 ? 'rounded-t-lg' : ''} ${
                  index === suggestions.length - 1 ? 'rounded-b-lg' : ''
                }`}
                onClick={() => insertMention(user)}
              >
                <div className="font-medium text-sm">{user.name}</div>
                <div className="text-xs text-gray-500">{user.email}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error.message}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center mt-3">
        <div className="text-xs text-gray-400">
          Use @username to mention someone
        </div>

        <div className="flex gap-2">
          {isEditing && onDelete && (
            <DxButton
              text="Delete"
              type="danger"
              stylingMode="text"
              onClick={handleDelete}
              disabled={isSaving}
              data-testid="comment-delete-btn"
            />
          )}

          {onCancel && (
            <DxButton
              text="Cancel"
              type="normal"
              stylingMode="text"
              onClick={onCancel}
              disabled={isSaving}
              data-testid="comment-cancel-btn"
            />
          )}

          <DxButton
            text={isSaving ? 'Saving...' : (isEditing ? 'Update' : 'Comment')}
            type="default"
            stylingMode="contained"
            onClick={handleSubmit}
            disabled={!content.trim() || isSaving}
            data-testid="comment-submit-btn"
          />
        </div>
      </div>
    </div>
  );
}

export default CommentEditor;
