import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Pencil, X } from 'lucide-react';
import { Button } from './ui/button';

type DescriptionEditorProps = {
  value: string;
  onSave: (nextValue: string) => void;
  placeholder?: string;
  alwaysEditing?: boolean;
  onChange?: (nextValue: string) => void;
};

const sanitizeHtml = (html: string) =>
  html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '');

const getPlainText = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim();

export function DescriptionEditor({
  value,
  onSave,
  placeholder = 'Improve description...',
  alwaysEditing = false,
  onChange,
}: DescriptionEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const quillRef = useRef<ReactQuill | null>(null);

  useEffect(() => {
    if (alwaysEditing) return;
    if (!isEditing) setDraft(value || '');
  }, [value, isEditing, alwaysEditing]);

  const modules = useMemo(
    () => ({
      toolbar: alwaysEditing || isEditing
        ? {
            container: [
              [{ header: [1, 2, 3, false] }],
              ['bold', 'italic'],
              [{ list: 'ordered' }, { list: 'bullet' }],
              ['link', 'image'],
              ['emoji'],
            ],
            handlers: {
              emoji: () => {
                const editor = quillRef.current?.getEditor();
                if (!editor) return;
                const range = editor.getSelection(true);
                const index = range?.index ?? editor.getLength();
                editor.insertText(index, '🙂');
                editor.setSelection(index + 2, 0);
              },
            },
          }
        : false,
    }),
    [alwaysEditing, isEditing],
  );

  const formats = useMemo(
    () => ['header', 'bold', 'italic', 'list', 'bullet', 'link', 'image'],
    [],
  );

  const safeHtml = sanitizeHtml(value || '');
  const isEmpty = getPlainText(safeHtml).length === 0;
  const quillValue = alwaysEditing ? value || '' : draft;

  return (
    <div className="rounded-md border border-gray-200 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Description</h3>
        {alwaysEditing ? null : !isEditing ? (
          <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDraft(value || '');
                setIsEditing(false);
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onSave(draft);
                setIsEditing(false);
              }}
            >
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </div>
        )}
      </div>

      {alwaysEditing ? (
        <div className="space-y-2">
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={quillValue}
            onChange={(next) => onChange?.(next)}
            modules={modules}
            formats={formats}
            placeholder={placeholder}
          />
          <style>{`
            .ql-toolbar.ql-snow {
              border-radius: 0.5rem 0.5rem 0 0;
              border-color: #e5e7eb;
            }
            .ql-container.ql-snow {
              border-radius: 0 0 0.5rem 0.5rem;
              border-color: #e5e7eb;
            }
            .ql-container,
            .ql-editor {
              font-family: var(--font-sans);
            }
            .ql-editor {
              min-height: 10rem;
            }
            .ql-formats .ql-emoji::before {
              content: "🙂";
              font-size: 14px;
            }
          `}</style>
        </div>
      ) : !isEditing ? (
        isEmpty ? (
          <p className="text-sm italic text-gray-500">{placeholder}</p>
        ) : (
          <div
            className="prose prose-sm max-w-none text-gray-700"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        )
      ) : (
        <div className="space-y-2">
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={draft}
            onChange={(next) => {
              setDraft(next);
            }}
            modules={modules}
            formats={formats}
            placeholder={placeholder}
          />
          <style>{`
            .ql-toolbar.ql-snow {
              border-radius: 0.5rem 0.5rem 0 0;
              border-color: #e5e7eb;
            }
            .ql-container.ql-snow {
              border-radius: 0 0 0.5rem 0.5rem;
              border-color: #e5e7eb;
            }
            .ql-container,
            .ql-editor {
              font-family: var(--font-sans);
            }
            .ql-editor {
              min-height: 10rem;
            }
            .ql-formats .ql-emoji::before {
              content: "🙂";
              font-size: 14px;
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
