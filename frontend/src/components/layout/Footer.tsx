import { Link } from "react-router-dom";
import { Video } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-secondary/30">
      <div className="container py-12">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-hero">
              <Video className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">DemoForge</span>
          </div>

          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/privacy" className="transition-colors hover:text-foreground">
              Privacy Policy
            </Link>
            <Link to="/terms" className="transition-colors hover:text-foreground">
              Terms of Service
            </Link>
            <a href="mailto:hello@demoforge.io" className="transition-colors hover:text-foreground">
              Contact
            </a>
          </nav>

          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} DemoForge. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
