"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

type Line =
  | { kind: "cmd"; text: string }
  | { kind: "cont"; text: string }
  | { kind: "log"; step: string; detail?: string }
  | { kind: "json"; text: string }
  | { kind: "gap" };

type Scene = {
  key: string;
  label: string;
  state: "RUNNING" | "PAUSED";
  port?: string;
  lines: Line[];
};

const ID = "ck3f9q2x";
const IP = "172.16.0.14";

const SCENES: Scene[] = [
  {
    key: "create",
    label: "Create",
    state: "RUNNING",
    lines: [
      { kind: "cmd", text: "curl -sX POST $FUSE/firecracker/create -d '{}'" },
      { kind: "log", step: "reserve ip", detail: IP },
      { kind: "log", step: "copy rootfs", detail: "vm-ck3f.ext4 (reflink)" },
      { kind: "log", step: "tap device", detail: "tap-ck3f → br0" },
      { kind: "log", step: "spawn firecracker", detail: "api-sock ready" },
      { kind: "log", step: "configure", detail: "boot, drives, eth0" },
      { kind: "log", step: "InstanceStart", detail: "ssh ready" },
      { kind: "gap" },
      { kind: "json", text: `{ "message": "VM created",` },
      { kind: "json", text: `  "data": { "id": "${ID}", "status": "RUNNING",` },
      { kind: "json", text: `    "vmIp": "${IP}", "vCpu": 1, "memSize": 512 } }` },
    ],
  },
  {
    key: "exec",
    label: "Exec",
    state: "RUNNING",
    lines: [
      { kind: "cmd", text: "curl -sX POST $FUSE/firecracker/exec/run \\" },
      { kind: "cont", text: `-d '{"id":"${ID}","projectId":"demo",` },
      { kind: "cont", text: `     "command":"echo $((2**10))"}'` },
      { kind: "log", step: "ssh exec", detail: "cwd /root/demo" },
      { kind: "gap" },
      { kind: "json", text: `{ "message": "Command run successful",` },
      { kind: "json", text: `  "data": { "result": "1024", "id": "${ID}" } }` },
    ],
  },
  {
    key: "expose",
    label: "Expose",
    state: "RUNNING",
    port: ":8004 → 3000",
    lines: [
      { kind: "cmd", text: "curl -sX POST $FUSE/firecracker/get-host \\" },
      { kind: "cont", text: `-d '{"id":"${ID}","port":3000}'` },
      { kind: "log", step: "port pool", detail: "8004 allocated" },
      { kind: "log", step: "iptables DNAT", detail: `:8004 → ${IP}:3000` },
      { kind: "gap" },
      { kind: "json", text: `{ "message": "Got url", "data": {` },
      { kind: "json", text: `    "url": "http://firecracker.pavitar.dev:8004" } }` },
    ],
  },
  {
    key: "pause",
    label: "Pause",
    state: "PAUSED",
    port: ":8004 → 3000",
    lines: [
      { kind: "cmd", text: "curl -sX POST $FUSE/firecracker/pause \\" },
      { kind: "cont", text: `-d '{"id":"${ID}"}'` },
      { kind: "log", step: "freeze guest" },
      { kind: "log", step: "snapshot", detail: "vm-ck3f.snap + .mem" },
      { kind: "log", step: "stop process", detail: "0 MB host RAM" },
      { kind: "gap" },
      { kind: "json", text: `{ "message": "VM paused",` },
      { kind: "json", text: `  "data": { "id": "${ID}", "status": "PAUSED",` },
      { kind: "json", text: `    "vmIp": "${IP}", "vCpu": 1, "memSize": 512 } }` },
    ],
  },
];

const LINE_MS = 170;
const HOLD_MS = 3600;

// Minimal JSON colouring: keys dim, strings bright, numbers ember.
const Json = ({ text }: { text: string }) => {
  const parts = text.split(/("(?:[^"\\]|\\.)*"\s*:|"(?:[^"\\]|\\.)*"|\b\d+\b)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^".*"\s*:$/.test(p) ? (
          <span key={i} className="text-[#7d7d7d]">{p}</span>
        ) : /^".*"$/.test(p) ? (
          <span key={i} className="text-[#e8e8e8]">{p}</span>
        ) : /^\d+$/.test(p) ? (
          <span key={i} className="text-ember">{p}</span>
        ) : (
          <span key={i} className="text-dim">{p}</span>
        ),
      )}
    </>
  );
};

const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const usePrefersReducedMotion = () =>
  useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

export const HeroTerminal = () => {
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(0);
  const [auto, setAuto] = useState(true);
  const reduced = usePrefersReducedMotion();

  const scene = SCENES[active];
  const total = scene.lines.length;
  const visible = reduced ? total : shown;
  const done = visible >= total;

  // Reveal the scene line by line, then (while auto-playing) move to the next.
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(
      () => {
        if (shown < total) setShown((n) => n + 1);
        else if (auto) {
          setActive((a) => (a + 1) % SCENES.length);
          setShown(0);
        }
      },
      shown < total ? (shown === 0 ? 350 : LINE_MS) : HOLD_MS,
    );
    return () => clearTimeout(t);
  }, [shown, total, auto, reduced]);

  const select = (i: number) => {
    setAuto(false);
    setActive(i);
    setShown(0);
  };

  // While creating, memory fills as the boot progresses.
  const booting = scene.key === "create" && !done;
  const memFill = booting ? visible / total : 1;
  const status = booting ? "BOOTING" : scene.state;

  return (
    <div className="border border-border-strong bg-card shadow-[0_40px_120px_-40px_rgb(255_107_26/0.18)]">
      {/* title bar */}
      <div className="flex h-10 items-center justify-between border-b px-4 font-mono text-[0.7rem] text-muted-foreground">
        <span className="flex items-center gap-3">
          <span className="flex flex-col gap-[3px]" aria-hidden="true">
            <span className="h-px w-3 bg-dim" />
            <span className="h-px w-3 bg-dim" />
            <span className="h-px w-3 bg-dim" />
          </span>
          <span>
            <span className="text-foreground">vm-{ID}</span>
            <span className="text-dim"> @ fc-host-1</span>
          </span>
        </span>
        <span className="border border-border-strong px-2 py-0.5 text-[0.65rem] text-foreground">
          br0 · {IP}
        </span>
      </div>

      <div className="grid md:grid-cols-[minmax(0,1fr)_180px]">
        {/* log */}
        <div
          className="h-[310px] overflow-x-auto overflow-y-hidden px-4 py-4 font-mono text-[0.72rem] leading-[1.75] sm:px-5"
          aria-live="polite"
        >
          {scene.lines.slice(0, visible).map((line, i) => (
            <div key={`${scene.key}-${i}`} className="term-line whitespace-pre">
              {line.kind === "cmd" && (
                <>
                  <span className="text-ember">$ </span>
                  <span className="text-foreground">{line.text}</span>
                </>
              )}
              {line.kind === "cont" && <span className="text-foreground">{"    " + line.text}</span>}
              {line.kind === "log" && (
                <>
                  <span className="text-dim">fuse › </span>
                  <span className="inline-block w-[18ch] text-muted-foreground">{line.step}</span>
                  {line.detail && <span className="text-[#bdbdbd]">{line.detail}</span>}
                </>
              )}
              {line.kind === "json" && <Json text={line.text} />}
              {line.kind === "gap" && " "}
            </div>
          ))}
          {!done && (
            <span className="caret inline-block h-[1.05em] w-[0.55em] translate-y-[2px] bg-foreground" />
          )}
        </div>

        {/* machine panel */}
        <div className="hidden border-l md:flex md:flex-col">
          <div className="border-b px-4 py-3">
            <p className="label-mono">Memory</p>
            <MemoryGrid fill={memFill} paused={status === "PAUSED"} />
          </div>
          <dl className="flex-1 space-y-2.5 px-4 py-3 font-mono text-[0.7rem]">
            {[
              ["vcpu", "1"],
              ["mem", "512 MB"],
              ["rootfs", "ext4, private"],
              ["ports", scene.port ?? "none"],
              ["host ram", status === "PAUSED" ? "0 MB" : "512 MB"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <dt className="text-dim">{k}</dt>
                <dd className="truncate text-right text-[#cfcfcf]">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* status bar */}
      <div className="flex h-9 items-center justify-between border-t px-4 font-mono text-[0.68rem] uppercase tracking-[0.06em]">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "h-1.5 w-1.5",
              status === "RUNNING" && "bg-ok",
              status === "PAUSED" && "bg-idle",
              status === "BOOTING" && "status-pulse bg-busy",
            )}
          />
          <span
            className={cn(
              status === "RUNNING" && "text-ok",
              status === "PAUSED" && "text-idle",
              status === "BOOTING" && "text-busy",
            )}
          >
            {status}
          </span>
        </span>
        <span className="text-dim">firecracker microvm · kvm</span>
      </div>

      {/* scene tabs */}
      <div role="tablist" aria-label="API calls" className="grid grid-cols-4 border-t p-1.5">
        {SCENES.map((s, i) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={i === active}
            onClick={() => select(i)}
            className={cn(
              "h-8 font-mono text-[0.68rem] uppercase tracking-[0.06em] transition-colors",
              i === active
                ? "bg-muted text-foreground"
                : "text-dim hover:text-muted-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// A field of "memory pages": lit while live, outlined once snapshotted to disk.
const COLS = 12;
const ROWS = 7;
const MemoryGrid = ({ fill, paused }: { fill: number; paused: boolean }) => {
  const cells = useMemo(
    () =>
      Array.from({ length: COLS * ROWS }, (_, i) => {
        const h = Math.sin(i * 12.9898) * 43758.5453;
        return h - Math.floor(h); // stable pseudo-random 0..1
      }),
    [],
  );
  const lit = Math.round(cells.length * fill);
  return (
    <div
      className="mt-3 grid gap-[3px]"
      style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      aria-hidden="true"
    >
      {cells.map((r, i) => (
        <span
          key={i}
          className={cn(
            "aspect-square transition-colors duration-300",
            i >= lit
              ? "bg-[#1b1b1b]"
              : paused
                ? "border border-idle/50"
                : r > 0.55
                  ? "bg-ember"
                  : r > 0.25
                    ? "bg-ember/45"
                    : "bg-[#2a2a2a]",
          )}
        />
      ))}
    </div>
  );
};
