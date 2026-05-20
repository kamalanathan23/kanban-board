import React, { useEffect, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskCard } from './TaskCard';
import { Button } from './ui/button';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import type { Column } from './KanbanBoard';

function ColumnOptionsMenu({
  columnId,
  onDelete,
}: {
  columnId: string;
  onDelete: (columnId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    const timer = window.setTimeout(() => {
      window.addEventListener('pointerdown', onPointerDown, true);
    }, 0);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative" onPointerDown={(e) => e.stopPropagation()}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="p-1 h-7 w-7 shrink-0 text-gray-500 hover:text-gray-900"
        aria-label="Column options"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        <MoreHorizontal className="w-4 h-4" />
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-[250] mt-1 min-w-[10rem] rounded-xl border border-gray-200 bg-white p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-red-600 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onDelete(columnId);
            }}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface KanbanColumnProps {
  column: Column;
  onOpenTask?: (taskId: string) => void;
  onEditTask?: (taskId: string) => void;
  onAddComment?: (taskId: string) => void;
  isEditingTitle?: boolean;
  tempTitle?: string;
  onStartEditTitle?: (columnId: string, currentTitle: string) => void;
  onChangeTempTitle?: (value: string) => void;
  onSaveTitle?: (columnId: string) => void;
  onCancelEditTitle?: () => void;
  canRenameColumn?: boolean;
  columnDragDisabled?: boolean;
  taskDragDisabled?: boolean;
  canDeleteColumn?: boolean;
  onDeleteColumn?: (columnId: string) => void;
}

export function KanbanColumn({
  column,
  onOpenTask,
  onEditTask,
  onAddComment,
  isEditingTitle = false,
  tempTitle = '',
  onStartEditTitle,
  onChangeTempTitle,
  onSaveTitle,
  onCancelEditTitle,
  canRenameColumn = true,
  columnDragDisabled = false,
  taskDragDisabled = false,
  canDeleteColumn = false,
  onDeleteColumn,
}: KanbanColumnProps) {
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `column-${column.id}`,
    data: { type: 'column', columnId: column.id },
  });
  const {
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    disabled: true,
    data: { type: 'column-sort', columnId: column.id },
  });
  const setNodeRef = (node: HTMLDivElement | null) => {
    setDropRef(node);
    setSortableRef(node);
  };
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isEditingTitle) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [isEditingTitle]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex w-[min(100%,20rem)] sm:w-80 shrink-0 flex-col rounded-xl border border-gray-200 bg-gray-50/60 shadow-sm h-full max-h-full ${
        isDragging ? 'opacity-60' : ''
      }`}
    >
      <div className="shrink-0 rounded-t-xl border-b border-gray-200 bg-white px-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${column.color}`} />
            {isEditingTitle ? (
              <Input
                ref={titleInputRef}
                value={tempTitle}
                onChange={(e) => onChangeTempTitle?.(e.target.value)}
                className="h-8 px-2 py-1 text-sm font-semibold text-gray-900 w-40"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onSaveTitle?.(column.id);
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    onCancelEditTitle?.();
                  }
                }}
                onBlur={() => onSaveTitle?.(column.id)}
              />
            ) : onStartEditTitle && canRenameColumn ? (
              <button
                type="button"
                className="truncate text-left text-sm font-semibold text-gray-900 hover:text-primary"
                onClick={() => onStartEditTitle(column.id, column.title)}
              >
                {column.title}
              </button>
            ) : (
              <h3 className="truncate text-sm font-semibold text-gray-900">{column.title}</h3>
            )}
            <Badge
              variant="secondary"
              className="shrink-0 rounded-md bg-gray-100 text-gray-600 border-0 text-xs font-medium tabular-nums"
            >
              {column.tasks.length}
            </Badge>
          </div>
          {canDeleteColumn && onDeleteColumn ? (
            <ColumnOptionsMenu columnId={column.id} onDelete={onDeleteColumn} />
          ) : null}
        </div>
      </div>

      <div
        className={`kanban-column-scroll flex-1 min-h-0 space-y-3 overflow-y-auto p-3 ${
          isOver ? 'bg-emerald-50/80 ring-2 ring-inset ring-primary/30' : ''
        }`}
      >
        <SortableContext items={column.tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          {column.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              columnId={column.id}
              onOpenTask={onOpenTask}
              onEditTask={onEditTask}
              onAddComment={onAddComment}
              dragDisabled={taskDragDisabled}
            />
          ))}
        </SortableContext>

        {column.tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white/60 py-10 px-4 text-center">
            <p className="text-sm font-medium text-gray-500">No tasks yet</p>
            <p className="mt-1 text-xs text-gray-400">Drag a task here or add a new one</p>
          </div>
        )}
      </div>
    </div>
  );
}
