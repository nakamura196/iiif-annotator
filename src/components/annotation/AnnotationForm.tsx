"use client";

import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";

import ClientSideCustomEditor from "@/components/client-side-custom-editor";

import "ckeditor5/ckeditor5.css";
import "ckeditor5-premium-features/ckeditor5-premium-features.css";

interface AnnotationFormProps {
  id: string;
  text: string;
  onChange: (text: string) => void;
  onDelete: (ids: string[]) => void;
}

export function AnnotationForm({
  id,
  text,
  onChange,
  onDelete,
}: AnnotationFormProps) {
  // エディタの内容を保持するための状態
  const [editorContent, setEditorContent] = useState(text);

  useEffect(() => {
    setEditorContent(text);
  }, [text]);

  // フォーム送信時の処理
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onChange(editorContent);
  };

  return (
    <div className="p-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-6">
        Annotation Details
      </h3>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div>
          <ClientSideCustomEditor
            data={editorContent}
            onChange={(data) => setEditorContent(data)}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md 
              cursor-pointer hover:bg-blue-700 focus:outline-none 
              focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
              transition-colors duration-200 font-medium"
          >
            Save Changes
          </button>
          {id && (
            <button
              type="button"
              onClick={() => onDelete([id])}
              className="px-4 py-2 rounded-md text-sm font-medium
                transition-colors duration-150 ease-in-out
                cursor-pointer flex items-center justify-center
                bg-white border border-red-200 text-red-600
                hover:bg-red-50 focus:outline-none 
                focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
