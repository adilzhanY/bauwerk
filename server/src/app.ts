import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { WsAdapter } from "@nestjs/platform-ws";
import type { INestApplication } from "@nestjs/common";
import type { Pool } from "pg";
import { createAppModule } from "./app.module";
import { ensureSchema } from "./db";

export async function createApp(
  pool: Pool,
  options: { logger?: boolean } = {},
): Promise<INestApplication> {
  await ensureSchema(pool);
  const app = await NestFactory.create(createAppModule(pool), {
    logger: options.logger === false ? false : ["log", "warn", "error"],
  });
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableCors({ origin: true, exposedHeaders: ["ETag"] });
  return app;
}
