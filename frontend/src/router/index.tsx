import { createBrowserRouter } from "react-router-dom";
import App from "@/App";
import { RequireAdmin, RequireProfessor } from "@/components/auth/RequireAdmin";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AdminDashboardPage } from "@/pages/Admin/AdminDashboardPage";
import { CadastrosPage } from "@/pages/Admin/CadastrosPage";
import { LogsDashboardPage } from "@/pages/Admin/logs/LogsDashboardPage";
import { ChatPage } from "@/pages/ChatPage/ChatPage";
import { ForgotPasswordPage } from "@/pages/ForgotPassword/ForgotPasswordPage";
import { LoginPage } from "@/pages/Login/LoginPage";
import { NotFoundPage } from "@/pages/NotFound/NotFoundPage";
import { ProjectSelectPage } from "@/pages/ProjectSelect/ProjectSelectPage";
import { RegisterPage } from "@/pages/Register/RegisterPage";
import { ResetPasswordPage } from "@/pages/ResetPassword/ResetPasswordPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { path: "login", element: <LoginPage /> },
      { path: "registro", element: <RegisterPage /> },
      { path: "esqueci-senha", element: <ForgotPasswordPage /> },
      { path: "redefinir-senha", element: <ResetPasswordPage /> },

      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <ProjectSelectPage /> },
          { path: "projetos/:projectId", element: <ChatPage /> },
          { path: "projetos/:projectId/:chatId", element: <ChatPage /> },

          {
            element: <RequireAdmin />,
            children: [
              { path: "admin", element: <AdminDashboardPage /> },
              {
                element: <RequireProfessor />,
                children: [
                  { path: "admin/logs", element: <LogsDashboardPage /> },
                  { path: "admin/cadastros", element: <CadastrosPage /> },
                ],
              },
            ],
          },
        ],
      },

      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
