import { app } from "./app";
import { env } from "./env";
import { ensureLogSearchSetup } from "./services/searchSetup.service";

async function main() {
  await ensureLogSearchSetup();

  app.listen(env.port, () => {
    console.log(`Backend rodando na porta ${env.port}`);
  });
}

main();
