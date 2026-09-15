'use client';

import React from 'react';
import { MemoryManager } from '@/components/memory/MemoryManager';

export const MemorySettings: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <MemoryManager />
    </div>
  );
};