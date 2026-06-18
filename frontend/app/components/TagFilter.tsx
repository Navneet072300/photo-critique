"use client";

interface Props {
  tags: string[];
  selectedTag: string | null;
  onSelect: (tag: string | null) => void;
}

export default function TagFilter({ tags, selectedTag, onSelect }: Props) {
  if (tags.length === 0) return null;

  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={[
          "rounded-full px-4 py-1 text-sm font-medium transition-colors",
          selectedTag === null
            ? "bg-blue-600 text-white"
            : "bg-gray-800 text-gray-300 hover:bg-gray-700",
        ].join(" ")}
      >
        All photos
      </button>

      {tags.map((tag) => (
        <button
          key={tag}
          onClick={() => onSelect(tag === selectedTag ? null : tag)}
          className={[
            "rounded-full px-4 py-1 text-sm font-medium transition-colors",
            selectedTag === tag
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700",
          ].join(" ")}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
