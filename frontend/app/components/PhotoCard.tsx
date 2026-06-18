"use client";

import { Photo } from "../types";

interface Props {
  photo: Photo;
  apiUrl: string;
  onTagClick: (tag: string) => void;
}

export default function PhotoCard({ photo, apiUrl, onTagClick }: Props) {
  return (
    <div className="flex gap-4 rounded-xl bg-gray-900 p-4 overflow-hidden">
      {/* Thumbnail */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${apiUrl}/uploads/${photo.filename}`}
        alt={photo.original_filename}
        className="h-48 w-48 flex-shrink-0 rounded-lg object-cover bg-gray-800"
      />

      {/* Details */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-sm text-gray-400" title={photo.original_filename}>
          {photo.original_filename}
        </p>

        {photo.status === "pending" && (
          <p className="mt-2 text-sm text-gray-500">Waiting to process…</p>
        )}

        {photo.status === "processing" && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-4 w-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin flex-shrink-0" />
            <p className="text-sm text-blue-400">Analyzing with AI…</p>
          </div>
        )}

        {photo.status === "done" && photo.critique && (
          <div className="mt-1 space-y-3">
            <div>
              <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Composition
              </p>
              <p className="text-sm leading-relaxed text-gray-200">
                {photo.critique.composition}
              </p>
            </div>

            <div>
              <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Exposure &amp; Lighting
              </p>
              <p className="text-sm leading-relaxed text-gray-200">
                {photo.critique.exposure}
              </p>
            </div>

            {photo.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {photo.tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => onTagClick(tag)}
                    className="rounded-full bg-blue-900/60 px-2.5 py-0.5 text-xs text-blue-200 hover:bg-blue-800 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {photo.status === "error" && (
          <p className="mt-2 text-sm text-red-400">
            Error: {photo.error_message ?? "Unknown error"}
          </p>
        )}
      </div>
    </div>
  );
}
