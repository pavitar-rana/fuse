import type { CSSProperties } from "react";

// The real create sequence from the control plane, played once on load:
// a spark burns down the fuse and lights each step as it reaches it.
const STEPS = [
  { title: "Reserve an IP", detail: "172.16.0.14 from the host's IpPool" },
  { title: "Copy the rootfs", detail: "cp --reflink=auto golden.ext4 vm-ck3f.ext4" },
  { title: "Create a TAP", detail: "tap-ck3f on br0, isolated port + NAT" },
  { title: "Spawn Firecracker", detail: "--api-sock /tmp/firecracker-ck3f.socket" },
  { title: "Configure the VM", detail: "PUT /boot-source /drives /network-interfaces" },
  { title: "Start the instance", detail: "PUT /actions InstanceStart" },
  { title: "Wait for the guest", detail: "sshd answers on 172.16.0.14:22" },
];

const DURATION = 3.2; // seconds for the spark to travel the whole fuse
const START = 0.4;
const ROW = 52; // px, fixed so nodes sit at even intervals along the line

export const BootTrace = () => {
  const last = STEPS.length - 1;
  const doneAt = START + DURATION;

  return (
    <figure
      aria-label="What happens when you create a sandbox"
      className="overflow-hidden rounded-xl bg-well text-[#e3e9f2] shadow-[0_30px_80px_-30px_rgb(10_16_32/0.55)] ring-1 ring-white/5"
    >
      <div className="flex items-center justify-between border-b border-white/8 px-5 py-3 font-mono text-[0.78rem]">
        <span>
          <span className="text-spark">POST</span>{" "}
          <span className="text-[#c4cede]">/firecracker/create</span>
        </span>
        <span
          className="trace-step rounded bg-[#3ccf8e]/15 px-1.5 py-0.5 text-[#3ccf8e]"
          style={{ animationDelay: `${doneAt}s` }}
        >
          201 Created
        </span>
      </div>

      <ol
        className="relative px-5 py-4"
        style={{ "--trace-duration": `${DURATION}s` } as CSSProperties}
      >
        {/* the fuse: an unlit track, the burnt part, and the spark */}
        <div
          aria-hidden="true"
          className="absolute left-[29px] w-[2px]"
          style={{ top: 16 + ROW / 2, height: ROW * last }}
        >
          <div className="absolute inset-0 bg-white/12" />
          <div className="trace-burn absolute inset-0 bg-spark" />
          <div className="trace-spark absolute left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffe3a3] shadow-[0_0_6px_2px_#f5a524,0_0_18px_6px_rgb(245_165_36/0.45)]" />
        </div>

        {STEPS.map((step, i) => {
          const delay = `${START + (DURATION * i) / last}s`;
          return (
            <li
              key={step.title}
              className="trace-step relative flex items-center gap-4"
              style={{ height: ROW, animationDelay: delay }}
            >
              <span
                aria-hidden="true"
                className="trace-node relative z-10 h-[11px] w-[11px] shrink-0 rounded-full border-2"
                style={{ animationDelay: delay }}
              />
              <div className="min-w-0">
                <p className="text-[0.92rem] font-medium leading-tight">{step.title}</p>
                <p className="truncate font-mono text-[0.74rem] leading-relaxed text-[#8d9ab0]">
                  {step.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <figcaption
        className="trace-step flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/8 px-5 py-3 font-mono text-[0.78rem]"
        style={{ animationDelay: `${doneAt}s` }}
      >
        <span className="flex items-center gap-1.5 text-[#3ccf8e]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#3ccf8e]" />
          RUNNING
        </span>
        <span className="text-[#8d9ab0]">id</span>
        <span>ck3f9q2x0001</span>
        <span className="text-[#8d9ab0]">1 vCPU, 512 MB</span>
      </figcaption>
    </figure>
  );
};
