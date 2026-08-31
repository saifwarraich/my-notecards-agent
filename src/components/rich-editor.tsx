"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { downscaleImage } from "@/lib/downscale";

/**
 * Tiptap editor. Emits both HTML (what we store and render) and plain text
 * (what the diff and the agent read).
 */
export function RichEditor({
  noteId,
  initialContent,
  onChange,
}: {
  noteId: string;
  initialContent: string;
  onChange: (value: { html: string; text: string }) => void;
}) {
  // ProseMirror's paste/drop handlers are built before `useEditor` returns, so
  // they reach the live instance through this ref rather than closing over it.
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Image.configure({ HTMLAttributes: { class: "rounded-md border" } }),
      Placeholder.configure({
        placeholder:
          "Write what you're learning. Paste screenshots too. Hit save — the agent reads what changed and makes cards.",
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: cn(
          "prose-editor min-h-64 w-full px-4 py-3 focus:outline-none",
          "text-base leading-relaxed",
        ),
      },
      handlePaste: (_view, event) => uploadFrom(event.clipboardData, noteId, editorRef),
      handleDrop: (_view, event) =>
        uploadFrom((event as DragEvent).dataTransfer, noteId, editorRef),
    },
    onUpdate: ({ editor }) =>
      onChange({ html: editor.getHTML(), text: editor.getText() }),
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  if (!editor) return <div className="min-h-64" />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0">
        <Toolbar editor={editor} noteId={noteId} />
      </div>
      <EditorContent editor={editor} className="min-h-0 flex-1 overflow-y-auto" />
    </div>
  );
}

function uploadFrom(
  transfer: DataTransfer | null,
  noteId: string,
  box: { current: Editor | null },
) {
  const files = Array.from(transfer?.files ?? []).filter((f) =>
    f.type.startsWith("image/"),
  );
  if (files.length === 0) return false;

  void (async () => {
    for (const file of files) {
      try {
        const body = new FormData();
        body.append("noteId", noteId);
        body.append("file", await downscaleImage(file));

        const res = await fetch("/api/images", { method: "POST", body });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) throw new Error(data.error ?? "upload failed");
        box.current?.chain().focus().setImage({ src: data.url }).run();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not upload image.",
        );
      }
    }
  })();

  return true; // We handled it; stop ProseMirror inlining the raw file.
}

function Toolbar({ editor, noteId }: { editor: Editor; noteId: string }) {
  const marks = [
    { icon: Bold, name: "bold", run: () => editor.chain().focus().toggleBold().run() },
    { icon: Italic, name: "italic", run: () => editor.chain().focus().toggleItalic().run() },
    {
      icon: UnderlineIcon,
      name: "underline",
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    { icon: Strikethrough, name: "strike", run: () => editor.chain().focus().toggleStrike().run() },
    { icon: Code, name: "code", run: () => editor.chain().focus().toggleCode().run() },
  ];

  const blocks = [
    {
      icon: Heading1,
      name: "heading",
      attrs: { level: 1 as const },
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      icon: Heading2,
      name: "heading",
      attrs: { level: 2 as const },
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    { icon: List, name: "bulletList", run: () => editor.chain().focus().toggleBulletList().run() },
    {
      icon: ListOrdered,
      name: "orderedList",
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    { icon: Quote, name: "blockquote", run: () => editor.chain().focus().toggleBlockquote().run() },
  ];

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1">
      {marks.map(({ icon: Icon, name, run }) => (
        <ToolButton key={name} active={editor.isActive(name)} onClick={run}>
          <Icon />
        </ToolButton>
      ))}
      <Separator orientation="vertical" className="mx-1 h-5" />
      {blocks.map(({ icon: Icon, name, attrs, run }, i) => (
        <ToolButton
          key={`${name}-${i}`}
          active={attrs ? editor.isActive(name, attrs) : editor.isActive(name)}
          onClick={run}
        >
          <Icon />
        </ToolButton>
      ))}
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ImageButton editor={editor} noteId={noteId} />
    </div>
  );
}

function ImageButton({ editor, noteId }: { editor: Editor; noteId: string }) {
  return (
    <label>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const list = e.target.files;
          if (!list?.length) return;
          const transfer = new DataTransfer();
          for (const file of list) transfer.items.add(file);
          uploadFrom(transfer, noteId, { current: editor });
          e.target.value = "";
        }}
      />
      <ToolButton asChild>
        <span>
          <ImagePlus />
        </span>
      </ToolButton>
    </label>
  );
}

function ToolButton({
  active,
  onClick,
  children,
  asChild,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  asChild?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      asChild={asChild}
      onClick={onClick}
      className={cn(
        "cursor-pointer",
        active && "bg-accent text-accent-foreground",
      )}
    >
      {children}
    </Button>
  );
}
