"use client";

import { useRef, useState, DragEvent, ChangeEvent } from "react";

interface Props {
  onUpload: (files: File[]) => void;
  uploading: boolean;
}

export default function UploadZone({ onUpload, uploading }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length > 0) onUpload(files);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onUpload(files);
    // reset so the same files can be re-selected if needed
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div
      onClick={() => !uploading && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!uploading) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={[
        "rounded-xl border-2 border-dashed p-12 text-center transition-colors select-none",
        uploading
          ? "cursor-not-allowed border-gray-700 opacity-60"
          : dragging
          ? "cursor-copy border-blue-400 bg-blue-950/30"
          : "cursor-pointer border-gray-700 hover:border-gray-500",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />

      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
          <p className="text-gray-400">Uploading and queuing analysis…</p>
        </div>
      ) : (
        <>
          <p className="text-lg font-medium text-gray-200">
            Drop photos here or click to select
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Select multiple images at once — each will be critiqued individually
          </p>
        </>
      )}
    </div>
  );
}
