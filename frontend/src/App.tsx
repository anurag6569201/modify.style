import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Recorder from "./pages/Recorder";
import Editor from "./pages/Editor";
import Render from "./pages/Render";
import Share from "./pages/Share";
import NotFound from "./pages/NotFound";

import { AuthProvider } from "./contexts/AuthContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
          {/* Land people straight in the product — no marketing page. */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/auth" element={<Auth />} />
          {/* Public share player — anyone with the link, no auth */}
          <Route path="/v/:slug" element={<Share />} />

          {/*
            Guest-first: the core create flow (dashboard, record, edit, render)
            is open to everyone. Each page nudges guests to sign in when they
            hit an account-only action (save to cloud, share, extra renders).
          */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/recorder" element={<Recorder />} />
          <Route path="/editor/:id" element={<Editor />} />
          <Route path="/render" element={<Render />} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
