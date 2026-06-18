"use client";

import { useState, useEffect, useCallback } from "react";
import { Photo } from "./types";
import UploadZone from "./components/UploadZone";
import PhotoCard from "./components/PhotoCard";
import TagFilter from "./components/TagFilter";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Home() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/photos`);
      if (!res.ok) return;
      setPhotos(await res.json());
    } catch {
      // backend not yet running — silently ignore
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  // Poll every 2 s while any photo is still being processed
  useEffect(() => {
    const hasPending = photos.some(
      (p) => p.status === "pending" || p.status === "processing"
    );
    if (!hasPending) return;

    const id = setInterval(fetchPhotos, 2000);
    return () => clearInterval(id);
  }, [photos, fetchPhotos]);

  async function handleUpload(files: File[]) {
    setUploading(true);
    try {
      const body = new FormData();
      files.forEach((f) => body.append("files", f));
      const res = await fetch(`${API_URL}/upload`, { method: "POST", body });
      if (!res.ok) throw new Error(await res.text());
      // Refresh immediately so the new cards appear in pending state
      await fetchPhotos();
    } catch (err) {
      alert(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  }

  // Derive unique tag list from the full photo set (client-side, no extra request)
  const allTags = Array.from(
    new Set(photos.flatMap((p) => p.tags))
  ).sort();

  const displayedPhotos =
    selectedTag === null
      ? photos
      : photos.filter((p) => p.tags.includes(selectedTag));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">
        Photo Critique Library
      </h1>
      <p className="mb-8 text-sm text-gray-500">
        Upload photos to get AI composition critiques and mood tags, powered by{" "}
        {process.env.NEXT_PUBLIC_OLLAMA_MODEL ?? "gemma4:26b"} via Ollama.
      </p>

      <UploadZone onUpload={handleUpload} uploading={uploading} />

      <TagFilter
        tags={allTags}
        selectedTag={selectedTag}
        onSelect={setSelectedTag}
      />

      <div className="mt-8 flex flex-col gap-4">
        {displayedPhotos.length === 0 && !uploading && (
          <p className="text-center text-gray-600">
            {selectedTag
              ? `No photos tagged "${selectedTag}".`
              : "No photos yet — drop some above to get started."}
          </p>
        )}

        {displayedPhotos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            apiUrl={API_URL}
            onTagClick={(tag) =>
              setSelectedTag((prev) => (prev === tag ? null : tag))
            }
          />
        ))}
      </div>
    </main>
  );
}
