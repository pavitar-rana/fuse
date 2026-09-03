"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Key, Server, Copy, Check } from "lucide-react";
import { getUserInfo } from "@/actions/get-user-info";
import { User, Virtualmachine } from "@/generated/prisma/browser";
import axios from "axios";

const Home = () => {
  const { data: session, status } = useSession();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<User>();

  const [vms, setVms] = useState<Virtualmachine[]>();

  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!session?.user?.id) return;
      const userInfo = await getUserInfo(session?.user?.id);

      if (userInfo.user && userInfo.vms) {
        setUser(userInfo.user);
        setVms(userInfo.vms);
      }
    };

    if (session?.user?.id) {
      fetchUserInfo();
    }
  }, [session]);

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
      case "running":
        return <Badge variant="success">Running</Badge>;
      case "stopped":
        return <Badge variant="secondary">Stopped</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Firecracker Cloud Dashboard</h1>
          {session?.user?.email && <p className="text-muted-foreground mt-1">Welcome, {session.user.email}</p>}
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
              Copy this API key and store it securely. You won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <div className="flex items-center space-x-2 rounded-md border bg-muted p-3">
                <code className="flex-1 text-sm font-mono break-all">{apiKey}</code>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="secondary" onClick={copyToClipboard} className="w-full sm:w-auto">
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
            <Button type="button" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VMs List Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Your Virtual Machines
              </CardTitle>
              <CardDescription>Manage and monitor your running VMs</CardDescription>
            </div>
            <Button
              onClick={async () => {
                const res = await axios.post("https://firecracker.pavitr.cloud/api/firecracker/create", {
                  userId: session?.user?.id,
                  config: {
                    kernelImage: "./vmlinux-6.1.141",
                    rootfsPath: "./ubuntu-nodejs.ext4",
                    memSize: 512,
                    vcpuCount: 1,
                  },
                });
                console.log("Res : ", res);
              }}
              variant="outline"
            >
              Create New VM
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {vms?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Server className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No VMs yet</h3>
              <p className="text-muted-foreground mb-4">Get started by creating your first virtual machine</p>
              <Button
                onClick={async () => {
                  const res = await axios.post("https://firecracker.pavitr.cloud/api/firecracker/create", {
                    userId: session?.user?.id,
                    config: {
                      kernelImage: "./vmlinux-6.1.141",
                      rootfsPath: "./ubuntu-nodejs.ext4",
                      memSize: 512,
                      vcpuCount: 1,
                    },
                  });
                  console.log("Res : ", res);
                }}
              >
                Create VM
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>VM ID</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>CPU</TableHead>
                    <TableHead>Memory</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vms?.map((vm) => (
                    <TableRow key={vm.id}>
                      <TableCell className="font-medium">{vm.id}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{vm.vmIp}</code>
                      </TableCell>
                      <TableCell>{getStatusBadge(vm.status)}</TableCell>
                      <TableCell>{vm.vcpuCount}</TableCell>
                      <TableCell>{vm.memSize}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {vm.createdAt instanceof Date ? vm.createdAt.toISOString().slice(0, 10) : vm.createdAt}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={async () => {
                              const res = await axios.post("https://firecracker.pavitr.cloud/api/firecracker/delete", {
                                id: vm.id,
                                userId: session?.user?.id,
                              });
                              console.log("Delete req : ", res);
                            }}
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                          >
                            Delete
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
            <div className="text-2xl font-bold">{vms?.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {vms?.filter((vm) => vm.status === "running").length} running
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total vCPUs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vms?.reduce((sum, vm) => sum + (typeof vm?.vcpuCount === "number" ? vm.vcpuCount : 0), 0)}
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
              {vms?.reduce((sum, vm) => sum + (typeof vm.memSize === "number" ? vm.memSize : 0), 0)} MB
            </div>
            <p className="text-xs text-muted-foreground mt-1">Allocated memory</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Home;
