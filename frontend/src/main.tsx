import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import { GoogleOAuthProvider } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
if (!GOOGLE_CLIENT_ID) {
  console.error(
    "VITE_GOOGLE_CLIENT_ID is missing. Copy frontend/.env.example to frontend/.env and set your Google OAuth client ID."
  );
}

createRoot(document.getElementById("root")!).render(
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID ?? ""}>
    <App />
  </GoogleOAuthProvider>
);
