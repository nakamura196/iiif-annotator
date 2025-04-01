// components/custom-editor.js
"use client"; // Required only in App Router.

import { CKEditor } from "@ckeditor/ckeditor5-react";
import { ClassicEditor, Essentials, Paragraph, Bold, Italic } from "ckeditor5";
import { useEffect } from "react";

import "ckeditor5/ckeditor5.css";

function CustomEditor({
  data,
  onChange,
}: {
  data: string;
  onChange: (data: string) => void;
}) {
  // ダークモードのスタイルを動的に適用
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      /* エディタ本体 */
      .dark .ck.ck-editor__main > .ck-editor__editable {
        background-color: rgb(31 41 55) !important;
        color: rgb(229 231 235) !important;
        border-color: rgb(75 85 99) !important;
      }

      /* ツールバー */
      .dark .ck.ck-toolbar {
        background-color: rgb(55 65 81) !important;
        border-color: rgb(75 85 99) !important;
      }

      /* ツールバーボタン */
      .dark .ck.ck-button {
        color: rgb(229 231 235) !important;
      }

      .dark .ck.ck-button:not(.ck-disabled):hover {
        background-color: rgb(75 85 99) !important;
      }

      /* アクティブなボタン */
      .dark .ck.ck-button.ck-on {
        background-color: rgb(37 99 235) !important;
        color: white !important;
      }

      /* フォーカス時のボーダー */
      .dark .ck.ck-editor__editable.ck-focused {
        border-color: rgb(59 130 246) !important;
      }

      /* プレースホルダー */
      .dark .ck.ck-editor__editable > .ck-placeholder::before {
        color: rgb(156 163 175) !important;
      }

      /* 区切り線 */
      .dark .ck.ck-toolbar__separator {
        background-color: rgb(75 85 99) !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="prose dark:prose-invert max-w-none">
      <CKEditor
        editor={ClassicEditor}
        config={{
          licenseKey: "GPL",
          plugins: [Essentials, Paragraph, Bold, Italic],
          toolbar: ["undo", "redo", "|", "bold", "italic"],
          placeholder: "テキストを入力してください...",
        }}
        data={data}
        onChange={(_, editor) => {
          const data = editor.getData();
          onChange(data);
        }}
      />
    </div>
  );
}

export default CustomEditor;
