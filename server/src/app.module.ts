import { Module } from "@nestjs/common";
import type { Pool } from "pg";
import { DB, createPool } from "./db";
import { ProjectsController } from "./projects/projects.controller";
import { ProjectsGateway } from "./projects/projects.gateway";
import { ProjectsService } from "./projects/projects.service";

export function createAppModule(pool: Pool = createPool()) {
  @Module({
    controllers: [ProjectsController],
    providers: [{ provide: DB, useValue: pool }, ProjectsService, ProjectsGateway],
  })
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Nest modules are declared as empty classes
  class AppModule {}
  return AppModule;
}
