import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Video, Loader2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGoogleLogin } from "@react-oauth/google";

type AuthState = "idle" | "loading" | "success";

export default function Auth() {
  const [authState, setAuthState] = useState<AuthState>("idle");
  const navigate = useNavigate();
  const { toast } = useToast();

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setAuthState("loading");
      try {
        const response = await fetch("http://localhost:8000/api/auth/google/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token: tokenResponse.access_token }),
        });

        if (!response.ok) {
          throw new Error("Authentication failed");
        }

        const data = await response.json();

        if (data.access) {
          localStorage.setItem("accessToken", data.access);
          localStorage.setItem("refreshToken", data.refresh);
          setAuthState("success");
          toast({
            title: "Welcome to DemoForge!",
            description: "You've successfully signed in.",
          });
          setTimeout(() => navigate("/dashboard"), 1000);
        }
      } catch (error) {
        console.error(error);
        setAuthState("idle");
        toast({
          title: "Authentication Failed",
          description: "Could not sign in with Google.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      setAuthState("idle");
      toast({
        title: "Authentication Failed",
        description: "Google sign in failed.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Branding */}
      <div className="relative hidden w-1/2 bg-gradient-hero lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsla(0,0%,100%,0.1),transparent)]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground/20 backdrop-blur">
              <Video className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold text-primary-foreground">DemoForge</span>
          </Link>

          <div className="max-w-md">
            <h1 className="mb-4 text-4xl font-bold text-primary-foreground">
              Create stunning demos in minutes
            </h1>
            <p className="text-lg text-primary-foreground/80">
              Join thousands of product teams using AI to create professional demo videos without any video editing skills.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary bg-primary-foreground text-sm font-medium text-foreground"
                >
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <p className="text-sm text-primary-foreground/80">
              <span className="font-semibold text-primary-foreground">2,000+</span> teams trust DemoForge
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-hero">
                <Video className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-semibold">DemoForge</span>
            </Link>
          </div>

          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold">Welcome back</h2>
            <p className="mt-2 text-muted-foreground">
              Sign in to continue to your dashboard
            </p>
          </div>

          {authState === "success" ? (
            <div className="animate-scale-in rounded-2xl border border-success/20 bg-success/5 p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success">
                <Check className="h-8 w-8 text-success-foreground" />
              </div>
              <h3 className="text-xl font-semibold">Success!</h3>
              <p className="mt-2 text-muted-foreground">Redirecting to dashboard...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <Button
                variant="outline"
                size="lg"
                className="w-full gap-3"
                onClick={() => login()}
                disabled={authState === "loading"}
              >
                {authState === "loading" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                Continue with Google
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
