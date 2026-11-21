import Link from "next/link";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { HeroTerminal } from "@/components/hero-terminal";
import { ApiExplorer } from "@/components/api-explorer";
import { Bracket, Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { getLimits, type Limits } from "@/lib/limits";
import { cn } from "@/lib/utils";

const GITHUB_URL = "https://github.com/pavitar-rana/fuse";

const limitLine = (l: Limits | null) => {
  if (!l) return "Free during early access";
  const parts = [`${l.maxVmsPerUser} sandboxes per account`];
  if (l.maxRunMinutes > 0) parts.push(`auto-pause after ${l.maxRunMinutes} min`);
  parts.push("free in early access");
  return parts.join("  /  ");
};

export default async function LandingPage() {
  const [session, limits] = await Promise.all([auth(), getLimits()]);
  const signedIn = Boolean(session?.user?.id);
  const cta = signedIn
    ? { href: "/dashboard", label: "Open dashboard" }
    : { href: "/sign-in", label: "Start a sandbox" };

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        {/* ---------------- Hero ---------------- */}
        <section className="relative border-b">
          <div className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_70%_40%,black,transparent_70%)]" />
          <div className="frame relative grid items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-12 lg:py-24">
            <div>
              <Bracket tone="ember">Firecracker sandboxes</Bracket>
              <h1 className="mt-6 text-[clamp(2.4rem,4.2vw,3.5rem)] font-medium leading-[1.04] tracking-[-0.035em]">
                Every untrusted job
                <br />
                <span className="text-dim">gets its own VM.</span>
              </h1>
              <p className="mt-6 max-w-[30rem] text-[1.05rem] leading-relaxed text-muted-foreground">
                Fuse boots a Firecracker microVM per sandbox, with its own kernel, disk and
                network. Drive it over a small HTTP API, pause it to disk, delete it when the
                job is done.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href={cta.href}>{cta.label}</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="#api">Read the API</Link>
                </Button>
              </div>
              <p className="mt-8 font-mono text-[0.7rem] uppercase tracking-[0.05em] text-dim">
                <span className="text-ember">▸</span> {limitLine(limits)}
              </p>
            </div>

            <HeroTerminal />
          </div>
        </section>

        {/* ---------------- Spec strip ---------------- */}
        <section className="border-b">
          <dl className="frame grid grid-cols-2 lg:grid-cols-4">
            {[
              ["microVM", "Its own kernel per sandbox"],
              ["/24", "Private bridge, isolated ports"],
              ["0 MB", "Host RAM while paused"],
              ["1 host", "Self-hosted, no orchestrator"],
            ].map(([v, k], i) => (
              <div
                key={k}
                className={cn(
                  "px-5 py-8 sm:px-8",
                  i % 2 === 1 && "border-l",
                  i >= 2 && "border-t lg:border-t-0",
                  i === 2 && "lg:border-l",
                )}
              >
                <dd className="font-mono text-[1.6rem] font-medium tracking-tight text-foreground">
                  {v}
                </dd>
                <dt className="mt-2 text-sm text-muted-foreground">{k}</dt>
              </div>
            ))}
          </dl>
        </section>

        {/* ---------------- Platform ---------------- */}
        <section id="platform" className="scroll-mt-14 border-b">
          <div className="frame">
            <SectionHead
              label="Platform"
              title="Built for code you didn't write."
              sub="Isolated at the hypervisor, not the namespace."
            />
            <div className="grid gap-px border-t bg-border md:grid-cols-2 lg:grid-cols-3">
              <Cell
                title="Real isolation"
                body="Each sandbox is a KVM microVM with a private rootfs. Guests can't see each other or reach the host."
              >
                <IsolationViz />
              </Cell>
              <Cell
                title="A simple lifecycle"
                body="Create, run, pause, resume, delete. Every state change is recorded, so nothing leaks on failure."
              >
                <LifecycleViz runMinutes={limits?.maxRunMinutes ?? 0} />
              </Cell>
              <Cell
                title="Pause to disk"
                body="Pausing writes memory and disk to a snapshot and stops the VM process. Resume picks up mid-instruction."
              >
                <SnapshotViz />
              </Cell>
              <Cell
                title="Public ports"
                body="Ask for a guest port and get a URL. Fuse allocates a host port and adds the DNAT rule."
              >
                <PortsViz />
              </Cell>
              <Cell
                title="Exec over HTTP"
                body="Run commands and write files with JSON requests. Each project gets its own directory in the VM."
              >
                <ExecViz />
              </Cell>
              <Cell
                title="Recovers on restart"
                body="On boot the control plane finishes or rolls back anything left mid-operation and re-adds its port rules."
              >
                <ReconcileViz />
              </Cell>
            </div>
          </div>
        </section>

        {/* ---------------- API ---------------- */}
        <section id="api" className="scroll-mt-14 border-b">
          <div className="frame">
            <SectionHead
              label="API"
              title="Programmatic control."
              sub="Lifecycle, exec, files and ports over plain JSON."
            />
            <ApiExplorer />
          </div>
        </section>

        {/* ---------------- Internals ---------------- */}
        <section id="internals" className="scroll-mt-14 border-b">
          <div className="frame">
            <SectionHead
              label="Internals"
              title="What one create call does."
              sub="Firecracker's API socket, Linux networking and TypeScript."
            />
            <div className="grid border-t lg:grid-cols-[minmax(0,1fr)_380px]">
              <ol className="divide-y">
                {[
                  ["Reserve an IP", "Row-locked from the host's IpPool, VM inserted as CREATING"],
                  ["Copy the rootfs", "cp --reflink=auto from the golden ext4 image"],
                  ["Create a TAP", "Attached to br0 as an isolated port, NAT on the uplink"],
                  ["Spawn Firecracker", "Own API socket, process group stored on the row"],
                  ["Configure the VM", "PUT /boot-source, /drives, /network-interfaces, /machine-config"],
                  ["Start the instance", "PUT /actions InstanceStart"],
                  ["Wait for the guest", "SSH answers, row flips to RUNNING"],
                ].map(([t, d], i) => (
                  <li key={t} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-baseline px-5 py-4 sm:px-8">
                    <span className="font-mono text-[0.75rem] text-ember">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <span className="text-[0.95rem] text-foreground">{t}</span>
                      <span className="mt-1 block font-mono text-[0.74rem] text-dim">{d}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <aside className="border-t bg-panel px-6 py-8 sm:px-8 lg:border-l lg:border-t-0">
                <Bracket>On failure</Bracket>
                <p className="mt-4 text-[1.05rem] leading-snug text-foreground">
                  Everything acquired so far is torn down, in reverse.
                </p>
                <ul className="mt-6 space-y-2 font-mono text-[0.74rem] text-muted-foreground">
                  {["port maps", "firecracker process", "api socket", "rootfs copy", "tap device", "ip address"].map(
                    (x) => (
                      <li key={x} className="flex items-center gap-2.5">
                        <span className="h-px w-3 bg-bad/70" aria-hidden="true" />
                        <span className="line-through decoration-dim">{x}</span>
                      </li>
                    ),
                  )}
                </ul>
                <p className="mt-6 font-mono text-[0.74rem] text-dim">
                  then the row is marked <span className="text-bad">FAILED</span>
                </p>
              </aside>
            </div>
          </div>
        </section>

        {/* ---------------- CTA ---------------- */}
        <section className="relative border-b">
          <div className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
          <div className="frame relative px-5 py-24 text-center sm:px-8">
            <h2 className="mx-auto max-w-3xl text-[clamp(2rem,4vw,3.2rem)] font-medium leading-[1.05] tracking-[-0.03em]">
              Give your code
              <br />
              <span className="text-dim">a machine of its own.</span>
            </h2>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href={cta.href}>{cta.label}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                  View source
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="frame grid gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-dim">
              Self-hosted sandboxes on Firecracker microVMs. A solo project, built from the
              hypervisor up.
            </p>
          </div>
          <FooterCol
            title="Product"
            links={[
              ["Platform", "/#platform"],
              ["API", "/#api"],
              ["Dashboard", "/dashboard"],
            ]}
          />
          <FooterCol
            title="Project"
            links={[
              ["GitHub", GITHUB_URL],
              ["README", `${GITHUB_URL}#readme`],
              ["Firecracker", "https://firecracker-microvm.github.io/"],
            ]}
          />
        </div>
        <div className="border-t">
          <div className="frame flex justify-between px-5 py-4 font-mono text-[0.68rem] uppercase tracking-[0.05em] text-dim sm:px-8">
            <span>Fuse</span>
            <span>Firecracker · KVM · Linux</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ---------------- building blocks ---------------- */

const SectionHead = ({ label, title, sub }: { label: string; title: string; sub: string }) => (
  <div className="px-5 pb-12 pt-20 sm:px-8 lg:pt-24">
    <Bracket>{label}</Bracket>
    <h2 className="mt-5 text-[clamp(1.8rem,3.4vw,2.6rem)] font-medium leading-[1.08] tracking-[-0.03em]">
      {title}
      <br />
      <span className="text-dim">{sub}</span>
    </h2>
  </div>
);

const Cell = ({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col bg-background">
    <div className="px-6 pt-7 sm:px-8">
      <h3 className="font-mono text-[0.8rem] uppercase tracking-[0.05em] text-foreground">{title}</h3>
      <p className="mt-2.5 text-[0.9rem] leading-relaxed text-muted-foreground">{body}</p>
    </div>
    <div className="mt-auto flex min-h-[190px] items-center justify-center px-6 pb-8 pt-8 sm:px-8">
      {children}
    </div>
  </div>
);

const FooterCol = ({ title, links }: { title: string; links: [string, string][] }) => (
  <div>
    <p className="label-mono">{title}</p>
    <ul className="mt-4 space-y-2.5 text-sm">
      {links.map(([l, href]) => (
        <li key={l}>
          <a
            href={href}
            {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
            className="text-muted-foreground hover:text-foreground"
          >
            {l}
          </a>
        </li>
      ))}
    </ul>
  </div>
);

/* ---------------- cell visuals (all drawn from real behaviour) ---------------- */

const IsolationViz = () => (
  <div className="w-full max-w-[280px] border border-border-strong p-2.5 font-mono text-[0.62rem] uppercase tracking-[0.05em]">
    <div className="flex justify-between text-dim">
      <span>host</span>
      <span>input -i br0: drop</span>
    </div>
    <div className="mt-2 border border-dashed border-border-strong p-2">
      <span className="text-dim">br0 · 172.16.0.1/24</span>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {["vm a", "vm b", "vm c"].map((v, i) => (
          <div
            key={v}
            className={cn(
              "border px-1.5 py-2 text-center",
              i === 1 ? "border-ember bg-ember/10 text-ember" : "border-border-strong text-muted-foreground",
            )}
          >
            {v}
            <div className="mt-1 text-[0.55rem] normal-case tracking-normal text-dim">own kernel</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const S = ({ s, tone }: { s: string; tone: string }) => (
  <span className={cn("border px-2 py-1 font-mono text-[0.62rem] tracking-[0.05em]", tone)}>{s}</span>
);

const LifecycleViz = ({ runMinutes }: { runMinutes: number }) => {
  return (
    <div className="flex flex-col items-center gap-2 font-mono text-[0.6rem] text-dim">
      <S s="CREATING" tone="border-busy/40 text-busy" />
      <span>↓</span>
      <div className="flex items-center gap-2">
        <S s="RUNNING" tone="border-ok/40 text-ok" />
        <span className="text-center leading-tight">
          ⇄<br />
          {runMinutes > 0 ? `${runMinutes}m` : ""}
        </span>
        <S s="PAUSED" tone="border-idle/40 text-idle" />
      </div>
      <span>↓</span>
      <S s="DELETED" tone="border-border-strong text-muted-foreground" />
    </div>
  );
};

const SnapshotViz = () => (
  <div className="flex w-full max-w-[280px] items-center gap-3">
    <div className="grid flex-1 grid-cols-8 gap-[3px]" aria-hidden="true">
      {Array.from({ length: 40 }, (_, i) => (
        <span
          key={i}
          className={cn("aspect-square", (i * 7) % 5 < 2 ? "bg-ember" : (i * 3) % 4 === 0 ? "bg-ember/40" : "bg-[#222]")}
        />
      ))}
    </div>
    <span className="font-mono text-[0.7rem] text-dim">→</span>
    <div className="space-y-1.5 font-mono text-[0.62rem]">
      <div className="border border-border-strong px-2 py-1.5 text-muted-foreground">vm.snap</div>
      <div className="border border-border-strong px-2 py-1.5 text-muted-foreground">vm.mem</div>
    </div>
  </div>
);

const PortsViz = () => (
  <div className="w-full max-w-[280px] space-y-2 font-mono text-[0.68rem]">
    {[
      ["8004", "3000"],
      ["8005", "5173"],
      ["8006", "8080"],
    ].map(([h, g], i) => (
      <div key={h} className="flex items-center gap-2">
        <span className={cn("border px-2 py-1", i === 0 ? "border-ember text-ember" : "border-border-strong text-muted-foreground")}>
          :{h}
        </span>
        <span className="h-px flex-1 bg-border-strong" />
        <span className="text-dim">dnat</span>
        <span className="h-px flex-1 bg-border-strong" />
        <span className="border border-border-strong px-2 py-1 text-muted-foreground">vm:{g}</span>
      </div>
    ))}
  </div>
);

const ExecViz = () => (
  <div className="w-full max-w-[280px] border border-border-strong font-mono text-[0.66rem] leading-relaxed">
    <div className="border-b border-border-strong px-3 py-2">
      <span className="text-ember">POST</span> <span className="text-muted-foreground">/exec/run</span>
      <div className="text-dim">{`{ "command": "whoami" }`}</div>
    </div>
    <div className="px-3 py-2">
      <span className="text-ok">200</span>{" "}
      <span className="text-dim">{`{ "result": "root" }`}</span>
    </div>
  </div>
);

const ReconcileViz = () => (
  <ul className="w-full max-w-[280px] space-y-1.5 font-mono text-[0.62rem]">
    {[
      ["CREATING", "FAILED + teardown", "text-bad"],
      ["TERMINATING", "finish delete", "text-muted-foreground"],
      ["PAUSING", "roll back", "text-muted-foreground"],
      ["RUNNING, no pid", "FAILED", "text-bad"],
      ["port maps", "re-add DNAT", "text-ok"],
    ].map(([a, b, tone]) => (
      <li key={a} className="flex items-center justify-between gap-2 border-b border-border pb-1.5">
        <span className="text-dim">{a}</span>
        <span className={tone}>{b}</span>
      </li>
    ))}
  </ul>
);
