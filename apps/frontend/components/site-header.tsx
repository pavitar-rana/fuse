import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand";

const GITHUB_URL = "https://github.com/pavitar-rana/fuse";

const navLink =
  "font-mono text-[0.72rem] uppercase tracking-[0.06em] text-muted-foreground transition-colors hover:text-foreground";

export const SiteHeader = async () => {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <div className="frame flex h-14 items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" aria-label="Fuse home">
            <Wordmark />
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/#platform" className={navLink}>
              Platform
            </Link>
            <Link href="/#api" className={navLink}>
              API
            </Link>
            <Link href="/#internals" className={navLink}>
              Internals
            </Link>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={navLink}>
              GitHub
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user?.email ? (
            <>
              <span className="hidden font-mono text-[0.72rem] text-dim lg:inline">
                {user.email}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <Button type="submit" variant="ghost" size="sm">
                  Sign out
                </Button>
              </form>
              <Button asChild size="sm" variant="light">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                  Star on GitHub
                </a>
              </Button>
              <Button asChild size="sm" variant="light">
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
