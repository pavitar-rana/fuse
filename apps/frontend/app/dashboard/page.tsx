"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Bracket } from "@/components/brand";
import { getUserInfo } from "@/actions/get-user-info";
import { rotateApiKey } from "@/actions/api-key";
import {
  createVm as createVmAction,
  deleteVm as deleteVmAction,
  pauseVm as pauseVmAction,
  resumeVm as resumeVmAction,
} from "@/actions/vm";

type UserInfo = Awaited<ReturnType<typeof getUserInfo>>;
type Vm = UserInfo["vms"][number];
type DashboardUser = NonNullable<UserInfo["user"]>;
type Limits = UserInfo["limits"];

const API_BASE = "https://firecracker.pavitar.dev/api";
const POLL_MS = 2500;

// Statuses that will change on their own; the list polls while any are present.
const TRANSITIONAL = new Set(["CREATING", "PAUSING", "RESUMING", "TERMINATING"]);
// Statuses that count against the per-user quota.
const HOLDS_SLOT = (s: string) => s !== "FAILED" && s !== "TERMINATED";
// Statuses that hold host RAM.
const USES_RAM = (s: string) => HOLDS_SLOT(s) && s !== "PAUSED";

const STATUS: Record<string, { label: string; tone: "ok" | "idle" | "busy" | "bad" | "off" }> = {
  CREATING: { label: "Booting", tone: "busy" },
  RUNNING: { label: "Running", tone: "ok" },
  PAUSING: { label: "Pausing", tone: "busy" },
  PAUSED: { label: "Paused", tone: "idle" },
  RESUMING: { label: "Resuming", tone: "busy" },
  TERMINATING: { label: "Deleting", tone: "busy" },
  TERMINATED: { label: "Deleted", tone: "off" },
  FAILED: { label: "Failed", tone: "bad" },
};

const TONE = {
  ok: "text-ok",
  idle: "text-idle",
  busy: "text-busy",
  bad: "text-bad",
  off: "text-dim",
} as const;

const DOT = {
  ok: "bg-ok",
  idle: "bg-idle",
  busy: "bg-busy",
  bad: "bg-bad",
  off: "bg-dim",
} as const;

const relativeTime = (d: Date | string) => {
  const then = new Date(d).getTime();
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
};

const useCopy = () => {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1600);
  };
  return { copied, copy };
};

export default function DashboardPage() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [limits, setLimits] = useState<Limits>(null);
  const [vms, setVms] = useState<Vm[] | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Vm | null>(null);

  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const { copied, copy } = useCopy();

  const load = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setRefreshing(true);
    try {
      const info = await getUserInfo();
      setUser(info.user);
      setLimits(info.limits);
      setVms(info.vms);
    } catch {
      setError("Couldn't load your sandboxes. Check that the database is reachable, then refresh.");
    } finally {
      if (!opts.silent) setRefreshing(false);
    }
  }, []);

  // Initial load: the skeleton covers it, so no refresh spinner.
  useEffect(() => {
    let alive = true;
    getUserInfo()
      .then((info) => {
        if (!alive) return;
        setUser(info.user);
        setLimits(info.limits);
        setVms(info.vms);
      })
      .catch(() => alive && setError("Couldn't load your sandboxes. Check that the database is reachable, then refresh."));
    return () => {
      alive = false;
    };
  }, []);

  // Poll quietly while anything is mid-transition (including our own create).
  const settling = creating || Boolean(vms?.some((v) => TRANSITIONAL.has(v.status)));
  useEffect(() => {
    if (!settling) return;
    const t = setInterval(() => void load({ silent: true }), POLL_MS);
    return () => clearInterval(t);
  }, [settling, load]);

  const usage = useMemo(() => {
    const list = vms ?? [];
    const held = list.filter((v) => HOLDS_SLOT(v.status));
    const live = list.filter((v) => USES_RAM(v.status));
    return {
      slots: held.length,
      running: list.filter((v) => v.status === "RUNNING").length,
      vcpu: live.reduce((n, v) => n + (v.vcpuCount ?? 0), 0),
      mem: live.reduce((n, v) => n + (v.memSize ?? 0), 0),
    };
  }, [vms]);

  const maxSlots = limits?.maxVmsPerUser ?? null;
  const atQuota = maxSlots !== null && usage.slots >= maxSlots;
  const firstRunning = vms?.find((v) => v.status === "RUNNING");

  const createVm = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await createVmAction();
      if (!res.ok) setError(`Couldn't create a sandbox: ${res.message}`);
    } finally {
      await load({ silent: true });
      setCreating(false);
    }
  };

  const togglePause = async (vm: Vm) => {
    const pausing = vm.status === "RUNNING";
    setBusyId(vm.id);
    setError(null);
    try {
      const res = pausing ? await pauseVmAction(vm.id) : await resumeVmAction(vm.id);
      if (!res.ok) setError(`Couldn't ${pausing ? "pause" : "resume"} ${vm.id}: ${res.message}`);
    } finally {
      await load({ silent: true });
      setBusyId(null);
    }
  };

  const deleteVm = async (vm: Vm) => {
    setConfirmDelete(null);
    setBusyId(vm.id);
    setError(null);
    try {
      const res = await deleteVmAction(vm.id);
      if (!res.ok) setError(`Couldn't delete ${vm.id}: ${res.message}`);
    } finally {
      await load({ silent: true });
      setBusyId(null);
    }
  };

  const rotate = async () => {
    setRotating(true);
    setError(null);
    try {
      const res = await rotateApiKey();
      if (!res.ok) return setError(`Couldn't generate a key: ${res.message}`);
      setConfirmRotate(false);
      setNewKey(res.key);
      await load({ silent: true });
    } finally {
      setRotating(false);
    }
  };

  const showPlaceholder = creating && !vms?.some((v) => v.status === "CREATING");

  const memLabel =
    usage.mem >= 1024 ? `${(usage.mem / 1024).toFixed(1).replace(/\.0$/, "")} GB` : `${usage.mem} MB`;

  return (
    <main className="frame min-h-[calc(100vh-3.5rem)]">
      {/* Title row */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5 border-b px-5 pb-8 pt-12 sm:px-8">
        <div>
          <Bracket>Console</Bracket>
          <h1 className="mt-4 text-[2.4rem] font-medium leading-none tracking-[-0.035em]">
            Sandboxes
          </h1>
          <p className="mt-3 text-[0.95rem] text-muted-foreground">
            {limits?.maxRunMinutes
              ? `Running sandboxes pause themselves after ${limits.maxRunMinutes} minutes. Resume any time.`
              : "Boot, pause and delete your microVMs."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => void load()}
            disabled={refreshing}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className={cn(refreshing && "animate-spin")} />
          </Button>
          <Button onClick={createVm} disabled={creating || atQuota}>
            <Plus />
            {creating ? "Booting…" : "New sandbox"}
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-4 border-b border-l-2 border-l-bad bg-bad/[0.06] px-5 py-3 font-mono text-[0.78rem] text-bad sm:px-8"
        >
          <span className="leading-relaxed">{error}</span>
          <button
            onClick={() => setError(null)}
            aria-label="Dismiss"
            className="mt-0.5 shrink-0 opacity-70 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Usage + key strip */}
      <div className="grid border-b sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.7fr]">
        <div className="border-b px-5 py-5 sm:px-8 lg:border-b-0">
          <div className="flex items-baseline justify-between">
            <span className="label-mono">Slots</span>
            <span className="font-mono text-[0.8rem] tabular-nums">
              {usage.slots}
              {maxSlots !== null && <span className="text-dim"> / {maxSlots}</span>}
            </span>
          </div>
          {maxSlots !== null && maxSlots > 0 && (
            <div className="mt-3 flex gap-[3px]" aria-hidden="true">
              {Array.from({ length: maxSlots }, (_, i) => (
                <span key={i} className={cn("h-2 flex-1", i < usage.slots ? "bg-ember" : "bg-muted")} />
              ))}
            </div>
          )}
          {atQuota && (
            <p className="mt-2.5 text-xs leading-relaxed text-dim">
              All slots used. Delete one to free a slot; paused sandboxes still hold theirs.
            </p>
          )}
        </div>
        <Stat label="Running" value={usage.running} className="border-b sm:border-l lg:border-b-0" />
        <Stat label="Live vCPU" value={usage.vcpu} className="border-b lg:border-b-0 lg:border-l" />
        <Stat label="Live RAM" value={memLabel} className="border-b sm:border-l lg:border-b-0" />

        <div className="flex items-center justify-between gap-4 px-5 py-5 sm:col-span-2 sm:px-8 lg:col-span-1 lg:border-l">
          <div className="min-w-0">
            <span className="label-mono flex items-center gap-1.5">
              <KeyRound className="h-3 w-3" aria-hidden="true" /> API key
            </span>
            {vms === undefined ? (
              <div className="mt-3 h-5 w-36 animate-pulse bg-muted" />
            ) : user?.apiKeyPrefix ? (
              <p className="mt-2.5 truncate font-mono text-[0.9rem]" title="Only the start of the key is stored">
                {user.apiKeyPrefix}
                <span className="text-dim">••••••••••</span>
              </p>
            ) : (
              <p className="mt-2.5 text-sm text-muted-foreground">None yet</p>
            )}
          </div>
          {user?.apiKeyPrefix ? (
            <Button variant="outline" size="sm" onClick={() => setConfirmRotate(true)}>
              Rotate
            </Button>
          ) : (
            <Button variant="light" size="sm" onClick={rotate} disabled={rotating || vms === undefined}>
              {rotating ? "Generating…" : "Generate"}
            </Button>
          )}
        </div>
      </div>

      {/* Sandbox table */}
      <section aria-label="Your sandboxes" className="border-b">
        <div
          className={cn(
            "label-mono hidden grid-cols-[minmax(0,1fr)_8rem_minmax(0,0.8fr)_9rem_10rem] gap-4 border-b bg-[#0c0c0c] px-8 py-3",
            (vms === undefined || vms.length > 0 || showPlaceholder) && "md:grid",
          )}
        >
          <span>Sandbox</span>
          <span>Status</span>
          <span>Address</span>
          <span title="Public host port → port inside the sandbox">Host → guest</span>
          <span className="text-right">Actions</span>
        </div>

        {vms === undefined ? (
          <ListSkeleton />
        ) : vms.length === 0 && !showPlaceholder ? (
          <EmptyState onCreate={createVm} creating={creating} disabled={atQuota} />
        ) : (
          <ul className="divide-y">
            {showPlaceholder && <PlaceholderRow />}
            {vms.map((vm) => (
              <VmRow
                key={vm.id}
                vm={vm}
                busy={busyId === vm.id}
                copied={copied === vm.id}
                onCopy={() => copy(vm.id, vm.id)}
                onToggle={() => togglePause(vm)}
                onDelete={() => setConfirmDelete(vm)}
              />
            ))}
          </ul>
        )}
      </section>

      <TryIt
        vmId={firstRunning?.id}
        copied={copied === "snippet"}
        onCopy={(text) => copy("snippet", text)}
      />

      {/* Delete confirmation */}
      <Dialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this sandbox?</DialogTitle>
            <DialogDescription>
              <span className="font-mono text-foreground">{confirmDelete?.id}</span> will be
              stopped and its disk, snapshot and ports released. Files inside it can&apos;t be
              recovered.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={() => confirmDelete && deleteVm(confirmDelete)}>
              Delete sandbox
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotate confirmation */}
      <Dialog open={confirmRotate} onOpenChange={setConfirmRotate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rotate your API key?</DialogTitle>
            <DialogDescription>
              Your current key stops working immediately. Anything using it will get 401s until
              you switch it to the new key.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRotate(false)}>
              Cancel
            </Button>
            <Button onClick={rotate} disabled={rotating}>
              {rotating ? "Rotating…" : "Rotate key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New key, shown once */}
      <Dialog open={newKey !== null} onOpenChange={(o) => !o && setNewKey(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Your new API key</DialogTitle>
            <DialogDescription>
              Copy it now. Fuse only keeps a hash, so this is the only time you&apos;ll see it.
            </DialogDescription>
          </DialogHeader>
          <div className="border border-border-strong bg-background p-4 font-mono text-sm break-all text-ember">
            {newKey}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => newKey && copy("key", newKey)}>
              {copied === "key" ? <Check /> : <Copy />}
              {copied === "key" ? "Copied" : "Copy key"}
            </Button>
            <Button variant="light" onClick={() => setNewKey(null)}>
              I&apos;ve saved it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

/* ---------- pieces ---------- */

const Stat = ({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("px-5 py-5 sm:px-8", className)}>
    <span className="label-mono">{label}</span>
    <p className="mt-2.5 font-mono text-[1.35rem] leading-none tabular-nums">{value}</p>
  </div>
);

const StatusTag = ({ status }: { status: string }) => {
  const s = STATUS[status] ?? { label: status, tone: "off" as const };
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.06em]",
        TONE[s.tone],
      )}
    >
      <span className={cn("h-1.5 w-1.5", DOT[s.tone], TRANSITIONAL.has(status) && "status-pulse")} />
      {s.label}
    </span>
  );
};

const VmRow = ({
  vm,
  busy,
  copied,
  onCopy,
  onToggle,
  onDelete,
}: {
  vm: Vm;
  busy: boolean;
  copied: boolean;
  onCopy: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) => {
  const canToggle = vm.status === "RUNNING" || vm.status === "PAUSED";
  const deleting = vm.status === "TERMINATING";
  const created = new Date(vm.createdAt);

  return (
    <li className="grid gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:bg-[#0d0d0d] sm:px-8 md:grid-cols-[minmax(0,1fr)_8rem_minmax(0,0.8fr)_9rem_10rem] md:items-center">
      <div className="flex min-w-0 items-start justify-between gap-3 md:block">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <code className="truncate font-mono text-[0.84rem] text-foreground" title={vm.id}>
              {vm.id}
            </code>
            <button
              onClick={onCopy}
              aria-label="Copy sandbox ID"
              title="Copy ID"
              className="shrink-0 p-1 text-dim hover:text-foreground"
            >
              {copied ? <Check className="h-3 w-3 text-ok" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
          <p className="mt-1 font-mono text-[0.7rem] text-dim">
            {vm.vcpuCount} vCPU / {vm.memSize} MB /{" "}
            <time dateTime={created.toISOString()} title={created.toLocaleString()}>
              {relativeTime(created)}
            </time>
          </p>
        </div>
        <span className="md:hidden">
          <StatusTag status={vm.status} />
        </span>
      </div>

      <span className="hidden md:block">
        <StatusTag status={vm.status} />
      </span>

      <div className="min-w-0 font-mono text-[0.8rem]">
        <span className="label-mono mr-2 md:hidden">IP</span>
        <span className="text-foreground">{vm.vmIp}</span>
        <p className="hidden truncate text-[0.7rem] text-dim md:block">{vm.vmMac}</p>
      </div>

      <div className="min-w-0 font-mono text-[0.8rem]">
        <span className="label-mono mr-2 md:hidden">Ports</span>
        {vm.portMappings.length ? (
          <span className="inline-flex flex-wrap gap-x-3 gap-y-1 md:flex-col md:gap-0.5">
            {vm.portMappings.map((pm) => (
              <span key={pm.id} className="whitespace-nowrap">
                {pm.hostPort}
                <span className="text-dim"> → </span>
                {pm.vmPort}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-dim">—</span>
        )}
      </div>

      <div className="flex items-center gap-1.5 md:justify-end">
        {canToggle && (
          <Button variant="outline" size="sm" onClick={onToggle} disabled={busy}>
            {vm.status === "RUNNING" ? <Pause /> : <Play />}
            {busy
              ? vm.status === "RUNNING"
                ? "Pausing"
                : "Resuming"
              : vm.status === "RUNNING"
                ? "Pause"
                : "Resume"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-bad/10 hover:text-bad"
          onClick={onDelete}
          disabled={busy || deleting}
          aria-label={`Delete ${vm.id}`}
          title="Delete"
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
};

const PlaceholderRow = () => (
  <li className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
    <div>
      <div className="h-4 w-56 animate-pulse bg-muted" />
      <p className="mt-2 font-mono text-[0.7rem] text-dim">
        reserving ip / copying rootfs / starting firecracker…
      </p>
    </div>
    <StatusTag status="CREATING" />
  </li>
);

const ListSkeleton = () => (
  <ul className="divide-y" aria-label="Loading sandboxes">
    {[0, 1].map((i) => (
      <li key={i} className="flex items-center gap-8 px-8 py-5">
        <div className="h-4 w-60 animate-pulse bg-muted" />
        <div className="h-3 w-20 animate-pulse bg-muted" />
        <div className="hidden h-4 w-28 animate-pulse bg-muted md:block" />
      </li>
    ))}
  </ul>
);

const EmptyState = ({
  onCreate,
  creating,
  disabled,
}: {
  onCreate: () => void;
  creating: boolean;
  disabled: boolean;
}) => (
  <div className="relative overflow-hidden px-5 py-16 sm:px-8">
    <div className="dot-grid pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_left,black,transparent_70%)]" />
    <div className="relative max-w-md">
      <p className="font-mono text-[0.78rem] text-dim">
        <span className="text-ember">$</span> fuse ls
        <br />
        <span>0 sandboxes</span>
      </p>
      <h2 className="mt-6 text-xl font-medium tracking-tight">No sandboxes yet</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        A new sandbox boots a fresh microVM and is ready for commands in a few seconds.
      </p>
      <Button className="mt-7" onClick={onCreate} disabled={creating || disabled}>
        <Plus />
        {creating ? "Booting…" : "New sandbox"}
      </Button>
    </div>
  </div>
);

const TryIt = ({
  vmId,
  copied,
  onCopy,
}: {
  vmId?: string;
  copied: boolean;
  onCopy: (text: string) => void;
}) => {
  const id = vmId ?? "<sandbox id>";
  const snippet = `curl -X POST ${API_BASE}/firecracker/exec/run \\
  -H "Authorization: Bearer $FUSE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"id":"${id}","projectId":"demo","command":"uname -a"}'`;

  return (
    <section className="border-b bg-[#0c0c0c]">
      <div className="flex h-11 items-center justify-between border-b px-5 sm:px-8">
        <span className="flex items-center gap-4 font-mono text-[0.7rem]">
          <span className="text-foreground">quickstart.sh</span>
          <span className="text-dim">
            {vmId ? "run a command in your sandbox" : "run a command from the API"}
          </span>
        </span>
        <button
          onClick={() => onCopy(snippet)}
          className="flex items-center gap-1.5 font-mono text-[0.68rem] uppercase tracking-[0.05em] text-dim hover:text-foreground"
        >
          {copied ? <Check className="h-3 w-3 text-ok" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-5 py-5 font-mono text-[0.76rem] leading-[1.75] text-[#d6d6d6] sm:px-8">
        <code>
          <span className="text-ember">curl</span>
          {snippet.slice(4)}
        </code>
      </pre>
    </section>
  );
};
