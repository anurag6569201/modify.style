import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Clapperboard, LogOut, User, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestSignIn } from "@/hooks/useGuestSignIn";
import { UpgradeDialog } from "@/components/UpgradeDialog";

export function Header() {
  const navigate = useNavigate();
  const { user, plan, isAuthenticated, signOut } = useAuth();
  const signIn = useGuestSignIn();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const handleLogout = () => {
    signOut();
    navigate("/dashboard");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link
          to="/dashboard"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
            <Clapperboard className="h-[18px] w-[18px] text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">DemoForge</span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          {isAuthenticated ? (
            <>
              <Button variant="ghost" asChild className="hidden sm:inline-flex">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
              <Button variant="ghost" asChild className="hidden md:inline-flex">
                <Link to="/recorder">Record</Link>
              </Button>
              {plan === "free" && (
                <Button
                  variant="outline"
                  className="hidden gap-1.5 sm:inline-flex"
                  onClick={() => setUpgradeOpen(true)}
                >
                  <Sparkles className="h-4 w-4 text-primary" />
                  Upgrade
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarImage alt={user?.name} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user?.name?.charAt(0)?.toUpperCase() || <User className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex items-center gap-2 p-2">
                    <div className="flex flex-col space-y-0.5">
                      <p className="text-sm font-medium">{user?.name}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    <Badge
                      variant={plan === "pro" ? "default" : "secondary"}
                      className="ml-auto capitalize"
                    >
                      {plan}
                    </Badge>
                  </div>
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                className="hidden sm:inline-flex"
                onClick={() => signIn()}
              >
                Sign in
              </Button>
              <Button variant="hero" asChild>
                <Link to="/recorder">Start recording</Link>
              </Button>
            </>
          )}
        </nav>
      </div>

      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </header>
  );
}
