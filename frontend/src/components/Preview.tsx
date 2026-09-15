"use client";

interface PreviewProps {
  src?: string | null;
}

export default function Preview({ src }: PreviewProps) {
  if (!src) {
    return <div className="flex h-full items-center justify-center text-sm text-gray-400">Preview will appear here</div>;
  }

  return <iframe title="Project preview" src={src} className="h-full w-full border-0" />;
}
