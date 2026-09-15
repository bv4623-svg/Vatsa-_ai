'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useMemoryStore } from '@/stores/memoryStore';

export const MemoryClearConfirm: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { clearAll } = useMemoryStore();

  const handleClear = async () => {
    await clearAll();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-950/30">
          Clear All Memory
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle>⚠️ Clear All Memory?</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-gray-300">This will permanently delete all your saved AI memories. This cannot be undone.</p>
          <div className="flex gap-4 mt-6">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleClear}>Yes, Clear All</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};