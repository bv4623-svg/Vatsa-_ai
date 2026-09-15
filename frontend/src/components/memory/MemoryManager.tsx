'use client';

import React, { useEffect } from 'react';
import { useMemoryStore } from '@/stores/memoryStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { MemoryClearConfirm } from './MemoryClearConfirm';
import { MemoryEditor } from './MemoryEditor';

export const MemoryManager: React.FC = () => {
  const { memories, isLoading, fetchMemories, deleteMemory } = useMemoryStore();

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  if (isLoading) return <div className="p-4 text-gray-400">Loading memories...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">AI Memory</h2>
        <MemoryClearConfirm />
      </div>
      <p className="text-sm text-gray-400">AI automatically remembers useful facts. You can edit or delete them.</p>
      
      {memories.length === 0 ? (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="pt-6 text-center text-gray-500">
            No memories saved yet. AI will learn as you chat!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {memories.map((mem) => (
            <Card key={mem.id} className="bg-gray-800/50 border-gray-700 hover:border-purple-500/50 transition-colors">
              <CardContent className="p-4 flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      mem.type === 'permanent' ? 'bg-blue-500/20 text-blue-300' :
                      mem.type === 'project' ? 'bg-green-500/20 text-green-300' :
                      'bg-yellow-500/20 text-yellow-300'
                    }`}>
                      {mem.type}
                    </span>
                    {mem.category && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
                        {mem.category}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 ml-auto">
                      Confidence: {(mem.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-gray-200 break-words">{mem.content}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <MemoryEditor memory={mem} />
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                    onClick={() => deleteMemory(mem.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};