import {
  Body,
  Controller,
  Header,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { validateBuilding } from "@/geometry/export";
import type { Building } from "@/geometry/types";
import { clientServed } from "../app";
import { ProjectsService } from "../projects/projects.service";
import { ReportService } from "./report.service";

const fileName = (name: string) => {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9äöüß]+/g, "-")
      .replace(/^-|-$/g, "") || "building";
  return `bauwerk-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`;
};

const lang = (q: string | undefined): "en" | "de" => (q === "de" ? "de" : "en");
const baseUrlOf = (req: Request) => `${req.protocol}://${req.get("host") ?? "127.0.0.1"}`;

@Controller("reports")
export class ReportsController {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(ReportService) private readonly reports: ReportService,
  ) {}

  /** PDF of a stored project. */
  @Post(":projectId")
  @Header("Content-Type", "application/pdf")
  async forProject(
    @Param("projectId") id: string,
    @Query("lang") language: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!clientServed()) throw new ServiceUnavailableException("client build not served");
    const project = await this.projects.get(id);
    if (!project) throw new NotFoundException();
    const pdf = await this.reports.renderPdf(project.building, lang(language), baseUrlOf(req));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName(project.building.name)}"`,
    );
    res.end(pdf);
  }

  /** PDF of a building sent in the body, for clients that work without a project. */
  @Post()
  @Header("Content-Type", "application/pdf")
  async forBody(
    @Body() body: { building: Building },
    @Query("lang") language: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const error = validateBuilding(body.building);
    if (error) {
      res.status(422).json({ error: "invalid", detail: error });
      return;
    }
    if (!clientServed()) throw new ServiceUnavailableException("client build not served");
    const pdf = await this.reports.renderPdf(body.building, lang(language), baseUrlOf(req));
    res.setHeader("Content-Disposition", `attachment; filename="${fileName(body.building.name)}"`);
    res.end(pdf);
  }
}
