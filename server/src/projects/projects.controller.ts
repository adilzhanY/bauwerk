import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import { ProjectsService } from "./projects.service";
import type { WriteResult } from "./projects.service";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function buildingOf(body: unknown): unknown {
  if (!isRecord(body) || !("building" in body)) {
    throw new BadRequestException({ error: "buildingRequired" });
  }
  return body.building;
}

function unwrap(result: WriteResult) {
  if (result.ok) return result.project;
  switch (result.reason) {
    case "conflict":
      throw new HttpException({ error: "conflict", current: result.current }, 409);
    case "invalid":
      throw new HttpException({ error: "invalid", detail: result.error }, 422);
    case "notFound":
      throw new NotFoundException();
  }
}

const actorOf = (header: string | undefined) =>
  header && header.trim() !== "" ? header.trim().slice(0, 64) : "anonymous";

@Controller("projects")
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projects: ProjectsService) {}

  @Get()
  list() {
    return this.projects.list();
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const project = await this.projects.get(id);
    if (!project) throw new NotFoundException();
    return project;
  }

  @Post()
  async create(@Body() body: unknown, @Headers("x-actor") actor?: string) {
    return unwrap(await this.projects.create(buildingOf(body), actorOf(actor)));
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() body: unknown, @Headers("x-actor") actor?: string) {
    const building = buildingOf(body);
    const baseVersion = isRecord(body) ? body.baseVersion : undefined;
    if (typeof baseVersion !== "number" || !Number.isInteger(baseVersion) || baseVersion < 1)
      throw new HttpException({ error: "baseVersionRequired" }, 400);
    return unwrap(await this.projects.update(id, building, baseVersion, actorOf(actor)));
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id") id: string) {
    if (!(await this.projects.remove(id))) throw new NotFoundException();
  }
}
