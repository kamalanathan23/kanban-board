import { createAsyncThunk, createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { API_BASE_URL } from '../config/api';

export { API_BASE_URL };

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  assignee: string;
  /** User id of creator — used for own-task RBAC. */
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
  comments?: Array<{
    id: string;
    author: string;
    text: string;
    timestamp: string;
  }>;
}

export interface Column {
  id: string;
  title: string;
  tasks: Task[];
  color: string;
}

export interface ActivityItem {
  id: string;
  type: 'task_created' | 'task_updated' | 'task_moved' | 'column_reordered' | 'task_commented';
  message: string;
  timestamp: string;
}

interface AuthSnapshot {
  token: string | null;
}

interface ColumnEntity {
  id: string;
  title: string;
  color: string;
  taskIds: string[];
}

interface KanbanState {
  columnsById: Record<string, ColumnEntity>;
  columnOrder: string[];
  tasksById: Record<string, Task>;
  activity: ActivityItem[];
  hydrated: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

export type TaskDraft = {
  title: string;
  description: string;
  priority: Task['priority'];
  assignee: string;
  dueDate?: string;
  tags: string[];
};

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
        tags: ['Design', 'UI/UX'],
      },
      {
        id: '2',
        title: 'API Integration',
        description: 'Integrate third-party payment API',
        priority: 'medium',
        assignee: 'Jane Smith',
        tags: ['Backend', 'API'],
      },
    ],
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
        tags: ['Mobile', 'React Native'],
      },
    ],
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
        tags: ['Code Review', 'QA'],
      },
    ],
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
        tags: ['Security', 'Backend'],
      },
    ],
  },
];

const normalizeColumns = (columns: Column[]) => {
  const columnsById: Record<string, ColumnEntity> = {};
  const tasksById: Record<string, Task> = {};
  const columnOrder: string[] = [];

  for (const column of columns) {
    columnOrder.push(column.id);
    columnsById[column.id] = {
      id: column.id,
      title: column.title,
      color: column.color,
      taskIds: column.tasks.map((task) => task.id),
    };

    for (const task of column.tasks) {
      tasksById[task.id] = task;
    }
  }

  return { columnsById, columnOrder, tasksById };
};

const denormalizeColumns = (state: KanbanState): Column[] =>
  state.columnOrder
    .map((columnId) => state.columnsById[columnId])
    .filter(Boolean)
    .map((column) => ({
      id: column.id,
      title: column.title,
      color: column.color,
      tasks: column.taskIds.map((taskId) => state.tasksById[taskId]).filter(Boolean),
    }));

const initialState: KanbanState = {
  ...normalizeColumns(initialColumns),
  activity: [],
  hydrated: false,
  loading: false,
  saving: false,
  error: null,
};

export const fetchBoard = createAsyncThunk<{ columns: Column[]; activity: ActivityItem[] }>(
  'kanban/fetchBoard',
  async (_arg, { getState }) => {
    const token = ((getState() as { auth?: AuthSnapshot }).auth?.token ?? null);
    if (!token) {
      throw new Error('Unauthorized');
    }

    const response = await fetch(`${API_BASE_URL}/board`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized');
      }
      throw new Error(`Failed to fetch board (${response.status})`);
    }

    const body = (await response.json()) as { columns?: Column[]; activity?: ActivityItem[] };
    return {
      columns: Array.isArray(body.columns) ? body.columns : [],
      activity: Array.isArray(body.activity) ? body.activity : [],
    };
  },
);

export const saveBoard = createAsyncThunk<void, void, { state: { kanban: KanbanState; auth: AuthSnapshot } }>(
  'kanban/saveBoard',
  async (_arg, { getState }) => {
    const token = getState().auth.token;
    if (!token) {
      throw new Error('Unauthorized');
    }

    const columns = denormalizeColumns(getState().kanban);
    const activity = getState().kanban.activity;
    const response = await fetch(`${API_BASE_URL}/board`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ columns, activity }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized');
      }
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(body.message ?? `Failed to save board (${response.status})`);
    }
  },
);

const kanbanSlice = createSlice({
  name: 'kanban',
  initialState,
  reducers: {
    addColumn: (state, action: PayloadAction<{ title: string }>) => {
      const title = action.payload.title.trim();
      if (!title) return;

      const id = `col-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      state.columnsById[id] = {
        id,
        title,
        color: 'bg-gray-500',
        taskIds: [],
      };
      state.columnOrder.push(id);
      state.activity.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'task_updated',
        message: `Added column "${title}"`,
        timestamp: new Date().toISOString(),
      });
      state.activity = state.activity.slice(0, 50);
    },
    renameColumn: (state, action: PayloadAction<{ columnId: string; title: string }>) => {
      const { columnId } = action.payload;
      const title = action.payload.title.trim();
      const column = state.columnsById[columnId];
      if (!column) return;
      if (!title) return;
      column.title = title;
    },
    deleteColumn: (state, action: PayloadAction<{ columnId: string }>) => {
      const { columnId } = action.payload;
      if (state.columnOrder.length <= 1) return;

      const column = state.columnsById[columnId];
      if (!column) return;

      const title = column.title;
      for (const taskId of column.taskIds) {
        delete state.tasksById[taskId];
      }
      delete state.columnsById[columnId];
      state.columnOrder = state.columnOrder.filter((id) => id !== columnId);
      state.activity.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'task_updated',
        message: `Deleted column "${title}"`,
        timestamp: new Date().toISOString(),
      });
      state.activity = state.activity.slice(0, 50);
    },
    addActivity: (state, action: PayloadAction<Omit<ActivityItem, 'id' | 'timestamp'>>) => {
      state.activity.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        ...action.payload,
      });
      state.activity = state.activity.slice(0, 50);
    },
    clearKanbanError: (state) => {
      state.error = null;
    },
    createTask: (
      state,
      action: PayloadAction<{ columnId: string; taskId?: string; draft: TaskDraft; createdBy?: string }>,
    ) => {
      const { columnId, taskId, draft, createdBy } = action.payload;
      const column = state.columnsById[columnId];
      if (!column) return;

      const id = (taskId?.trim() ? taskId.trim() : Date.now().toString());
      state.tasksById[id] = {
        id,
        attachments: [],
        comments: [],
        ...draft,
        ...(createdBy ? { createdBy } : {}),
      };
      column.taskIds.push(id);
      state.activity.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'task_created',
        message: `Created task "${draft.title}" in ${column.title}`,
        timestamp: new Date().toISOString(),
      });
      state.activity = state.activity.slice(0, 50);
    },
    updateTask: (
      state,
      action: PayloadAction<{ taskId: string; draft: TaskDraft }>,
    ) => {
      const { taskId, draft } = action.payload;
      const task = state.tasksById[taskId];
      if (!task) return;
      state.tasksById[taskId] = { ...task, ...draft };
      state.activity.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'task_updated',
        message: `Updated task "${draft.title}"`,
        timestamp: new Date().toISOString(),
      });
      state.activity = state.activity.slice(0, 50);
    },
    setTaskAttachments: (
      state,
      action: PayloadAction<{ taskId: string; attachments: NonNullable<Task['attachments']> }>,
    ) => {
      const { taskId, attachments } = action.payload;
      const task = state.tasksById[taskId];
      if (!task) return;
      state.tasksById[taskId] = { ...task, attachments };
    },
    addTaskComment: (
      state,
      action: PayloadAction<{ taskId: string; author: string; text: string }>,
    ) => {
      const { taskId, author, text } = action.payload;
      const task = state.tasksById[taskId];
      if (!task || !text.trim()) return;

      const nextComment = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        author: author.trim() || 'Unknown',
        text: text.trim(),
        timestamp: new Date().toISOString(),
      };
      const existingComments = Array.isArray(task.comments) ? task.comments : [];
      state.tasksById[taskId] = {
        ...task,
        comments: [...existingComments, nextComment],
      };

      state.activity.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'task_commented',
        message: `${nextComment.author} commented on "${task.title}"`,
        timestamp: new Date().toISOString(),
      });
      state.activity = state.activity.slice(0, 50);
    },
    moveTask: (
      state,
      action: PayloadAction<{
        taskId: string;
        sourceColumnId: string;
        targetColumnId: string;
        overTaskId?: string;
      }>,
    ) => {
      const { taskId, sourceColumnId, targetColumnId, overTaskId } = action.payload;
      const source = state.columnsById[sourceColumnId];
      const target = state.columnsById[targetColumnId];
      if (!source || !target) return;

      const sourceIndex = source.taskIds.indexOf(taskId);
      if (sourceIndex < 0) return;

      if (sourceColumnId === targetColumnId) {
        const targetIndex = overTaskId ? source.taskIds.indexOf(overTaskId) : source.taskIds.length - 1;
        if (targetIndex < 0 || targetIndex === sourceIndex) return;
        const [moved] = source.taskIds.splice(sourceIndex, 1);
        source.taskIds.splice(targetIndex, 0, moved);
        const taskTitle = state.tasksById[taskId]?.title ?? 'Task';
        state.activity.unshift({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'task_moved',
          message: `Reordered "${taskTitle}" in ${source.title}`,
          timestamp: new Date().toISOString(),
        });
        state.activity = state.activity.slice(0, 50);
        return;
      }

      source.taskIds.splice(sourceIndex, 1);
      const insertIndex = overTaskId ? target.taskIds.indexOf(overTaskId) : target.taskIds.length;
      target.taskIds.splice(insertIndex < 0 ? target.taskIds.length : insertIndex, 0, taskId);
      const taskTitle = state.tasksById[taskId]?.title ?? 'Task';
      state.activity.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'task_moved',
        message: `Moved "${taskTitle}" from ${source.title} to ${target.title}`,
        timestamp: new Date().toISOString(),
      });
      state.activity = state.activity.slice(0, 50);
    },
    reorderColumns: (
      state,
      action: PayloadAction<{ sourceColumnId: string; targetColumnId: string }>,
    ) => {
      const { sourceColumnId, targetColumnId } = action.payload;
      const fromIndex = state.columnOrder.indexOf(sourceColumnId);
      const toIndex = state.columnOrder.indexOf(targetColumnId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

      const [moved] = state.columnOrder.splice(fromIndex, 1);
      state.columnOrder.splice(toIndex, 0, moved);
      const columnTitle = state.columnsById[sourceColumnId]?.title ?? 'Column';
      state.activity.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'column_reordered',
        message: `Reordered column "${columnTitle}"`,
        timestamp: new Date().toISOString(),
      });
      state.activity = state.activity.slice(0, 50);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBoard.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBoard.fulfilled, (state, action) => {
        const incomingColumns =
          action.payload.columns.length > 0 ? action.payload.columns : initialColumns;
        const normalized = normalizeColumns(incomingColumns);
        state.columnsById = normalized.columnsById;
        state.columnOrder = normalized.columnOrder;
        state.tasksById = normalized.tasksById;
        state.activity = action.payload.activity;
        state.loading = false;
        state.hydrated = true;
      })
      .addCase(fetchBoard.rejected, (state, action) => {
        state.loading = false;
        state.hydrated = true;
        state.error = action.error.message ?? 'Failed to fetch board';
      })
      .addCase(saveBoard.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(saveBoard.fulfilled, (state) => {
        state.saving = false;
      })
      .addCase(saveBoard.rejected, (state, action) => {
        state.saving = false;
        state.error = action.error.message ?? 'Failed to save board';
      });
  },
});

export const {
  addColumn,
  addActivity,
  addTaskComment,
  clearKanbanError,
  createTask,
  deleteColumn,
  renameColumn,
  setTaskAttachments,
  updateTask,
  moveTask,
  reorderColumns,
} = kanbanSlice.actions;
export const kanbanReducer = kanbanSlice.reducer;
export const selectBoardColumns = createSelector(
  [
    (state: { kanban: KanbanState }) => state.kanban.columnsById,
    (state: { kanban: KanbanState }) => state.kanban.columnOrder,
    (state: { kanban: KanbanState }) => state.kanban.tasksById,
  ],
  (columnsById, columnOrder, tasksById) =>
    columnOrder
      .map((columnId) => columnsById[columnId])
      .filter(Boolean)
      .map((column) => ({
        id: column.id,
        title: column.title,
        color: column.color,
        tasks: column.taskIds.map((taskId) => tasksById[taskId]).filter(Boolean),
      })),
);
export const selectKanbanActivity = (state: { kanban: KanbanState }) => state.kanban.activity;
export const selectKanbanHydrated = (state: { kanban: KanbanState }) => state.kanban.hydrated;
export const selectKanbanLoading = (state: { kanban: KanbanState }) => state.kanban.loading;
export const selectKanbanSaving = (state: { kanban: KanbanState }) => state.kanban.saving;
export const selectKanbanError = (state: { kanban: KanbanState }) => state.kanban.error;
