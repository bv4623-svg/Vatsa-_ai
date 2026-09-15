import React from 'react';
import { Brain } from 'lucide-react';

export const MemoryIndicator: React.FC<{ count: number }> = ({ count }) => {
  if (count === 0) return null;
  return (
    <div className="inline-flex items-center gap-1 text-xs text-purple-400 bg-purple-950/30 px-2 py-1 rounded-full">
      <Brain className="h-3 w-3" />
      <span>{count} memories used</span>
    </div>
  );
};