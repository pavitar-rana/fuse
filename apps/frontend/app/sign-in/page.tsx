import { auth, signIn } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Zap, Lock, Cpu, ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getLimitsText } from "@/lib/limits";

const SignInPage = async () => {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");
  const limitsText = await getLimitsText();

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <Link
        href="/"
        className="absolute left-6 top-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to home
      </Link>
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center">
        {/* Left Side - Branding */}
        <div className="hidden md:block space-y-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 bg-primary rounded-lg flex items-center justify-center">
                <Server className="h-7 w-7 text-primary-foreground" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Fuse
              </h1>
            </div>
            <p className="text-xl text-muted-foreground">Lightning-fast VMs and sandboxes on demand</p>
          </div>

          <div className="space-y-4 pt-8">
            <div className="flex items-start space-x-4 p-4 rounded-lg bg-muted/50 border border-border/50">
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Instant Provisioning</h3>
                <p className="text-sm text-muted-foreground">
                  Spin up isolated Linux VMs in seconds on Firecracker microVMs
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4 p-4 rounded-lg bg-muted/50 border border-border/50">
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Cpu className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Powerful Performance</h3>
                <p className="text-sm text-muted-foreground">
                  High-performance compute with dedicated resources and low overhead
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4 p-4 rounded-lg bg-muted/50 border border-border/50">
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Secure Isolation</h3>
                <p className="text-sm text-muted-foreground">
                  Every sandbox gets its own kernel and network port, isolated from other users
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Sign In Form */}
        <div className="flex items-center justify-center">
          <Card className="w-full max-w-md shadow-2xl border-2">
            <CardHeader className="space-y-3 text-center pb-6">
              <div className="mx-auto h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                <Server className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-3xl font-bold">Sign in to Fuse</CardTitle>
              <CardDescription className="text-base">Sign in to access your VMs and sandboxes</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                action={async () => {
                  "use server";
                  await signIn("google", { redirectTo: "/dashboard" });
                }}
              >
                <button
                  type="submit"
                  className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
                >
                  <span>Continue with Google</span>
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-xs text-center text-muted-foreground">
                  {limitsText}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mobile Branding */}
        <div className="md:hidden text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
              <Server className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">Fuse</h1>
          </div>
          <p className="text-sm text-muted-foreground">Lightning-fast VMs and sandboxes on demand</p>
        </div>
      </div>
    </div>
  );
};
export default SignInPage;
