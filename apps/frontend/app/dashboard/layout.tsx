import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";

// Everything under /dashboard requires a signed-in user.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
