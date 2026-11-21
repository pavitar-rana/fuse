"use client";

import { useState } from "react";
import { Check, Copy, FileCode2, Globe, PauseCircle, Rocket, TerminalSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = "https://firecracker.pavitar.dev/api";
const AUTH = `  -H "Authorization: Bearer $FUSE_API_KEY" \\\n  -H "Content-Type: application/json" \\`;

const ITEMS = [
  {
    key: "lifecycle",
    icon: Rocket,
    title: "Create and delete",
    body: "Boot a microVM with optional vCPU and memory, and tear it down when you're done.",
    request: `curl -X POST ${BASE}/firecracker/create \\\n${AUTH}\n  -d '{"config":{"vcpuCount":2,"memSize":1024}}'`,
    response: `{\n  "message": "VM created",\n  "data": {\n    "id": "ck3f9q2x",\n    "status": "RUNNING",\n    "vmIp": "172.16.0.14",\n    "vCpu": 2,\n    "memSize": 1024\n  }\n}`,
  },
  {
    key: "exec",
    icon: TerminalSquare,
    title: "Run commands",
    body: "Run a shell command inside the VM. Each project gets its own directory under /root.",
    request: `curl -X POST ${BASE}/firecracker/exec/run \\\n${AUTH}\n  -d '{"id":"ck3f9q2x","projectId":"demo","command":"ls -la"}'`,
    response: `{\n  "message": "Command run successful",\n  "data": {\n    "result": "total 8\\ndrwxr-xr-x 2 root root ...",\n    "id": "ck3f9q2x"\n  }\n}`,
  },
  {
    key: "files",
    icon: FileCode2,
    title: "Write files",
    body: "Write a file into the project directory, or create directories, without opening a shell.",
    request: `curl -X POST ${BASE}/firecracker/exec/write \\\n${AUTH}\n  -d '{"id":"ck3f9q2x","projectId":"demo",\n       "path":"app.py","content":"print(\\"hi\\")"}'`,
    response: `{\n  "message": "Write file successful",\n  "data": { "result": "...", "id": "ck3f9q2x" }\n}`,
  },
  {
    key: "ports",
    icon: Globe,
    title: "Expose ports",
    body: "Start a server in the VM and get a public URL that forwards to its port.",
    request: `curl -X POST ${BASE}/firecracker/get-host \\\n${AUTH}\n  -d '{"id":"ck3f9q2x","port":3000}'`,
    response: `{\n  "message": "Got url",\n  "data": { "url": "http://firecracker.pavitar.dev:8004" }\n}`,
  },
  {
    key: "pause",
    icon: PauseCircle,
    title: "Pause and resume",
    body: "Snapshot memory and disk, free the host, and restore the VM exactly where it stopped.",
    request: `curl -X POST ${BASE}/firecracker/pause \\\n${AUTH}\n  -d '{"id":"ck3f9q2x"}'\n\ncurl -X POST ${BASE}/firecracker/resume \\\n${AUTH}\n  -d '{"id":"ck3f9q2x"}'`,
    response: `{\n  "message": "VM resumed",\n  "data": { "id": "ck3f9q2x", "status": "RUNNING", ... }\n}`,
  },
];

export const ApiExplorer = () => {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const item = ITEMS[active];

  const copy = async () => {
    await navigator.clipboard.writeText(item.request);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid border-t lg:grid-cols-[380px_minmax(0,1fr)]">
      <div role="tablist" aria-label="API features" className="divide-y border-b lg:border-b-0 lg:border-r">
        {ITEMS.map((it, i) => {
          const Icon = it.icon;
          const on = i === active;
          return (
            <button
              key={it.key}
              role="tab"
              aria-selected={on}
              onClick={() => setActive(i)}
              className={cn(
                "relative block w-full px-6 py-5 text-left transition-colors sm:px-8",
                on ? "bg-panel" : "hover:bg-[#0f0f0f]",
              )}
            >
              {on && <span className="absolute inset-y-0 left-0 w-[2px] bg-ember" aria-hidden="true" />}
              <span
                className={cn(
                  "flex items-center gap-2.5 font-mono text-[0.8rem] uppercase tracking-[0.05em]",
                  on ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", on && "text-ember")} aria-hidden="true" />
                {it.title}
              </span>
              <span
                className={cn(
                  "mt-2 block text-[0.88rem] leading-relaxed",
                  on ? "text-muted-foreground" : "text-dim",
                )}
              >
                {it.body}
              </span>
            </button>
          );
        })}
      </div>

      <div className="min-w-0 bg-[#0c0c0c]">
        <div className="flex h-10 items-center justify-between border-b px-5 font-mono text-[0.7rem]">
          <span className="flex items-center gap-4">
            <span className="border-b border-ember pb-[11px] pt-3 text-foreground">request.sh</span>
            <span className="text-dim">bash</span>
          </span>
          <button
            onClick={copy}
            className="flex items-center gap-1.5 uppercase tracking-[0.05em] text-dim hover:text-foreground"
          >
            {copied ? <Check className="h-3 w-3 text-ok" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="overflow-x-auto px-5 py-5 font-mono text-[0.76rem] leading-[1.75] text-[#d6d6d6]">
          <code>
            {item.request.split("\n").map((l, i) => (
              <span key={i} className="block">
                {l.startsWith("curl") ? (
                  <>
                    <span className="text-ember">curl</span>
                    {l.slice(4)}
                  </>
                ) : (
                  l
                )}
              </span>
            ))}
          </code>
        </pre>
        <div className="border-t">
          <p className="label-mono px-5 pt-4">Response · 2xx</p>
          <pre className="overflow-x-auto px-5 pb-6 pt-3 font-mono text-[0.76rem] leading-[1.75] text-muted-foreground">
            <code>{item.response}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
