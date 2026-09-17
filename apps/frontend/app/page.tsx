"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Key,
  Server,
  Copy,
  Check,
  RefreshCw,
  Cpu,
  MemoryStick,
  Network,
} from "lucide-react";
import { getUserInfo } from "@/actions/get-user-info";
import axios from "axios";
import { User, Virtualmachine } from "@fuse/db/client";

type PortMapping = {
  id: string;
  vmPort: number;
  hostPort: number;
};

type VmWithRelations = Virtualmachine & {
  portMappings?: PortMapping[];
  host?: { hostname: string } | null;
};

const Home = () => {
  const { data: session, status } = useSession();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<User>();
  const [copiedVmId, setCopiedVmId] = useState<string | null>(null);

  const [vms, setVms] = useState<VmWithRelations[]>();
  const [vmsLoading, setVmsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUserInfo = async () => {
    if (!session?.user?.id) return;
    setVmsLoading(true);
    try {
      const userInfo = await getUserInfo(session.user.id);
      if (userInfo.user) setUser(userInfo.user);
      setVms((userInfo.vms as VmWithRelations[]) ?? []);
    } finally {
      setVmsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetchUserInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const copyVmId = async (id: string) => {
    await navigator.clipboard.writeText(id);
    setCopiedVmId(id);
    setTimeout(() => setCopiedVmId(null), 1500);
  };

  const generateApiKey = async () => {
    // TODO: Replace with actual API call to generate key
    const newKey = `fc_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    setApiKey(newKey);
    setIsDialogOpen(true);
  };

  const copyToClipboard = async () => {
    if (apiKey) {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "RUNNING":
        return <Badge variant="success">Running</Badge>;
      case "CREATING":
        return <Badge variant="warning">Creating</Badge>;
      case "PAUSED":
        return <Badge variant="secondary">Paused</Badge>;
      case "TERMINATING":
        return <Badge variant="warning">Terminating</Badge>;
      case "TERMINATED":
        return <Badge variant="outline">Terminated</Badge>;
      case "FAILED":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const createVm = async () => {
    if (!session?.user?.id) return;
    setCreating(true);
    try {
      await axios.post(
        "https://firecracker.pavitr.cloud/api/firecracker/create",
        {
          userId: session.user.id,
          config: {
            kernelImage: "./vmlinux-6.1.141",
            rootfsPath: "./ubuntu-nodejs.ext4",
            memSize: 512,
            vcpuCount: 1,
          },
        },
      );
      await fetchUserInfo();
    } finally {
      setCreating(false);
    }
  };

  const deleteVm = async (id: string) => {
    if (!session?.user?.id) return;
    setDeletingId(id);
    try {
      await axios.post(
        "https://firecracker.pavitr.cloud/api/firecracker/delete",
        {
          id,
          userId: session.user.id,
        },
      );
      await fetchUserInfo();
    } finally {
      setDeletingId(null);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Firecracker Cloud Dashboard
          </h1>
          {session?.user?.email && (
            <p className="text-muted-foreground mt-1">
              Welcome, {session.user.email}
            </p>
          )}
        </div>
        <Button onClick={generateApiKey} size="lg">
          <Key className="mr-2 h-4 w-4" />
          Generate API Key
        </Button>
      </div>

      {/* API Key Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your API Key</DialogTitle>
            <DialogDescription>
              Copy this API key and store it securely. You won&apos;t be able to
              see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <div className="flex items-center space-x-2 rounded-md border bg-muted p-3">
                <code className="flex-1 text-sm font-mono break-all">
                  {apiKey}
                </code>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={copyToClipboard}
              className="w-full sm:w-auto"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy to Clipboard
                </>
              )}
            </Button>
            <Button
              type="button"
              onClick={() => setIsDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VMs List Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Your Virtual Machines
              </CardTitle>
              <CardDescription>
                Manage and monitor your running VMs
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={fetchUserInfo}
                variant="ghost"
                size="icon"
                disabled={vmsLoading}
                title="Refresh"
              >
                <RefreshCw
                  className={`h-4 w-4 ${vmsLoading ? "animate-spin" : ""}`}
                />
              </Button>
              <Button onClick={createVm} variant="outline" disabled={creating}>
                {creating ? "Creating..." : "Create New VM"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {vmsLoading && vms === undefined ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mb-3" />
              Loading your virtual machines...
            </div>
          ) : vms?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Server className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No VMs yet</h3>
              <p className="text-muted-foreground mb-4">
                Get started by creating your first virtual machine
              </p>
              <Button onClick={createVm} disabled={creating}>
                {creating ? "Creating..." : "Create VM"}
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>VM ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>Ports</TableHead>
                    <TableHead>Resources</TableHead>
                    <TableHead>Host</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vms?.map((vm) => (
                    <TableRow key={vm.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          <code
                            className="text-xs bg-muted px-2 py-1 rounded"
                            title={vm.id}
                          >
                            {vm.id.slice(0, 10)}...
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyVmId(vm.id)}
                            title="Copy VM ID"
                          >
                            {copiedVmId === vm.id ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(vm.status)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="flex items-center gap-1">
                            <Network className="h-3 w-3 text-muted-foreground" />
                            <code className="bg-muted px-1.5 py-0.5 rounded">
                              {vm.vmIp}
                            </code>
                          </span>
                          <span className="text-muted-foreground font-mono">
                            {vm.vmMac}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {vm.portMappings && vm.portMappings.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {vm.portMappings.map((pm: PortMapping) => (
                              <code
                                key={pm.id}
                                className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit"
                              >
                                {pm.hostPort} → {pm.vmPort}
                              </code>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            None
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Cpu className="h-3 w-3" /> {vm.vcpuCount} vCPU
                          </span>
                          <span className="flex items-center gap-1">
                            <MemoryStick className="h-3 w-3" /> {vm.memSize} MB
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {vm.host?.hostname ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {vm.createdAt instanceof Date
                          ? vm.createdAt.toISOString().slice(0, 10)
                          : String(vm.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => deleteVm(vm.id)}
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            disabled={deletingId === vm.id}
                          >
                            {deletingId === vm.id ? "Deleting..." : "Delete"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total VMs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vms?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {vms?.filter((vm) => vm.status === "RUNNING").length ?? 0} running
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total vCPUs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vms?.reduce(
                (sum, vm) =>
                  sum + (typeof vm?.vcpuCount === "number" ? vm.vcpuCount : 0),
                0,
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across all VMs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Memory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vms?.reduce(
                (sum, vm) =>
                  sum + (typeof vm.memSize === "number" ? vm.memSize : 0),
                0,
              )}{" "}
              MB
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Allocated memory
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Home;
