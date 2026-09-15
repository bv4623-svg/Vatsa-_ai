import Link from "next/link";

export default function WorkspaceNotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <h2 className="text-4xl font-bold text-white">404</h2>
      <p className="text-gray-400 mt-2">Workspace not found.</p>
      <Link
        href="/workspace/code"
        className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition"
      >
        Go to Code Workspace
      </Link>
    </div>
  );
}