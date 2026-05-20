import { Schema, model, type InferSchemaType } from 'mongoose';

const attachmentSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
    uploadedAt: { type: String, required: true },
  },
  { _id: false },
);

const taskSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], required: true },
    /** User id who created the task (for edit_own_task / delete ownership). */
    createdBy: { type: String, default: '' },
    assignee: { type: String, required: true },
    avatar: { type: String, default: '' },
    dueDate: { type: String },
    tags: { type: [String], default: [] },
    attachments: { type: [attachmentSchema], default: [] },
    comments: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            author: { type: String, required: true },
            text: { type: String, required: true },
            timestamp: { type: String, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { _id: false },
);

const columnSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    color: { type: String, required: true },
    tasks: { type: [taskSchema], default: [] },
  },
  { _id: false },
);

const activitySchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: String, required: true },
  },
  { _id: false },
);

const boardSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    columns: { type: [columnSchema], default: [] },
    activity: { type: [activitySchema], default: [] },
    /** Tracks auto-seeded demo template; bumped in demoBoard.ts to refresh demo-only boards. */
    demoSeedVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  },
);

export type BoardDocument = InferSchemaType<typeof boardSchema>;
export const BoardModel = model('Board', boardSchema);
