import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from './ui/badge';
import { Calendar, MessageCircle, Paperclip } from 'lucide-react';
import type { Task } from './KanbanBoard';

function plainTextFromHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface TaskCardProps {
  task: Task;
  columnId: string;
  onOpenTask?: (taskId: string) => void;
  onEditTask?: (taskId: string) => void;
  onAddComment?: (taskId: string) => void;
  isDragOverlay?: boolean;
  dragDisabled?: boolean;
}

export function TaskCard({
  task,
  columnId,
  onOpenTask,
  onEditTask,
  onAddComment,
  isDragOverlay = false,
  dragDisabled = false,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: isDragOverlay ? `overlay-${task.id}` : task.id,
    disabled: isDragOverlay || dragDisabled,
    data: {
      type: 'task',
      taskId: task.id,
      columnId,
    },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-50 text-red-700 border-red-100';
      case 'medium':
        return 'bg-amber-50 text-amber-800 border-amber-100';
      case 'low':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };
  const assigneeInitial = task.assignee.trim().charAt(0).toUpperCase() || '?';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(!isDragOverlay ? attributes : {})}
      {...(!isDragOverlay ? listeners : {})}
      className={`group rounded-xl border border-gray-200 bg-white p-4 cursor-pointer shadow-sm transition-all hover:border-gray-300 hover:shadow-md ${
        isDragging && !isDragOverlay ? 'opacity-50 ring-2 ring-primary/20' : ''
      } ${isDragOverlay ? 'shadow-lg ring-2 ring-primary/30' : ''}`}
      onClick={() => {
        if (!isDragOverlay) onOpenTask?.(task.id);
      }}
      onDoubleClick={() => {
        if (!isDragOverlay) onEditTask?.(task.id);
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <Badge
          variant="outline"
          className={`text-[10px] font-semibold uppercase tracking-wide ${getPriorityColor(task.priority)}`}
        >
          {task.priority}
        </Badge>
        {task.dueDate && (
          <div className="flex shrink-0 items-center gap-1 text-xs text-gray-500">
            <Calendar className="h-3 w-3" />
            <span>{new Date(task.dueDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      <h4 className="mb-1.5 line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-primary transition-colors">
        {task.title}
      </h4>
      {plainTextFromHtml(task.description) && (
        <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-gray-500">
          {plainTextFromHtml(task.description)}
        </p>
      )}

      {task.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {task.tags.map((tag, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="rounded-md border border-gray-200 bg-gray-50 text-[10px] font-medium text-gray-600"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">
            {assigneeInitial}
          </div>
          <span className="truncate text-xs font-medium text-gray-600">{task.assignee}</span>
        </div>

        <div className="flex items-center gap-2.5 text-gray-400">
          <button
            type="button"
            className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-gray-50 hover:text-gray-600"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (!isDragOverlay) {
                onAddComment?.(task.id);
                onOpenTask?.(task.id);
              }
            }}
            aria-label={`Open comments for ${task.title}`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="text-[10px] font-medium tabular-nums">{task.comments?.length ?? 0}</span>
          </button>
          <div className="flex items-center gap-1 px-1">
            <Paperclip className="h-3.5 w-3.5" />
            <span className="text-[10px] font-medium tabular-nums">{task.attachments?.length ?? 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
