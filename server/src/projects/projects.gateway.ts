import { Inject } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import type { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from "@nestjs/websockets";
import { WebSocketGateway } from "@nestjs/websockets";
import type { WebSocket } from "ws";
import { ProjectsService } from "./projects.service";
import type { ProjectUpdated } from "./projects.service";

/** Messages a client may send. */
export type ClientMessage =
  | { type: "join"; projectId: string; actor: string; color: string }
  | { type: "selection"; selection: unknown };

/** Messages the server sends. */
export type ServerMessage =
  | { type: "update"; version: number; building: unknown; actor: string }
  | { type: "presence"; actors: { actor: string; color: string; selection: unknown }[] }
  | { type: "selection"; actor: string; selection: unknown };

interface Member {
  socket: WebSocket;
  actor: string;
  color: string;
  selection: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const isIndex = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

function isSelection(value: unknown): boolean {
  if (value === null) return true;
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  switch (value.kind) {
    case "vertex":
      return isIndex(value.index);
    case "wall":
    case "interiorWall":
      return isText(value.storeyId, 128) && isIndex(value.wallIndex ?? value.index);
    case "opening":
    case "room":
    case "radiator":
    case "pipe":
      return isText(value.storeyId, 128) && isText(value.id, 128);
    case "storey":
    case "zone":
    case "heatPump":
      return isText(value.id, 128);
    case "roof":
      return true;
    default:
      return false;
  }
}

function isClientMessage(value: unknown): value is ClientMessage {
  if (!isRecord(value)) return false;
  if (value.type === "join") {
    return (
      isText(value.projectId, 128) &&
      isText(value.actor, 64) &&
      typeof value.color === "string" &&
      /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value.color)
    );
  }
  return value.type === "selection" && isSelection(value.selection);
}

/**
 * One room per project. Every accepted write is broadcast to the room, presence
 * is broadcast on join, leave and selection change. Uses plain `ws`, so the
 * client needs nothing but the browser's WebSocket.
 */
@WebSocketGateway({ path: "/ws" })
export class ProjectsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly rooms = new Map<string, Set<Member>>();
  private readonly members = new Map<WebSocket, { projectId: string; member: Member }>();

  constructor(@Inject(ProjectsService) private readonly projects: ProjectsService) {}

  private readonly onProjectUpdated = ({ project, actor }: ProjectUpdated) => {
    this.broadcast(project.id, {
      type: "update",
      version: project.version,
      building: project.building,
      actor,
    });
  };

  afterInit() {
    this.projects.events.on("updated", this.onProjectUpdated);
  }

  onModuleDestroy() {
    this.projects.events.off("updated", this.onProjectUpdated);
    this.rooms.clear();
    this.members.clear();
  }

  handleConnection(socket: WebSocket) {
    socket.on("message", (raw: Buffer | string) => {
      let message: ClientMessage;
      try {
        const parsed: unknown = JSON.parse(String(raw));
        if (!isClientMessage(parsed)) throw new Error("invalid message");
        message = parsed;
      } catch {
        socket.close(1003, "Invalid message");
        return;
      }
      this.handle(socket, message);
    });
  }

  handleDisconnect(socket: WebSocket) {
    const entry = this.members.get(socket);
    if (!entry) return;
    this.members.delete(socket);
    const room = this.rooms.get(entry.projectId);
    room?.delete(entry.member);
    if (room?.size === 0) this.rooms.delete(entry.projectId);
    this.sendPresence(entry.projectId);
  }

  private handle(socket: WebSocket, message: ClientMessage) {
    if (message.type === "join") {
      this.handleDisconnect(socket);
      const member: Member = {
        socket,
        actor: message.actor.trim(),
        color: message.color,
        selection: null,
      };
      const room = this.rooms.get(message.projectId) ?? new Set<Member>();
      room.add(member);
      this.rooms.set(message.projectId, room);
      this.members.set(socket, { projectId: message.projectId, member });
      this.sendPresence(message.projectId);
      return;
    }
    const entry = this.members.get(socket);
    if (!entry) return;
    entry.member.selection = message.selection;
    this.broadcast(
      entry.projectId,
      { type: "selection", actor: entry.member.actor, selection: message.selection },
      socket,
    );
  }

  private sendPresence(projectId: string) {
    const room = this.rooms.get(projectId);
    if (!room) return;
    const actors = [...room].map((m) => ({
      actor: m.actor,
      color: m.color,
      selection: m.selection,
    }));
    this.broadcast(projectId, { type: "presence", actors });
  }

  private broadcast(projectId: string, message: ServerMessage, except?: WebSocket) {
    const room = this.rooms.get(projectId);
    if (!room) return;
    const text = JSON.stringify(message);
    for (const m of room) {
      if (m.socket !== except && m.socket.readyState === 1) m.socket.send(text);
    }
  }

  /** Test helper. */
  roomSize(projectId: string): number {
    return this.rooms.get(projectId)?.size ?? 0;
  }
}
