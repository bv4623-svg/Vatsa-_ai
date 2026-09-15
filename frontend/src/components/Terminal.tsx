"use client";

import { useState, useRef, useEffect } from "react";

export default function Terminal() {
  const [history, setHistory] = useState<string[]>(["$ Welcome to Vatsa AI Terminal"]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCommand = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    let output = "";
    if (trimmed === "help") {
      output = "Available commands: help, echo, ls, pwd, clear, whoami";
    } else if (trimmed === "ls") {
      output = "index.js  package.json  src/  README.md";
    } else if (trimmed === "pwd") {
      output = "/workspace/code";
    } else if (trimmed === "whoami") {
      output = "developer";
    } else if (trimmed === "clear") {
      setHistory([]);
      return;
    } else if (trimmed.startsWith("echo ")) {
      output = trimmed.slice(5);
    } else {
      output = `Command not found: ${trimmed}`;
    }
    setHistory((prev) => [...prev, `$ ${trimmed}`, output]);
    setInput("");
  };

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  return (
    <div className="h-full bg-black/80 text-green-400 font-mono text-sm p-2 overflow-y-auto" onClick={() => inputRef.current?.focus()}>
      {history.map((line, idx) => (
        <div key={idx} className="whitespace-pre-wrap">{line}</div>
      ))}
      <div className="flex items-center">
        <span>$ </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCommand(input); }}
          className="flex-1 bg-transparent border-none outline-none text-green-400"
          autoFocus
        />
      </div>
    </div>
  );
}