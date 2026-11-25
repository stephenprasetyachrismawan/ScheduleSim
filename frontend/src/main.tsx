import "@fontsource/geist/400";
import "@fontsource/geist/500";
import "@fontsource/geist/600";
import "@fontsource/geist/700";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/600.css";
import "./styles/app.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { LearnProvider } from "./learn/Learn";

const client = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <LearnProvider>
          <App />
        </LearnProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
