import { PERMISSIONS } from '../constants/permissions';
import type { AuthContext } from '../middleware/rbac';
import { hasAnyPermission, hasPermission } from '../middleware/rbac';

export type BoardColumn = {
  id: string;
  title: string;
  color: string;
  tasks: BoardTask[];
};

export type BoardTask = {
  id: string;
  title?: string;
  description?: string;
  priority?: string;
  assignee?: string;
  createdBy?: string;
  dueDate?: string;
  tags?: string[];
  attachments?: unknown[];
  comments?: unknown[];
};

function columnSignature(cols: BoardColumn[]): string {
  return cols.map((c) => `${c.id}|${c.title}|${c.color}`).join(';;');
}

function flatten(
  cols: BoardColumn[],
): Map<string, { task: BoardTask; columnId: string }> {
  const m = new Map<string, { task: BoardTask; columnId: string }>();
  for (const col of cols) {
    for (const t of col.tasks ?? []) {
      m.set(t.id, { task: t, columnId: col.id });
    }
  }
  return m;
}

function taskContentKey(t: BoardTask): string {
  return JSON.stringify({
    title: t.title,
    description: t.description,
    priority: t.priority,
    assignee: t.assignee,
    createdBy: t.createdBy,
    dueDate: t.dueDate,
    tags: t.tags,
    att: Array.isArray(t.attachments) ? t.attachments.length : 0,
    com: Array.isArray(t.comments) ? t.comments.length : 0,
  });
}

export function ownsTask(ctx: AuthContext, task: BoardTask): boolean {
  const uid = (task.createdBy || '').trim();
  if (uid && uid === ctx.userId) return true;
  const a = (task.assignee || '').trim().toLowerCase();
  if (!a || a === 'unassigned') return false;
  if (a === ctx.name.trim().toLowerCase()) return true;
  if (a === ctx.email.trim().toLowerCase()) return true;
  return false;
}

function canDeleteTask(ctx: AuthContext, task: BoardTask): boolean {
  if (!hasPermission(ctx.permissions, PERMISSIONS.delete_task)) return false;
  if (hasPermission(ctx.permissions, PERMISSIONS.edit_task)) return true;
  return ownsTask(ctx, task);
}

function canEditTaskBody(ctx: AuthContext, task: BoardTask): boolean {
  if (hasPermission(ctx.permissions, PERMISSIONS.edit_task)) return true;
  if (hasPermission(ctx.permissions, PERMISSIONS.edit_own_task) && ownsTask(ctx, task)) return true;
  return false;
}

function canMoveTask(ctx: AuthContext): boolean {
  return (
    hasPermission(ctx.permissions, PERMISSIONS.move_task) ||
    hasPermission(ctx.permissions, PERMISSIONS.edit_task)
  );
}

/**
 * Throws if the user is not allowed to replace the board with `newColumns`.
 */
function forbidden(msg = 'Forbidden', status = 403): Error {
  const err = new Error(msg);
  (err as { status?: number }).status = status;
  return err;
}

export function assertBoardSaveAllowed(
  ctx: AuthContext,
  prevBoard: { columns?: BoardColumn[] } | null,
  newColumns: BoardColumn[],
): void {
  if (!hasPermission(ctx.permissions, PERMISSIONS.view_board)) {
    throw forbidden();
  }

  const canWrite = hasAnyPermission(ctx.permissions, [
    PERMISSIONS.create_task,
    PERMISSIONS.edit_task,
    PERMISSIONS.edit_own_task,
    PERMISSIONS.delete_task,
    PERMISSIONS.move_task,
    PERMISSIONS.manage_columns,
  ]);
  if (!canWrite) {
    throw forbidden();
  }

  const prevCols = Array.isArray(prevBoard?.columns) ? prevBoard!.columns! : [];
  const prevSig = columnSignature(prevCols);
  const nextSig = columnSignature(newColumns);

  if (prevSig !== nextSig && !hasPermission(ctx.permissions, PERMISSIONS.manage_columns)) {
    throw forbidden(`Missing permission: ${PERMISSIONS.manage_columns}`);
  }

  const prevFlat = flatten(prevCols);
  const nextFlat = flatten(newColumns);

  const prevIds = new Set(prevFlat.keys());
  const nextIds = new Set(nextFlat.keys());

  for (const id of nextIds) {
    if (!prevIds.has(id)) {
      if (!hasPermission(ctx.permissions, PERMISSIONS.create_task)) {
        throw forbidden();
      }
    }
  }

  for (const id of prevIds) {
    if (!nextIds.has(id)) {
      const prevEntry = prevFlat.get(id)!;
      if (!canDeleteTask(ctx, prevEntry.task)) {
        throw forbidden();
      }
    }
  }

  for (const id of nextIds) {
    if (!prevIds.has(id)) continue;
    const p = prevFlat.get(id)!;
    const n = nextFlat.get(id)!;
    if (p.columnId !== n.columnId) {
      if (!canMoveTask(ctx)) {
        throw forbidden();
      }
    }
    if (taskContentKey(p.task) !== taskContentKey(n.task)) {
      if (!canEditTaskBody(ctx, p.task) || !canEditTaskBody(ctx, n.task)) {
        throw forbidden();
      }
    }
  }
}

export function assertTaskAttachmentAllowed(ctx: AuthContext, task: BoardTask | undefined): void {
  if (!task) {
    throw forbidden('Not found', 404);
  }
  if (!hasPermission(ctx.permissions, PERMISSIONS.view_board)) {
    throw forbidden();
  }
  if (hasPermission(ctx.permissions, PERMISSIONS.edit_task)) return;
  if (hasPermission(ctx.permissions, PERMISSIONS.edit_own_task) && ownsTask(ctx, task)) return;
  throw forbidden();
}
