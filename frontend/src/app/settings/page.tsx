import { MemorySettings } from '@/features/memory';

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-white mb-6">Settings</h1>
      
      {/* Other settings sections (profile, billing, etc.) yahan aa sakte hain */}
      
      {/* Memory Management Section */}
      <div className="mt-8 border-t border-gray-700 pt-6">
        <MemorySettings />
      </div>
    </div>
  );
}