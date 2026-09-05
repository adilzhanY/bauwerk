import "reflect-metadata";
import { existsSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { WsAdapter } from "@nestjs/platform-ws";
import type { INestApplication } from "@nestjs/common";
import type { Pool } from "pg";
import { createAppModule } from "./app.module";
import { ensureSchema } from "./db";

/** The built client, served alongside the API so the PDF endpoint can print it. */
const DIST = fileURLToPath(new URL("../../dist/", import.meta.url));
export const clientServed = (): boolean => existsSync(`${DIST}index.html`);

export async function createApp(
  pool: Pool,
  options: { logger?: boolean } = {},
): Promise<INestApplication> {
  await ensureSchema(pool);
  const app = await NestFactory.create<NestExpressApplication>(createAppModule(pool), {
    logger: options.logger === false ? false : ["log", "warn", "error"],
  });
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableCors({ origin: true, exposedHeaders: ["ETag"] });
  if (clientServed()) app.useStaticAssets(DIST);
  return app;
}
