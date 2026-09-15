"use client";

import { useEffect } from "react";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export default function BuildingScreen() {
  const { terminalLogs, buildStatus } = useWorkspaceStore();

  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <div className="w-full max-w-3xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <h2 className="text-2xl font-semibold">Building your project...</h2>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 h-80 overflow-y-auto font-mono text-sm">
          {terminalLogs.length === 0 ? (
            <p className="text-gray-400">Waiting for logs...</p>
          ) : (
            terminalLogs.map((log, i) => (
              <div key={i} className="whitespace-pre-wrap">{log}</div>
            ))
          )}
          {buildStatus === "success" && (
            <div className="text-green-400 mt-2">✅ Build succeeded!</div>
          )}
          {buildStatus === "error" && (
            <div className="text-red-400 mt-2">❌ Build failed. Fixing...</div>
          )}
        </div>
      </div>
    </div>
  );
}