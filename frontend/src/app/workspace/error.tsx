"use client";

export default function WorkspaceError() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <h2 className="text-2xl font-bold text-red-400">Something went wrong</h2>
      <p className="text-gray-400 mt-2">We couldn’t load your workspace. Please try again.</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition"
      >
        Reload
      </button>
    </div>
  );
}