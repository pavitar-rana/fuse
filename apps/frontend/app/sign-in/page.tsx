import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Bracket, Wordmark } from "@/components/brand";
import { HeroTerminal } from "@/components/hero-terminal";
import { Button } from "@/components/ui/button";
import { getLimitsText } from "@/lib/limits";

const SignInPage = async () => {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");
  const limitsText = await getLimitsText();

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="flex flex-col">
        <div className="flex h-14 items-center justify-between border-b px-6 sm:px-10">
          <Link href="/" aria-label="Fuse home">
            <Wordmark />
          </Link>
          <Link
            href="/"
            className="font-mono text-[0.7rem] uppercase tracking-[0.06em] text-muted-foreground hover:text-foreground"
          >
            Back to site
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
          <Bracket tone="ember">Sign in</Bracket>
          <h1 className="mt-5 text-[2.3rem] font-medium leading-[1.05] tracking-[-0.035em]">
            Welcome to Fuse.
            <br />
            <span className="text-dim">Your sandboxes are waiting.</span>
          </h1>
          <p className="mt-5 text-[0.95rem] leading-relaxed text-muted-foreground">
            Sign in with Google to boot sandboxes and get an API key.
          </p>

          <form
            className="mt-9"
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <Button type="submit" size="lg" variant="light" className="w-full">
              Continue with Google
            </Button>
          </form>

          <p className="mt-6 font-mono text-[0.68rem] uppercase leading-relaxed tracking-[0.05em] text-dim">
            <span className="text-ember">▸</span> {limitsText}
          </p>
        </div>
      </div>

      <div className="relative hidden items-center border-l bg-card px-10 lg:flex xl:px-16">
        <div className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="relative w-full">
          <HeroTerminal />
        </div>
      </div>
    </div>
  );
};

export default SignInPage;
