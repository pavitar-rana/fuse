import Link from "next/link";
import { Cpu, Lock, PauseCircle, Terminal, Zap, Globe } from "lucide-react";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getLimitsText } from "@/lib/limits";

const features = [
  {
    icon: Lock,
    title: "Real isolation",
    body: "Every sandbox is a Firecracker microVM with its own kernel, rootfs and network port. Not a container.",
  },
  {
    icon: Zap,
    title: "Boots in seconds",
    body: "Create a VM with one API call and run commands in it straight away.",
  },
  {
    icon: PauseCircle,
    title: "Pause and resume",
    body: "Pause snapshots memory and disk to storage and frees the host. Resume picks up exactly where it stopped.",
  },
  {
    icon: Terminal,
    title: "Exec and files over HTTP",
    body: "Run commands, write files and create directories with a simple JSON API and an API key.",
  },
  {
    icon: Globe,
    title: "Expose ports",
    body: "Start a server inside the VM and get a public URL for it.",
  },
  {
    icon: Cpu,
    title: "Self-hosted",
    body: "Raw Firecracker, Linux networking and TypeScript. No orchestration frameworks.",
  },
];

const example = `curl -X POST https://firecracker.pavitar.dev/api/firecracker/create \\
  -H "Authorization: Bearer $FUSE_API_KEY" \\
  -H "Content-Type: application/json" -d '{}'

curl -X POST https://firecracker.pavitar.dev/api/firecracker/exec/run \\
  -H "Authorization: Bearer $FUSE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"id":"<vm id>","projectId":"demo","command":"uname -a"}'`;

export default async function LandingPage() {
  const [session, limitsText] = await Promise.all([auth(), getLimitsText()]);
  const signedIn = Boolean(session?.user?.id);
  const cta = signedIn
    ? { href: "/dashboard", label: "Go to dashboard" }
    : { href: "/sign-in", label: "Get started free" };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <SiteHeader />

      <main className="container mx-auto px-6">
        <section className="mx-auto max-w-3xl py-20 text-center sm:py-28">
          <p className="mb-4 inline-block rounded-full border px-3 py-1 text-xs text-muted-foreground">
            {limitsText}
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Cloud sandboxes on Firecracker microVMs
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Spin up an isolated Linux VM, run code in it over an API, pause it, and tear it
            down when you&apos;re done.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href={cta.href}>{cta.label}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="https://github.com/pavitar-rana/fuse" target="_blank" rel="noreferrer">
                View on GitHub
              </a>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border bg-card p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mb-1 font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>

        <section className="mx-auto max-w-3xl pb-24">
          <h2 className="mb-4 text-center text-2xl font-semibold">Two calls to a running sandbox</h2>
          <pre className="overflow-x-auto rounded-xl border bg-muted/60 p-5 text-xs leading-relaxed sm:text-sm">
            <code>{example}</code>
          </pre>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Get your API key from the dashboard after signing in.
          </p>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Fuse · self-hosted Firecracker sandboxes
      </footer>
    </div>
  );
}
