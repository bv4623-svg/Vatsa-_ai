'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Note: Ensure you have Textarea component, or use a regular textarea
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Edit } from 'lucide-react';
import { useMemoryStore, Memory } from '@/stores/memoryStore';

interface Props {
  memory: Memory;
}

export const MemoryEditor: React.FC<Props> = ({ memory }) => {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(memory.content);
  const [confidence, setConfidence] = useState(memory.confidence);
  const { updateMemory } = useMemoryStore();

  const handleSave = async () => {
    await updateMemory(memory.id, { content, confidence });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle>Edit Memory</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm text-gray-400">Content</label>
            <Textarea 
              value={content} 
              onChange={(e) => setContent(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white mt-1"
              rows={3}
            />
          </div>
          <div>
            <label className="text-sm text-gray-400">Confidence (0.0 - 1.0)</label>
            <Input 
              type="number" 
              step="0.01" 
              min="0" 
              max="1"
              value={confidence} 
              onChange={(e) => setConfidence(parseFloat(e.target.value))}
              className="bg-gray-800 border-gray-700 text-white mt-1"
            />
          </div>
          <Button onClick={handleSave} className="w-full bg-purple-600 hover:bg-purple-700">
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};