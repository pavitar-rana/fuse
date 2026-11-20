import Link from "next/link";
import { Flame, LogOut } from "lucide-react";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export const SiteHeader = async () => {
  const session = await auth();
  const email = session?.user?.email;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container mx-auto flex h-14 items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Flame className="h-4 w-4" />
          </span>
          Fuse
        </Link>

        <nav className="flex items-center gap-2">
          {email ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <Button type="submit" variant="outline" size="sm">
                  <LogOut className="mr-1.5 h-4 w-4" />
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
};
