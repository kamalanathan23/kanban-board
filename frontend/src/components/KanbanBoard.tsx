import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { TaskCard } from './TaskCard';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Plus, Filter, Search, Calendar, X, Download } from 'lucide-react';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { DescriptionEditor } from './DescriptionEditor';
import { toast } from 'sonner';
import { io, type Socket } from 'socket.io-client';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar as CalendarPicker } from './ui/calendar';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logout, selectAuthToken, selectAuthUser } from '../store/authSlice';
import { PERMISSIONS } from '../constants/permissions';
import {
  canAccessAdminArea,
  canEditTaskBody,
  canMoveTaskOnBoard,
  canPersistBoard,
  hasPermission,
  taskVisibleForUser,
} from '../auth/rbac';
import { getSocketOrigin } from '../config/api';
import {
  API_BASE_URL,
  addColumn,
  addTaskComment as addTaskCommentAction,
  clearKanbanError,
  createTask as createTaskAction,
  deleteColumn,
  fetchBoard,
  moveTask as moveTaskAction,
  renameColumn,
  reorderColumns as reorderColumnsAction,
  selectBoardColumns,
  selectKanbanError,
  selectKanbanHydrated,
  selectKanbanLoading,
  selectKanbanSaving,
  saveBoard,
  setTaskAttachments,
  updateTask as updateTaskAction,
} from '../store/kanbanSlice';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  assignee: string;
  createdBy?: string;
  dueDate?: string;
  tags: string[];
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    size: number;
    mimeType: string;
    uploadedAt: string;
  }>;
  comments?: TaskComment[];
}

export interface Column {
  id: string;
  title: string;
  tasks: Task[];
  color: string;
}

type TaskDraft = {
  title: string;
  description: string;
  priority: Task['priority'];
  assignee: string;
  dueDate?: string;
  tags: string[];
};

interface TaskComment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

function formatFileSize(bytes: unknown): string {
  const n = typeof bytes === 'number' ? bytes : Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

const ASSIGNEE_UNASSIGNED_ID = '__unassigned__';
const ASSIGNEE_LEGACY_PREFIX = 'legacy:';

type AssigneeUserRow = { id: string; name: string; email: string };

function resolveAssigneeSelectId(
  assigneeRaw: string,
  users: AssigneeUserRow[],
): string {
  const a = assigneeRaw.trim();
  if (!a || a.toLowerCase() === 'unassigned') return ASSIGNEE_UNASSIGNED_ID;
  const lower = a.toLowerCase();
  const match = users.find(
    (u) =>
      u.name.trim().toLowerCase() === lower ||
      u.email.toLowerCase() === lower,
  );
  if (match) return match.id;
  return `${ASSIGNEE_LEGACY_PREFIX}${encodeURIComponent(a)}`;
}

function dedupeAssigneeUsers(users: AssigneeUserRow[]): AssigneeUserRow[] {
  const byId = new Map<string, AssigneeUserRow>();
  const byEmail = new Map<string, AssigneeUserRow>();
  for (const u of users) {
    if (!u?.id?.trim()) continue;
    if (byId.has(u.id)) continue;
    const em = u.email?.trim().toLowerCase() ?? '';
    if (em && byEmail.has(em)) continue;
    if (em) byEmail.set(em, u);
    byId.set(u.id, u);
  }
  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

function legacyAssigneeRowNeeded(
  selectedAssigneeId: string,
  assigneeUsers: AssigneeUserRow[],
): boolean {
  if (!selectedAssigneeId.startsWith(ASSIGNEE_LEGACY_PREFIX)) return false;
  let raw: string;
  try {
    raw = decodeURIComponent(
      selectedAssigneeId.slice(ASSIGNEE_LEGACY_PREFIX.length),
    ).trim();
  } catch {
    return true;
  }
  if (!raw) return false;
  const lower = raw.toLowerCase();
  const hasMatch = assigneeUsers.some(
    (u) =>
      u.name.trim().toLowerCase() === lower ||
      u.email.toLowerCase() === lower,
  );
  return !hasMatch;
}

function assigneeStringFromSelection(
  authToken: string | null,
  selectedAssigneeId: string,
  assigneeUsers: AssigneeUserRow[],
  assigneeTextFallback: string,
): string {
  if (!authToken) {
    return assigneeTextFallback.trim() || 'Unassigned';
  }
  if (selectedAssigneeId === ASSIGNEE_UNASSIGNED_ID) return 'Unassigned';
  if (selectedAssigneeId.startsWith(ASSIGNEE_LEGACY_PREFIX)) {
    try {
      return decodeURIComponent(selectedAssigneeId.slice(ASSIGNEE_LEGACY_PREFIX.length));
    } catch {
      return 'Unassigned';
    }
  }
  const u = assigneeUsers.find((x) => x.id === selectedAssigneeId);
  return u?.name?.trim() || 'Unassigned';
}

function useAssigneeUsers(open: boolean, authToken: string | null) {
  const [assigneeUsers, setAssigneeUsers] = useState<AssigneeUserRow[]>([]);
  const [assigneeLoading, setAssigneeLoading] = useState(false);

  useEffect(() => {
    if (!open || !authToken) {
      if (!open) return;
      setAssigneeUsers([]);
      return;
    }
    let cancelled = false;
    setAssigneeLoading(true);
    fetch(`${API_BASE_URL}/users/assignees`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(
              'Assignee API not found. Restart the backend (npm run dev in backend) so /api/users/assignees is registered.',
            );
          }
          if (res.status === 401) {
            throw new Error('Session expired. Sign in again.');
          }
          throw new Error(`Could not load users (${res.status})`);
        }
        const data = (await res.json()) as { users?: AssigneeUserRow[] };
        if (!cancelled) setAssigneeUsers(dedupeAssigneeUsers(data.users ?? []));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setAssigneeUsers([]);
          toast.error(err instanceof Error ? err.message : 'Could not load users for assignee');
        }
      })
      .finally(() => {
        if (!cancelled) setAssigneeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, authToken]);

  return { assigneeUsers, assigneeLoading };
}

function AssigneeSelectField({
  authToken,
  assigneeLoading,
  assigneeUsers,
  selectedAssigneeId,
  onSelectAssigneeId,
  assigneeTextFallback,
  onAssigneeTextFallback,
}: {
  authToken: string | null;
  assigneeLoading: boolean;
  assigneeUsers: AssigneeUserRow[];
  selectedAssigneeId: string;
  onSelectAssigneeId: (id: string) => void;
  assigneeTextFallback: string;
  onAssigneeTextFallback: (v: string) => void;
}) {
  if (!authToken) {
    return (
      <Input
        value={assigneeTextFallback}
        onChange={(e) => onAssigneeTextFallback(e.target.value)}
        placeholder="Sign in to pick from users"
      />
    );
  }
  return (
    <Select
      value={selectedAssigneeId}
      onValueChange={onSelectAssigneeId}
      disabled={assigneeLoading}
    >
      <SelectTrigger className="w-full cursor-pointer">
        <SelectValue
          placeholder={assigneeLoading ? 'Loading users…' : 'Select assignee'}
        />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ASSIGNEE_UNASSIGNED_ID} className="cursor-pointer">
          Unassigned
        </SelectItem>
        {legacyAssigneeRowNeeded(selectedAssigneeId, assigneeUsers) && (
          <SelectItem value={selectedAssigneeId} className="cursor-pointer">
            {`${decodeURIComponent(
              selectedAssigneeId.slice(ASSIGNEE_LEGACY_PREFIX.length),
            )} (not in directory)`}
          </SelectItem>
        )}
        {assigneeUsers.map((u) => (
          <SelectItem key={u.id} value={u.id} className="cursor-pointer">
            {u.name} ({u.email})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TaskDetailsModal({
  open,
  task,
  columns,
  currentColumnId,
  comments,
  onClose,
  onSaveAll,
  onDownloadAllAttachments,
  authToken,
  canEditContent,
  canMoveBoard,
}: {
  open: boolean;
  task: Task | null;
  columns: Column[];
  currentColumnId: string | null;
  comments: TaskComment[];
  onClose: () => void;
  onSaveAll: (args: {
    taskId: string;
    changes: Partial<TaskDraft>;
    targetColumnId: string | null;
    newComments: string[];
    uploadFiles: File[];
    removeAttachmentIds: string[];
  }) => Promise<void>;
  onDownloadAllAttachments: (taskId: string, taskTitle: string) => void;
  authToken: string | null;
  canEditContent: boolean;
  canMoveBoard: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskDraft['priority']>('medium');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>(ASSIGNEE_UNASSIGNED_ID);
  const [assigneeTextFallback, setAssigneeTextFallback] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [statusColumnId, setStatusColumnId] = useState<string>('');
  const [commentDraft, setCommentDraft] = useState('');
  const [pendingComments, setPendingComments] = useState<string[]>([]);
  const [pendingUploads, setPendingUploads] = useState<File[]>([]);
  const [pendingRemoveIds, setPendingRemoveIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { assigneeUsers, assigneeLoading } = useAssigneeUsers(open, authToken);

  useEffect(() => {
    if (!open || !task) return;
    setTitle(task.title ?? '');
    setDescription(task.description ?? '');
    setPriority(task.priority ?? 'medium');
    setAssigneeTextFallback(task.assignee ?? '');
    setDueDate(task.dueDate ?? '');
    setTagsInput((task.tags ?? []).join(', '));
    setDueDateOpen(false);
    setStatusColumnId(currentColumnId ?? '');
    setCommentDraft('');
    setPendingComments([]);
    setPendingUploads([]);
    setPendingRemoveIds(new Set());
    setSaving(false);
  }, [open, task?.id]);

  useEffect(() => {
    if (!open || !task) return;
    setSelectedAssigneeId(resolveAssigneeSelectId(task.assignee ?? '', assigneeUsers));
  }, [open, task?.id, task?.assignee, assigneeUsers]);

  const parsedTags = tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const assigneeResolved = () =>
    assigneeStringFromSelection(authToken, selectedAssigneeId, assigneeUsers, assigneeTextFallback);

  const isDirty = (() => {
    if (!task) return false;
    const baseTags = (task.tags ?? []).map((t) => t.trim()).filter(Boolean);
    const prevAssignee = (task.assignee ?? '').trim() || 'Unassigned';
    const attachmentsChanged = pendingUploads.length > 0 || pendingRemoveIds.size > 0;
    const commentsChanged = pendingComments.length > 0;
    return (
      title.trim() !== (task.title ?? '').trim() ||
      description !== (task.description ?? '') ||
      priority !== (task.priority ?? 'medium') ||
      assigneeResolved() !== prevAssignee ||
      (dueDate.trim() || '') !== (task.dueDate ?? '') ||
      parsedTags.join('|') !== baseTags.join('|') ||
      (statusColumnId || '') !== (currentColumnId ?? '') ||
      attachmentsChanged ||
      commentsChanged
    );
  })();

  const visibleExistingAttachments = (task?.attachments ?? []).filter((a) => !pendingRemoveIds.has(a.id));

  const save = async () => {
    if (!task || !isDirty || saving) return;
    const columnChanged = (statusColumnId || '') !== (currentColumnId ?? '') && !!statusColumnId;
    const contentDirty =
      title.trim() !== (task.title ?? '').trim() ||
      description !== (task.description ?? '') ||
      priority !== (task.priority ?? 'medium') ||
      assigneeResolved() !== ((task.assignee ?? '').trim() || 'Unassigned') ||
      (dueDate.trim() || '') !== (task.dueDate ?? '') ||
      parsedTags.join('|') !== (task.tags ?? []).map((t) => t.trim()).filter(Boolean).join('|');

    if (contentDirty && !canEditContent) {
      toast.error('You do not have permission to edit this task.');
      return;
    }
    if (columnChanged && !canMoveBoard) {
      toast.error('You do not have permission to move tasks.');
      return;
    }

    const changes: Partial<TaskDraft> = {};
    if (title.trim() !== (task.title ?? '').trim()) changes.title = title.trim();
    if (description !== (task.description ?? '')) changes.description = description;
    if (priority !== (task.priority ?? 'medium')) changes.priority = priority;
    const prevAssignee = (task.assignee ?? '').trim() || 'Unassigned';
    if (assigneeResolved() !== prevAssignee) changes.assignee = assigneeResolved();
    if ((dueDate.trim() || '') !== (task.dueDate ?? '')) changes.dueDate = dueDate.trim() ? dueDate : undefined;
    const baseTags = (task.tags ?? []).map((t) => t.trim()).filter(Boolean);
    if (parsedTags.join('|') !== baseTags.join('|')) changes.tags = parsedTags;

    try {
      setSaving(true);
      await onSaveAll({
        taskId: task.id,
        changes,
        targetColumnId: columnChanged ? statusColumnId : null,
        newComments: pendingComments,
        uploadFiles: pendingUploads,
        removeAttachmentIds: Array.from(pendingRemoveIds),
      });
      setPendingComments([]);
      setPendingUploads([]);
      setPendingRemoveIds(new Set());
      toast.success('Saved');
      // Keep dialog open after saving (user requested).
    } catch (err) {
      toast.error('Save failed', {
        description: String((err as Error | undefined)?.message ?? err),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] max-h-[90vh] overflow-y-auto pr-12">
        <DialogHeader>
          <DialogTitle>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              disabled={!canEditContent}
            />
          </DialogTitle>
          <DialogDescription>Review task details and comments</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className={!canEditContent ? 'pointer-events-none opacity-90' : undefined}>
              <DescriptionEditor
                value={description}
                onSave={(next) => setDescription(next)}
                onChange={(next) => setDescription(next)}
                placeholder="Improve description..."
                alwaysEditing
              />
            </div>

            <div className="rounded-md border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Attachments</h3>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!task?.id) return;
                      onDownloadAllAttachments(task.id, title.trim() || task.title || task.id);
                    }}
                    disabled={!task?.id || visibleExistingAttachments.length === 0}
                    title="Download all attachments"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download all
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (!task?.id || files.length === 0) return;
                      setPendingUploads((prev) => [...prev, ...files]);
                      e.currentTarget.value = '';
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!task?.id || !canEditContent}
                  >
                    Add attachment
                  </Button>
                </div>
              </div>
              {visibleExistingAttachments.length === 0 && pendingUploads.length === 0 ? (
                <p className="text-sm text-gray-500">No attachments yet.</p>
              ) : (
                <ul className="space-y-2">
                  {visibleExistingAttachments.map((att) => (
                    <li
                      key={att.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{att.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {formatFileSize(att.size)}
                        </span>
                        <a
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-gray-100"
                          href={att.url}
                          download={att.name}
                          aria-label="Download attachment"
                          title="Download"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="h-4 w-4 text-gray-500" />
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={!canEditContent || !task?.id}
                          onClick={() => {
                            setPendingRemoveIds((prev) => {
                              const next = new Set(prev);
                              next.add(att.id);
                              return next;
                            });
                          }}
                          aria-label="Remove attachment"
                          title="Remove attachment"
                        >
                          <X className="h-4 w-4 text-gray-500" />
                        </Button>
                      </div>
                    </li>
                  ))}
                  {pendingUploads.map((f, idx) => (
                    <li
                      key={`${f.name}-${f.size}-${idx}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-dashed border-gray-200 px-3 py-2"
                    >
                      <span className="text-sm text-gray-700 truncate">{f.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {formatFileSize(f.size)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={!canEditContent}
                          onClick={() => setPendingUploads((prev) => prev.filter((_, i) => i !== idx))}
                          aria-label="Remove pending upload"
                          title="Remove"
                        >
                          <X className="h-4 w-4 text-gray-500" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-md border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Comments</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {comments.length === 0 && pendingComments.length === 0 ? (
                  <p className="text-sm text-gray-500">No comments yet.</p>
                ) : (
                  <>
                    {comments.map((comment) => (
                      <div key={comment.id} className="rounded-md border border-gray-200 p-3">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>{comment.author}</span>
                          <span>{new Date(comment.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-gray-800">{comment.text}</p>
                      </div>
                    ))}
                    {pendingComments.map((txt, i) => (
                      <div key={`pending-${i}`} className="rounded-md border border-dashed border-gray-200 p-3">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>New comment</span>
                        </div>
                        <p className="text-sm text-gray-800">{txt}</p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-gray-600">Add comment</div>
              <Textarea
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Write your comment..."
                rows={3}
                disabled={!canEditContent}
              />
              <div className="pt-1">
                <Button
                  onClick={() => {
                    const txt = commentDraft.trim();
                    if (!txt) return;
                    setPendingComments((prev) => [...prev, txt]);
                    setCommentDraft('');
                  }}
                  disabled={!commentDraft.trim() || !canEditContent}
                  className="cursor-pointer disabled:cursor-not-allowed"
                >
                  Add comment
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-md border border-gray-200 p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Status</div>
              <Select value={statusColumnId} onValueChange={setStatusColumnId} disabled={!canMoveBoard}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border border-gray-200 p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Priority</div>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskDraft['priority'])}
                disabled={!canEditContent}
                className="border-input bg-input-background flex h-9 w-full min-w-0 rounded-md border px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-60"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="rounded-md border border-gray-200 p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Assignee</div>
              <div className={!canEditContent ? 'pointer-events-none opacity-90' : undefined}>
                <AssigneeSelectField
                  authToken={authToken}
                  assigneeLoading={assigneeLoading}
                  assigneeUsers={assigneeUsers}
                  selectedAssigneeId={selectedAssigneeId}
                  onSelectAssigneeId={setSelectedAssigneeId}
                  assigneeTextFallback={assigneeTextFallback}
                  onAssigneeTextFallback={setAssigneeTextFallback}
                />
              </div>
            </div>
            <div className="rounded-md border border-gray-200 p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Due date</div>
              <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={!canEditContent}
                    className="flex w-full items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                    onClick={() => setDueDateOpen(true)}
                  >
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className={dueDate ? '' : 'text-gray-500'}>
                      {dueDate ? new Date(dueDate).toLocaleDateString() : 'Not set'}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <CalendarPicker
                    mode="single"
                    selected={dueDate ? new Date(dueDate) : undefined}
                    onSelect={(d) => {
                      if (!d) return;
                      const iso = new Date(
                        d.getFullYear(),
                        d.getMonth(),
                        d.getDate(),
                        0,
                        0,
                        0,
                        0,
                      )
                        .toISOString()
                        .slice(0, 10);
                      setDueDate(iso);
                      setDueDateOpen(false);
                    }}
                    initialFocus
                  />
                  <div className="flex items-center justify-between border-t border-gray-200 p-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDueDate('');
                        setDueDateOpen(false);
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const now = new Date();
                        const iso = new Date(
                          now.getFullYear(),
                          now.getMonth(),
                          now.getDate(),
                          0,
                          0,
                          0,
                          0,
                        )
                          .toISOString()
                          .slice(0, 10);
                        setDueDate(iso);
                        setDueDateOpen(false);
                      }}
                    >
                      Today
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="rounded-md border border-gray-200 p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Labels</div>
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Comma-separated labels"
                disabled={!canEditContent}
              />
              {parsedTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {parsedTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose} className="cursor-pointer">
            Close
          </Button>
          <Button
            onClick={() => void save()}
            disabled={!isDirty || saving}
            className="cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}

function TaskModal({
  open,
  mode,
  columnTitle,
  initialDraft,
  authToken,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  columnTitle: string;
  initialDraft: TaskDraft;
  authToken: string | null;
  onClose: () => void;
  onSubmit: (draft: TaskDraft, files: File[]) => void;
}) {
  const [title, setTitle] = useState(initialDraft.title);
  const [description, setDescription] = useState(initialDraft.description);
  const [priority, setPriority] = useState<TaskDraft['priority']>(initialDraft.priority);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>(ASSIGNEE_UNASSIGNED_ID);
  const [assigneeTextFallback, setAssigneeTextFallback] = useState(initialDraft.assignee);
  const [dueDate, setDueDate] = useState<string>(initialDraft.dueDate ?? '');
  const [tagsInput, setTagsInput] = useState(initialDraft.tags.join(', '));
  const [files, setFiles] = useState<File[]>([]);

  const { assigneeUsers, assigneeLoading } = useAssigneeUsers(open, authToken);

  useEffect(() => {
    if (!open) return;
    setTitle(initialDraft.title);
    setDescription(initialDraft.description);
    setPriority(initialDraft.priority);
    setAssigneeTextFallback(initialDraft.assignee);
    setDueDate(initialDraft.dueDate ?? '');
    setTagsInput(initialDraft.tags.join(', '));
    setFiles([]);
  }, [open, initialDraft]);

  useEffect(() => {
    if (!open) return;
    setSelectedAssigneeId(resolveAssigneeSelectId(initialDraft.assignee, assigneeUsers));
  }, [open, initialDraft.assignee, assigneeUsers]);

  const canSubmit = title.trim().length > 0;

  const assigneeStringForSubmit = (): string =>
    assigneeStringFromSelection(authToken, selectedAssigneeId, assigneeUsers, assigneeTextFallback);

  const submit = () => {
    if (!canSubmit) return;
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onSubmit({
      title: title.trim(),
      description,
      priority,
      assignee: assigneeStringForSubmit(),
      dueDate: dueDate.trim() ? dueDate : undefined,
      tags,
    }, files);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="flex flex-col gap-0 w-[min(44rem,95vw)] max-w-[44rem] h-[min(88vh,820px)] max-h-[88vh] p-0 overflow-hidden sm:max-w-[44rem]">
        <DialogHeader className="shrink-0 border-b border-gray-100 px-6 pt-6 pb-4">
          <DialogTitle>{mode === 'create' ? 'Create Task' : 'Edit Task'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? `Add a task to ${columnTitle}`
              : `Update the task in ${columnTitle}`}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-6 py-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required className="h-10" />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[140px] resize-y"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskDraft['priority'])}
                  className="border-input bg-white flex h-10 w-full min-w-0 rounded-[10px] border border-gray-200 px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:ring-[3px]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Due date</label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-10" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Assignee</label>
              <AssigneeSelectField
                authToken={authToken}
                assigneeLoading={assigneeLoading}
                assigneeUsers={assigneeUsers}
                selectedAssigneeId={selectedAssigneeId}
                onSelectAssigneeId={setSelectedAssigneeId}
                assigneeTextFallback={assigneeTextFallback}
                onAssigneeTextFallback={setAssigneeTextFallback}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Labels (comma-separated)</label>
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. Backend, API"
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Attachments</label>
              <Input
                type="file"
                multiple
                className="h-10"
                onChange={(e) => {
                  setFiles(Array.from(e.target.files ?? []));
                }}
              />
              {files.length > 0 && (
                <div className="text-xs text-gray-500">
                  {files.length} file(s): {files.map((f) => f.name).join(', ')}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-3 border-t border-gray-100 px-6 py-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const initialColumns: Column[] = [
  {
    id: 'todo',
    title: 'To Do',
    color: 'bg-blue-500',
    tasks: [
      {
        id: '1',
        title: 'Design System Update',
        description: 'Update the design system components and documentation',
        priority: 'high',
        assignee: 'John Doe',
        dueDate: '2024-02-15',
        tags: ['Design', 'UI/UX']
      },
      {
        id: '2',
        title: 'API Integration',
        description: 'Integrate third-party payment API',
        priority: 'medium',
        assignee: 'Jane Smith',
        tags: ['Backend', 'API']
      }
    ]
  },
  {
    id: 'progress',
    title: 'In Progress',
    color: 'bg-yellow-500',
    tasks: [
      {
        id: '3',
        title: 'Mobile App Development',
        description: 'Develop responsive mobile application',
        priority: 'high',
        assignee: 'Mike Johnson',
        dueDate: '2024-02-20',
        tags: ['Mobile', 'React Native']
      }
    ]
  },
  {
    id: 'review',
    title: 'Review',
    color: 'bg-purple-500',
    tasks: [
      {
        id: '4',
        title: 'Code Review',
        description: 'Review pull requests and merge changes',
        priority: 'medium',
        assignee: 'Sarah Wilson',
        tags: ['Code Review', 'QA']
      }
    ]
  },
  {
    id: 'done',
    title: 'Done',
    color: 'bg-[#249E5E]',
    tasks: [
      {
        id: '5',
        title: 'User Authentication',
        description: 'Implement secure user authentication system',
        priority: 'high',
        assignee: 'Alex Brown',
        tags: ['Security', 'Backend']
      }
    ]
  }
];

export function KanbanBoard({ onOpenAdmin }: { onOpenAdmin?: () => void } = {}) {
  const dispatch = useAppDispatch();
  const authToken = useAppSelector(selectAuthToken);
  const authUser = useAppSelector(selectAuthUser);
  const permissions = authUser?.permissions ?? [];
  const canOpenAdmin = canAccessAdminArea(permissions);
  const canManageColumns = hasPermission(permissions, PERMISSIONS.manage_columns);
  const canCreateTask = hasPermission(permissions, PERMISSIONS.create_task);
  const mayPersistBoard = canPersistBoard(permissions);
  const canMoveTasks = canMoveTaskOnBoard(permissions);
  const columns = useAppSelector(selectBoardColumns);
  const boardHydrated = useAppSelector(selectKanbanHydrated);
  const boardLoading = useAppSelector(selectKanbanLoading);
  const boardSaving = useAppSelector(selectKanbanSaving);
  const boardError = useAppSelector(selectKanbanError);
  const [searchTerm, setSearchTerm] = useState('');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalMode, setTaskModalMode] = useState<'create' | 'edit'>('create');
  const [taskModalColumnId, setTaskModalColumnId] = useState<string>(
    initialColumns[0]?.id ?? 'todo',
  );
  const [taskModalColumnTitle, setTaskModalColumnTitle] = useState<string>(
    initialColumns[0]?.title ?? 'Column',
  );
  const [taskModalTaskId, setTaskModalTaskId] = useState<string | null>(null);
  const [taskModalInitialDraft, setTaskModalInitialDraft] = useState<TaskDraft>({
    title: '',
    description: '',
    priority: 'medium',
    assignee: 'Unassigned',
    dueDate: undefined,
    tags: [],
  });
  const [showFilters, setShowFilters] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<'all' | Task['priority']>('all');
  const [dueDateFilter, setDueDateFilter] = useState<
    'all' | 'overdue' | 'today' | 'this-week' | 'no-due-date'
  >('all');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [detailsTaskId, setDetailsTaskId] = useState<string | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [columnToDelete, setColumnToDelete] = useState<{
    id: string;
    title: string;
    taskCount: number;
  } | null>(null);
  const lastLocalSaveAt = useRef(0);
  const socketRef = useRef<Socket | null>(null);
  /** Avoid acting on a stale `Unauthorized` left in Redux from a prior session (see boardError effect). */
  const lastAuthTokenRef = useRef<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findTaskById = (taskId: string, sourceColumns: Column[] = columns) => {
    for (const column of sourceColumns) {
      const task = column.tasks.find((t) => t.id === taskId);
      if (task) return { task, columnId: column.id };
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id);
    const activeType = event.active.data.current?.type;
    if (activeType === 'column-sort') {
      setActiveTaskId(null);
      return;
    }

    const found = findTaskById(activeId);
    setActiveTaskId(found ? activeId : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTaskId(null);
    if (!over) return;

    const activeData = active.data.current;
    if (activeData?.type === 'column-sort') {
      if (!canManageColumns) {
        toast.error('You do not have permission to reorder columns.');
        return;
      }
      const overData = over.data.current;
      const targetColumnId =
        overData?.type === 'column-sort'
          ? String(over.id)
          : overData?.type === 'column'
            ? String(overData.columnId)
            : null;
      if (!targetColumnId) return;

      dispatch(
        reorderColumnsAction({
          sourceColumnId: String(active.id),
          targetColumnId,
        }),
      );
      return;
    }

    const activeTaskId = String(active.id);
    const overData = over.data.current;
    if (activeData?.type !== 'task') return;
    if (!canMoveTasks) {
      toast.error('You do not have permission to move tasks.');
      return;
    }

    const sourceColumnId = String(activeData.columnId);
    const targetColumnId =
      overData?.type === 'task'
        ? String(overData.columnId)
        : overData?.type === 'column'
          ? String(overData.columnId)
          : null;

    if (!targetColumnId) return;
    const overTaskId = overData?.type === 'task' ? String(over.id) : undefined;

    dispatch(
      moveTaskAction({
        taskId: activeTaskId,
        sourceColumnId,
        targetColumnId,
        overTaskId,
      }),
    );
  };

  const uploadAttachments = async (taskId: string, files: File[]) => {
    if (!authToken) return;
    if (files.length === 0) return;

    const form = new FormData();
    for (const file of files) {
      form.append('files', file);
    }

    const response = await fetch(
      `${API_BASE_URL}/tasks/${encodeURIComponent(taskId)}/attachments`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: form,
      },
    );

    if (!response.ok) {
      const errBody = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(errBody.message ?? `Upload failed (${response.status})`);
    }

    const body = (await response.json()) as { attachments?: Task['attachments'] };
    const nextAttachments = Array.isArray(body.attachments) ? body.attachments : [];
    dispatch(setTaskAttachments({ taskId, attachments: nextAttachments }));
  };

  const uploadAttachmentsWithToast = (taskId: string, files: File[]) => {
    void uploadAttachments(taskId, files).catch((err) => {
      toast.error('Attachment upload failed', {
        description: String((err as Error | undefined)?.message ?? err),
      });
    });
  };

  const removeAttachment = async (taskId: string, attachmentId: string) => {
    if (!authToken) return;
    const response = await fetch(
      `${API_BASE_URL}/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachmentId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );
    if (!response.ok) {
      if (response.status === 404) {
        // Already removed (e.g. stale pending removal on a later save).
        const existing = findTaskById(taskId)?.task.attachments ?? [];
        const filtered = existing.filter((a) => a.id !== attachmentId);
        dispatch(setTaskAttachments({ taskId, attachments: filtered }));
        return;
      }
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(body.message ?? `Remove failed (${response.status})`);
    }
    const body = (await response.json().catch(() => ({}))) as { attachments?: Task['attachments'] };
    const next = Array.isArray(body.attachments) ? body.attachments : [];
    dispatch(setTaskAttachments({ taskId, attachments: next }));
  };

  const removeAttachmentWithToast = (taskId: string, attachmentId: string) => {
    void removeAttachment(taskId, attachmentId).then(
      () => toast.success('Attachment removed'),
      (err) =>
        toast.error('Remove failed', {
          description: String((err as Error | undefined)?.message ?? err),
        }),
    );
  };

  const saveTaskDetailsAll = async (args: {
    taskId: string;
    changes: Partial<TaskDraft>;
    targetColumnId: string | null;
    newComments: string[];
    uploadFiles: File[];
    removeAttachmentIds: string[];
  }) => {
    const { taskId, changes, targetColumnId, newComments, uploadFiles, removeAttachmentIds } = args;
    if (!authToken) throw new Error('Not authenticated');

    // 1) Apply attachment removals/uploads only when user clicks Save
    const existingAttachmentIds = new Set(
      (findTaskById(taskId)?.task.attachments ?? []).map((a) => a.id),
    );
    for (const attId of removeAttachmentIds) {
      if (!existingAttachmentIds.has(attId)) continue;
      await removeAttachment(taskId, attId);
      existingAttachmentIds.delete(attId);
    }
    if (uploadFiles.length > 0) {
      await uploadAttachments(taskId, uploadFiles);
    }

    // 2) Apply status move + task field changes + comments to local board, then persist board JSON
    if (targetColumnId) {
      const found = findTaskById(taskId);
      if (found && found.columnId !== targetColumnId) {
        dispatch(
          moveTaskAction({
            taskId,
            sourceColumnId: found.columnId,
            targetColumnId,
          }),
        );
      }
    }

    if (Object.keys(changes).length > 0) {
      const found = findTaskById(taskId);
      if (found) {
        dispatch(
          updateTaskAction({
            taskId,
            draft: {
              title: changes.title ?? found.task.title,
              description: changes.description ?? found.task.description,
              priority: changes.priority ?? found.task.priority,
              assignee: changes.assignee ?? found.task.assignee,
              dueDate: changes.dueDate !== undefined ? changes.dueDate : found.task.dueDate,
              tags: changes.tags ?? found.task.tags,
            },
          }),
        );
      }
    }

    for (const txt of newComments) {
      const t = txt.trim();
      if (!t) continue;
      dispatch(
        addTaskCommentAction({
          taskId,
          author: authUser?.name ?? authUser?.email ?? 'User',
          text: t,
        }),
      );
    }

    persistBoardNow();
  };

  const downloadAllAttachments = (taskId: string, taskTitle: string) => {
    if (!authToken) {
      toast.error('Not authenticated');
      return;
    }
    const safeTitle =
      String(taskTitle || 'task')
        .replace(/[^\w.\-() ]+/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80) || 'task';
    void (async () => {
      const res = await fetch(`${API_BASE_URL}/tasks/${encodeURIComponent(taskId)}/attachments/download`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeTitle}-attachments.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    })().catch((err) => {
      toast.error('Download failed', {
        description: String((err as Error | undefined)?.message ?? err),
      });
    });
  };

  const createTask = async (columnId: string, draft: TaskDraft, files: File[]) => {
    const taskId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    dispatch(
      createTaskAction({
        columnId,
        taskId,
        draft,
        createdBy: authUser?.id,
      }),
    );

    if (files.length > 0) {
      try {
        await uploadAttachments(taskId, files);
      } catch (err) {
        toast.error('Attachment upload failed', {
          description: String((err as Error | undefined)?.message ?? err),
        });
      }
    }
  };

  const updateTask = (taskId: string, draft: TaskDraft) => {
    dispatch(updateTaskAction({ taskId, draft }));
  };

  const openTaskDetails = (taskId: string) => {
    setDetailsTaskId(taskId);
  };

  const saveTaskDetails = (changes: Partial<TaskDraft>) => {
    if (!detailsTaskId) return;
    const found = findTaskById(detailsTaskId);
    if (!found) return;

    updateTask(detailsTaskId, {
      title: changes.title ?? found.task.title,
      description: changes.description ?? found.task.description,
      priority: changes.priority ?? found.task.priority,
      assignee: changes.assignee ?? found.task.assignee,
      dueDate: changes.dueDate !== undefined ? changes.dueDate : found.task.dueDate,
      tags: changes.tags ?? found.task.tags,
    });

    toast.success('Task updated');
  };

  const persistBoardNow = () => {
    lastLocalSaveAt.current = Date.now();
    void dispatch(saveBoard()).catch(() => undefined);
  };

  const moveDetailsTaskToColumn = (targetColumnId: string) => {
    if (!detailsTaskId) return;
    if (!canMoveTasks) {
      toast.error('You do not have permission to move tasks.');
      return;
    }
    const found = findTaskById(detailsTaskId);
    if (!found) return;
    if (found.columnId === targetColumnId) return;

    dispatch(
      moveTaskAction({
        taskId: detailsTaskId,
        sourceColumnId: found.columnId,
        targetColumnId,
      }),
    );
  };

  const normalizeTitle = (title: string) => title.trim().toLowerCase();

  const startEditColumnTitle = (columnId: string, currentTitle: string) => {
    if (!canManageColumns) {
      toast.error('You do not have permission to manage columns.');
      return;
    }
    setEditingColumnId(columnId);
    setTempTitle(currentTitle);
  };

  const cancelEditColumnTitle = () => {
    setEditingColumnId(null);
    setTempTitle('');
  };

  const saveEditColumnTitle = (columnId: string) => {
    if (!canManageColumns) return;
    const next = tempTitle.trim();
    const existing = columns.find((c) => c.id === columnId);
    if (!existing) {
      cancelEditColumnTitle();
      return;
    }
    if (!next) {
      cancelEditColumnTitle();
      return;
    }
    const nextNorm = normalizeTitle(next);
    const duplicate = columns.some(
      (c) => c.id !== columnId && normalizeTitle(c.title) === nextNorm,
    );
    if (duplicate) {
      toast.error('Column name already exists');
      return;
    }

    dispatch(renameColumn({ columnId, title: next }));
    cancelEditColumnTitle();
  };

  const beginAddColumn = () => {
    if (!canManageColumns) {
      toast.error('You do not have permission to manage columns.');
      return;
    }
    setIsAddingColumn(true);
    setNewColumnTitle('');
  };

  const cancelAddColumn = () => {
    setIsAddingColumn(false);
    setNewColumnTitle('');
  };

  const commitAddColumn = () => {
    if (!canManageColumns) return;
    const title = newColumnTitle.trim();
    if (!title) {
      cancelAddColumn();
      return;
    }
    const duplicate = columns.some((c) => normalizeTitle(c.title) === normalizeTitle(title));
    if (duplicate) {
      toast.error('Column name already exists');
      return;
    }
    dispatch(addColumn({ title }));
    cancelAddColumn();
  };

  const requestDeleteColumn = (columnId: string) => {
    if (!canManageColumns) {
      toast.error('You do not have permission to manage columns.');
      return;
    }
    if (columns.length <= 1) {
      toast.error('You must keep at least one column on the board.');
      return;
    }
    const column = columns.find((c) => c.id === columnId);
    if (!column) return;
    setColumnToDelete({
      id: columnId,
      title: column.title,
      taskCount: column.tasks.length,
    });
  };

  const confirmDeleteColumn = () => {
    if (!columnToDelete) return;
    dispatch(deleteColumn({ columnId: columnToDelete.id }));
    if (editingColumnId === columnToDelete.id) {
      cancelEditColumnTitle();
    }
    setColumnToDelete(null);
    toast.success('Column deleted');
  };

  const closeTaskModal = () => {
    setTaskModalOpen(false);
    setTaskModalTaskId(null);
  };

  const openCreateTaskModal = (columnId: string) => {
    if (!canCreateTask) {
      toast.error('You do not have permission to create tasks.');
      return;
    }
    const column = columns.find((c) => c.id === columnId);

    setTaskModalMode('create');
    setTaskModalColumnId(columnId);
    setTaskModalColumnTitle(column?.title ?? 'Column');
    setTaskModalTaskId(null);
    setTaskModalInitialDraft({
      title: '',
      description: '',
      priority: 'medium',
      assignee: 'Unassigned',
      dueDate: undefined,
      tags: [],
    });
    setTaskModalOpen(true);
  };

  const openEditTaskModal = (taskId: string) => {
    const column = columns.find((c) => c.tasks.some((t) => t.id === taskId));
    const task = column?.tasks.find((t) => t.id === taskId);
    if (!column || !task) return;
    if (
      !authUser ||
      !canEditTaskBody(permissions, authUser.id, authUser.name, authUser.email, task)
    ) {
      toast.error('You do not have permission to edit this task.');
      return;
    }

    setTaskModalMode('edit');
    setTaskModalColumnId(column.id);
    setTaskModalColumnTitle(column.title);
    setTaskModalTaskId(taskId);
    setTaskModalInitialDraft({
      title: task.title,
      description: task.description,
      priority: task.priority,
      assignee: task.assignee,
      dueDate: task.dueDate,
      tags: task.tags,
    });
    setTaskModalOpen(true);
  };

  const matchesDueDateFilter = (task: Task) => {
    if (dueDateFilter === 'all') return true;
    if (!task.dueDate) return dueDateFilter === 'no-due-date';
    if (dueDateFilter === 'no-due-date') return false;

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(todayStart.getDate() + 7);

    const dueDate = new Date(task.dueDate);
    const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

    if (dueDateFilter === 'overdue') {
      return dueDateStart < todayStart;
    }
    if (dueDateFilter === 'today') {
      return dueDateStart >= todayStart && dueDateStart < tomorrowStart;
    }
    if (dueDateFilter === 'this-week') {
      return dueDateStart >= todayStart && dueDateStart < weekEnd;
    }

    return true;
  };

  const filteredColumns = columns.map((column) => ({
    ...column,
    tasks: column.tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      const matchesAssignee =
        assigneeFilter.trim() === '' ||
        task.assignee.toLowerCase().includes(assigneeFilter.toLowerCase());
      const matchesDueDate = matchesDueDateFilter(task);
      const matchesUserScope = taskVisibleForUser(task, authUser, permissions);

      return (
        matchesSearch &&
        matchesPriority &&
        matchesAssignee &&
        matchesDueDate &&
        matchesUserScope
      );
    }),
  }));

  useLayoutEffect(() => {
    if (!authToken) {
      lastAuthTokenRef.current = null;
      return;
    }
    if (authToken !== lastAuthTokenRef.current) {
      lastAuthTokenRef.current = authToken;
      dispatch(clearKanbanError());
    }
  }, [authToken, dispatch]);

  useEffect(() => {
    void dispatch(fetchBoard());
  }, [dispatch]);

  useEffect(() => {
    if (!boardHydrated) return;
    if (!mayPersistBoard) return;
    // While modals are open, persist only when user clicks Save.
    if (taskModalOpen || detailsTaskId) return;
    const timer = window.setTimeout(() => {
      lastLocalSaveAt.current = Date.now();
      void dispatch(saveBoard());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [columns, boardHydrated, dispatch, mayPersistBoard, taskModalOpen, detailsTaskId]);

  useEffect(() => {
    if (!boardError) return;
    if (boardError === 'Unauthorized') {
      if (boardLoading) return;
      dispatch(logout());
      toast.info('Session expired. Please sign in again.');
      return;
    }

    toast.error('Board sync failed', {
      description: boardError,
      action: {
        label: 'Retry',
        onClick: () => {
          void dispatch(fetchBoard());
        },
      },
    });
  }, [boardError, boardLoading, dispatch]);

  useEffect(() => {
    if (!authToken) return;
    const socket = io(getSocketOrigin() ?? window.location.origin, {
      transports: ['websocket'],
      auth: { token: authToken },
    });
    socketRef.current = socket;

    socket.on('board:updated', () => {
      const isLikelyLocalEcho = Date.now() - lastLocalSaveAt.current < 1200;
      if (isLikelyLocalEcho) return;
      void dispatch(fetchBoard());
    });

    return () => {
      socket.off('board:updated');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authToken, dispatch]);

  const activeTask = activeTaskId ? findTaskById(activeTaskId)?.task : null;
  const detailsLookup = detailsTaskId ? findTaskById(detailsTaskId) : null;
  const detailsTask = detailsLookup?.task ?? null;
  const detailsTaskColumnId = detailsLookup?.columnId ?? null;
  const detailsCanEditContent =
    detailsTask && authUser
      ? canEditTaskBody(permissions, authUser.id, authUser.name, authUser.email, detailsTask)
      : false;
  const detailsCanMove = canMoveTasks;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen bg-[#f4f6f8] flex flex-col">
        {/* Header */}
        <header className="shrink-0 border-b border-gray-200 bg-white shadow-sm">
          <div className="px-4 py-4 lg:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-[28px] font-bold text-heading leading-[34px]">Project Board</h1>
              <p className="text-sm text-subtitle mt-0.5">Manage your tasks and workflow</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px] sm:flex-none sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <Input
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFilters((prev) => !prev)}
                className={
                  showFilters ||
                  priorityFilter !== 'all' ||
                  dueDateFilter !== 'all' ||
                  assigneeFilter.trim()
                    ? 'border-primary text-primary'
                    : ''
                }
              >
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>

              {canCreateTask && (
                <Button type="button" onClick={() => openCreateTaskModal(columns[0]?.id ?? 'todo')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
              )}

              {canManageColumns && (
                <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (isAddingColumn) {
                      cancelAddColumn();
                      return;
                    }
                    beginAddColumn();
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Column
                </Button>

                {isAddingColumn && (
                  <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                    <Input
                      autoFocus
                      value={newColumnTitle}
                      onChange={(e) => setNewColumnTitle(e.target.value)}
                      placeholder="Column name"
                      className="h-9"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitAddColumn();
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelAddColumn();
                        }
                      }}
                      onBlur={() => {
                        if (newColumnTitle.trim()) commitAddColumn();
                        else cancelAddColumn();
                      }}
                    />
                    <div className="mt-2 text-xs text-gray-500">Enter to add, Esc to cancel</div>
                  </div>
                )}
              </div>
              )}

              <div className="relative border-l border-gray-200 pl-2 ml-1 group">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  aria-label="User menu"
                >
                  {(authUser?.name ?? authUser?.email ?? 'U').trim().charAt(0).toUpperCase()}
                </button>

                <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-lg opacity-0 pointer-events-none translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {authUser?.name ?? authUser?.email ?? 'Signed in'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 mb-3 capitalize">
                    {authUser?.roleKey ?? authUser?.role ?? 'User'}
                  </p>
                  <div className="space-y-2">
                    {canOpenAdmin && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={onOpenAdmin}
                      >
                        Admin Panel
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => dispatch(logout())}
                    >
                      Logout
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </header>
        {boardError && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-2 text-sm text-red-700 flex items-center justify-between">
            <span>Sync error: {boardError}</span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void dispatch(fetchBoard());
                }}
              >
                Retry
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => dispatch(clearKanbanError())}
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {showFilters && (
          <div className="border-b border-gray-200 bg-white px-4 py-4 lg:px-6">
            <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                value={priorityFilter}
                onChange={(e) =>
                  setPriorityFilter(e.target.value as 'all' | Task['priority'])
                }
                className="border-input bg-white flex h-10 w-full rounded-[10px] border border-gray-200 px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:ring-[3px]"
              >
                <option value="all">All priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <select
                value={dueDateFilter}
                onChange={(e) =>
                  setDueDateFilter(
                    e.target.value as 'all' | 'overdue' | 'today' | 'this-week' | 'no-due-date',
                  )
                }
                className="border-input bg-white flex h-10 w-full rounded-[10px] border border-gray-200 px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:ring-[3px]"
              >
                <option value="all">All due dates</option>
                <option value="overdue">Overdue</option>
                <option value="today">Due today</option>
                <option value="this-week">Due this week</option>
                <option value="no-due-date">No due date</option>
              </select>

              <div className="flex items-center gap-2">
                <Input
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  placeholder="Filter by assignee"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => {
                    setPriorityFilter('all');
                    setDueDateFilter('all');
                    setAssigneeFilter('');
                  }}
                >
                  Clear filters
                </Button>
              </div>
            </div>
            </div>
          </div>
        )}

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto p-4 lg:p-6">
          {(boardLoading || boardSaving) && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {boardLoading && (
                <span className="inline-flex items-center rounded-full bg-white border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
                  Loading board...
                </span>
              )}
              {!boardLoading && boardHydrated && boardSaving && (
                <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                  Saving changes...
                </span>
              )}
            </div>
          )}
          <SortableContext
            items={filteredColumns.map((column) => column.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex gap-4 lg:gap-5 h-full min-w-max pb-2">
              {filteredColumns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  onOpenTask={openTaskDetails}
                  onEditTask={openEditTaskModal}
                  onAddComment={openTaskDetails}
                  isEditingTitle={editingColumnId === column.id}
                  tempTitle={editingColumnId === column.id ? tempTitle : ''}
                  onStartEditTitle={startEditColumnTitle}
                  onChangeTempTitle={setTempTitle}
                  onSaveTitle={saveEditColumnTitle}
                  onCancelEditTitle={cancelEditColumnTitle}
                  canRenameColumn={canManageColumns}
                  columnDragDisabled={!canManageColumns}
                  taskDragDisabled={!canMoveTasks}
                  canDeleteColumn={canManageColumns}
                  onDeleteColumn={requestDeleteColumn}
                />
              ))}
            </div>
          </SortableContext>

        </div>

        <TaskModal
          open={taskModalOpen}
          mode={taskModalMode}
          columnTitle={taskModalColumnTitle}
          initialDraft={taskModalInitialDraft}
          authToken={authToken}
          onClose={closeTaskModal}
          onSubmit={(draft, files) => {
            if (taskModalMode === 'create') {
              void createTask(taskModalColumnId, draft, files).finally(() => {
                closeTaskModal();
              });
              return;
            }

            if (taskModalTaskId) {
              updateTask(taskModalTaskId, draft);
              closeTaskModal();
            }
          }}
        />

        <TaskDetailsModal
          open={!!detailsTask}
          task={detailsTask}
          columns={columns}
          currentColumnId={detailsTaskColumnId}
          comments={detailsTask?.comments ?? []}
          onClose={() => {
            setDetailsTaskId(null);
          }}
          onSaveAll={saveTaskDetailsAll}
          onDownloadAllAttachments={downloadAllAttachments}
          authToken={authToken}
          canEditContent={detailsCanEditContent}
          canMoveBoard={detailsCanMove}
        />

        <DragOverlay>
          {activeTask ? (
            <div className="w-72">
              <TaskCard
                task={activeTask}
                columnId=""
                isDragOverlay
                onAddComment={openTaskDetails}
              />
            </div>
          ) : null}
        </DragOverlay>

        <AlertDialog
          open={!!columnToDelete}
          onOpenChange={(open) => {
            if (!open) setColumnToDelete(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete column?</AlertDialogTitle>
              <AlertDialogDescription>
                {columnToDelete
                  ? columnToDelete.taskCount > 0
                    ? `This will permanently delete "${columnToDelete.title}" and its ${columnToDelete.taskCount} task${
                        columnToDelete.taskCount === 1 ? '' : 's'
                      }. This action cannot be undone.`
                    : `This will permanently delete "${columnToDelete.title}". This action cannot be undone.`
                  : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={confirmDeleteColumn}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DndContext>
  );
}