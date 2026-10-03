import { createBrowserRouter } from "react-router-dom";
import App from "@/App";
import { RequireAdmin, RequireProfessor } from "@/components/auth/RequireAdmin";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AdminDashboardPage } from "@/pages/Admin/AdminDashboardPage";
import { LogsDashboardPage } from "@/pages/Admin/logs/LogsDashboardPage";
import { ChatPage } from "@/pages/ChatPage/ChatPage";
import { LoginPage } from "@/pages/Login/LoginPage";
import { NotFoundPage } from "@/pages/NotFound/NotFoundPage";
import { ProjectSelectPage } from "@/pages/ProjectSelect/ProjectSelectPage";
import { RegisterPage } from "@/pages/Register/RegisterPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { path: "login", element: <LoginPage /> },
      { path: "registro", element: <RegisterPage /> },

      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <ProjectSelectPage /> },
          { path: "projetos/:projectId", element: <ChatPage /> },

          {
            element: <RequireAdmin />,
            children: [
              { path: "admin", element: <AdminDashboardPage /> },
              {
                element: <RequireProfessor />,
                children: [{ path: "admin/logs", element: <LogsDashboardPage /> }],
              },
            ],
          },
        ],
      },

      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
