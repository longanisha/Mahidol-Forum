import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { useState } from 'react'

type RichTextEditorProps = {
  content: string
  onChange: (content: string) => void
  placeholder?: string
}

export function RichTextEditor({ content, onChange, placeholder = 'Write your post content here...' }: RichTextEditorProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // Disable code block
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-accent underline',
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[300px] p-4 max-w-none rich-text-editor',
      },
    },
  })

  if (!editor) {
    return null
  }

  const ToolbarButton = ({ onClick, isActive, children, title }: { onClick: () => void; isActive?: boolean; children: React.ReactNode; title?: string }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-2 rounded hover:bg-primary/10 transition ${
        isActive ? 'bg-primary/20 text-primary' : 'text-primary/70'
      }`}
    >
      {children}
    </button>
  )

  const insertImage = () => {
    const url = window.prompt('Enter image URL:')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

  const insertLink = () => {
    const url = window.prompt('Enter URL:')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }


  return (
    <div className={`border border-primary/15 rounded-xl bg-white ${isFullscreen ? 'fixed inset-0 z-50 m-0 rounded-none' : ''}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-primary/10 bg-gray-50 flex-wrap">
        {/* Text Formatting Group */}
        <div className="flex items-center gap-1 border-r border-primary/10 pr-2 mr-2">
          <select
            className="px-2 py-1 text-sm border border-primary/15 rounded bg-white text-primary/70"
            onChange={(e) => {
              const value = e.target.value
              if (value === 'paragraph') {
                editor.chain().focus().setParagraph().run()
              } else if (value.startsWith('heading')) {
                const level = parseInt(value.replace('heading', '')) as 1 | 2 | 3 | 4 | 5 | 6
                editor.chain().focus().toggleHeading({ level }).run()
              }
            }}
            value={
              editor.isActive('heading', { level: 1 })
                ? 'heading1'
                : editor.isActive('heading', { level: 2 })
                  ? 'heading2'
                  : editor.isActive('heading', { level: 3 })
                    ? 'heading3'
                    : 'paragraph'
            }
          >
            <option value="paragraph">Normal</option>
            <option value="heading1">Heading 1</option>
            <option value="heading2">Heading 2</option>
            <option value="heading3">Heading 3</option>
          </select>
        </div>

        <div className="flex items-center gap-1 border-r border-primary/10 pr-2 mr-2">
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold">
            <span className="font-bold">B</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic">
            <span className="italic">I</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline">
            <span className="underline">U</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Strikethrough">
            <span className="line-through">S</span>
          </ToolbarButton>
        </div>

        {/* Alignment Group */}
        <div className="flex items-center gap-1 border-r border-primary/10 pr-2 mr-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            isActive={editor.isActive({ textAlign: 'left' })}
            title="Align Left"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="2" y1="4" x2="14" y2="4" />
              <line x1="2" y1="8" x2="14" y2="8" />
              <line x1="2" y1="12" x2="10" y2="12" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            isActive={editor.isActive({ textAlign: 'center' })}
            title="Align Center"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="2" y1="4" x2="14" y2="4" />
              <line x1="2" y1="8" x2="14" y2="8" />
              <line x1="2" y1="12" x2="10" y2="12" />
              <circle cx="8" cy="4" r="1" fill="currentColor" />
              <circle cx="8" cy="8" r="1" fill="currentColor" />
              <circle cx="8" cy="12" r="1" fill="currentColor" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            isActive={editor.isActive({ textAlign: 'right' })}
            title="Align Right"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="2" y1="4" x2="14" y2="4" />
              <line x1="2" y1="8" x2="14" y2="8" />
              <line x1="6" y1="12" x2="14" y2="12" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            isActive={editor.isActive({ textAlign: 'justify' })}
            title="Justify"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="2" y1="4" x2="14" y2="4" />
              <line x1="2" y1="6" x2="14" y2="6" />
              <line x1="2" y1="8" x2="14" y2="8" />
              <line x1="2" y1="10" x2="14" y2="10" />
              <line x1="2" y1="12" x2="14" y2="12" />
            </svg>
          </ToolbarButton>
        </div>

        {/* List & Blockquote Group */}
        <div className="flex items-center gap-1 border-r border-primary/10 pr-2 mr-2">
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="2" cy="4" r="1" fill="currentColor" />
              <circle cx="2" cy="8" r="1" fill="currentColor" />
              <circle cx="2" cy="12" r="1" fill="currentColor" />
              <line x1="5" y1="4" x2="14" y2="4" />
              <line x1="5" y1="8" x2="14" y2="8" />
              <line x1="5" y1="12" x2="14" y2="12" />
            </svg>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered List">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <text x="2" y="12" fontSize="10" fill="currentColor">1.</text>
              <text x="2" y="12" fontSize="10" fill="currentColor" dy="4">2.</text>
              <text x="2" y="12" fontSize="10" fill="currentColor" dy="8">3.</text>
              <line x1="5" y1="4" x2="14" y2="4" />
              <line x1="5" y1="8" x2="14" y2="8" />
              <line x1="5" y1="12" x2="14" y2="12" />
            </svg>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Blockquote">
            <span className="text-lg">"</span>
          </ToolbarButton>
        </div>

        {/* Media Insertion Group */}
        <div className="flex items-center gap-1 border-r border-primary/10 pr-2 mr-2">
          <ToolbarButton onClick={insertImage} title="Insert Image">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="12" height="12" />
              <circle cx="5" cy="5" r="1.5" fill="currentColor" />
              <path d="M2 10l4-4 3 3 5-5v7H2z" />
            </svg>
          </ToolbarButton>
          <ToolbarButton onClick={insertLink} isActive={editor.isActive('link')} title="Insert Link">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="6" cy="8" r="2" />
              <circle cx="10" cy="8" r="2" />
              <line x1="6" y1="8" x2="10" y2="8" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().deleteSelection().run()}
            title="Delete"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </ToolbarButton>
        </div>

        {/* Action & View Group */}
        <div className="flex items-center gap-1 ml-auto">
          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8l4-4v3h4v2H8v3z" />
            </svg>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8l-4-4v3H4v2h4v3z" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {
              const preview = window.open('', '_blank')
              if (preview) {
                preview.document.write(`
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <title>Preview</title>
                      <style>
                        body { font-family: system-ui; padding: 2rem; max-width: 800px; margin: 0 auto; }
                      </style>
                    </head>
                    <body>
                      ${editor.getHTML()}
                    </body>
                  </html>
                `)
              }
            }}
            title="Preview"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="2" fill="currentColor" />
              <path d="M8 4C5 4 2.5 6 1 8c1.5 2 4 4 7 4s5.5-2 7-4c-1.5-2-4-4-7-4z" />
            </svg>
          </ToolbarButton>
          <ToolbarButton onClick={() => setIsFullscreen(!isFullscreen)} isActive={isFullscreen} title="Fullscreen">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 2h4v2H4v2H2zM10 2h4v2h-2v2h-2zM2 10h2v2h2v2H2zM10 10h2v2h2v2h-4z" />
            </svg>
          </ToolbarButton>
        </div>
      </div>

      {/* Editor Content */}
      <div className="relative">
        <style>{`
          .rich-text-editor .ProseMirror h1 {
            font-size: 2.25em;
            font-weight: 800;
            line-height: 1.2;
            margin-top: 0;
            margin-bottom: 0.8888889em;
            color: rgb(17 24 39);
          }
          .rich-text-editor .ProseMirror h2 {
            font-size: 1.5em;
            font-weight: 700;
            line-height: 1.3;
            margin-top: 2em;
            margin-bottom: 1em;
            color: rgb(17 24 39);
          }
          .rich-text-editor .ProseMirror h3 {
            font-size: 1.25em;
            font-weight: 600;
            line-height: 1.4;
            margin-top: 1.6em;
            margin-bottom: 0.6em;
            color: rgb(17 24 39);
          }
          .rich-text-editor .ProseMirror h4 {
            font-size: 1em;
            font-weight: 600;
            line-height: 1.5;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            color: rgb(17 24 39);
          }
          .rich-text-editor .ProseMirror h5 {
            font-size: 0.875em;
            font-weight: 600;
            line-height: 1.5;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            color: rgb(17 24 39);
          }
          .rich-text-editor .ProseMirror h6 {
            font-size: 0.75em;
            font-weight: 600;
            line-height: 1.5;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            color: rgb(17 24 39);
          }
          .rich-text-editor .ProseMirror code {
            background-color: rgb(243 244 246);
            color: rgb(220 38 38);
            padding: 0.125rem 0.25rem;
            border-radius: 0.25rem;
            font-size: 0.875em;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          }
          .rich-text-editor .ProseMirror pre {
            background-color: rgb(17 24 39);
            color: rgb(243 244 246);
            padding: 1rem;
            border-radius: 0.5rem;
            overflow-x: auto;
            margin-top: 1.25em;
            margin-bottom: 1.25em;
          }
                 .rich-text-editor .ProseMirror pre code {
                   background-color: transparent;
                   color: inherit;
                   padding: 0;
                   border-radius: 0;
                   font-size: 0.875em;
                 }
        `}</style>
        <EditorContent editor={editor} />
        {!editor.getText() && (
          <div className="absolute top-4 left-4 text-primary/40 pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  )
}

