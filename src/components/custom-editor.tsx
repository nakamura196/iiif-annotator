// components/custom-editor.js
"use client"; // Required only in App Router.

import { CKEditor } from "@ckeditor/ckeditor5-react";
import { ClassicEditor, Essentials, Paragraph, Bold, Italic } from "ckeditor5";

import "ckeditor5/ckeditor5.css";

function CustomEditor({
  data,
  onChange,
}: {
  data: string;
  onChange: (data: string) => void;
}) {
  return (
    <CKEditor
      editor={ClassicEditor}
      config={{
        licenseKey: "GPL", // Or 'GPL'.
        plugins: [Essentials, Paragraph, Bold, Italic],
        toolbar: ["undo", "redo", "|", "bold", "italic"],
      }}
      data={data}
      onChange={(_, editor) => {
        const data = editor.getData();
        onChange(data);
      }}
    />
  );
}

export default CustomEditor;
