import { Outlet } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { useChatExpirationWatcher } from "@/hooks/useChatExpirationWatcher";

function App() {
  // Hidrata o chat do localStorage e observa inatividade (expira em 30min).
  useChatExpirationWatcher();

  return (
    <ThemeProvider>
      <div className="flex min-h-screen flex-col bg-[var(--background)]">
        <Header />
        <main className="flex flex-1 flex-col">
          <Outlet />
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
