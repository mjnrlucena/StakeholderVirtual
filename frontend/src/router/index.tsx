import { createBrowserRouter } from "react-router-dom";
import App from "@/App";
import { ChatPage } from "@/pages/ChatPage/ChatPage";
import { NotFoundPage } from "@/pages/NotFound/NotFoundPage";

/**
 * Rotas atuais: só o chat. Estrutura já preparada para crescer
 * (ex.: /login, /feedback) — ver pastas em src/pages/.
 */
export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <ChatPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
