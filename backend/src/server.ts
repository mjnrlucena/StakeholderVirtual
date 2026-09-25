import { app } from "./app";
import { env } from "./env";

app.listen(env.port, () => {
  console.log(`Backend rodando na porta ${env.port}`);
});
