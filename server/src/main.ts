import { createApp } from "./app";
import { createPool } from "./db";

const port = Number(process.env.PORT ?? 3000);
const app = await createApp(createPool());
await app.listen(port);
console.log(`Bauwerk server listening on http://localhost:${port}`);
