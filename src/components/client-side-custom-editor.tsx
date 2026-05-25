"use client"; // Required only in App Router.

import dynamic from "next/dynamic";

interface EditorProps {
  data: string;
  onChange: (data: string) => void;
  placeholder?: string;
}

const ClientSideCustomEditor = dynamic<EditorProps>(
  () => import("@/components/custom-editor"),
  { ssr: false }
);

export default ClientSideCustomEditor;
