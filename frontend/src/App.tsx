import { Outlet } from "react-router-dom";
import { TopBar } from "@/components/layout/TopBar";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

function App() {
  return (
    <ThemeProvider>
      <div className="relative flex h-dvh flex-col bg-[var(--background)]">
        <TopBar />
        <div className="min-h-0 flex-1">
          <Outlet />
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
