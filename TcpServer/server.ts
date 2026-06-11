import net from "net";
import fs from "fs";

// --- Global Declarations ---
const FILE_PATH = "lessons.ndjson";
const PORT = 8080;
const HOST = "127.0.0.1";

const BUF_SIZE = 170;
const TYPE_OFFSET = 0;
const TYPE_LENGTH = 20;
const TITLE_OFFSET = 20;
const TITLE_LENGTH = 50;
const DESC_OFFSET = 70;
const DESC_LENGTH = 100;

type MessageType = "create_lesson" | "delete_lesson" | "update_lesson";

interface ClientMessage {
  type: MessageType;
  title?: string;
  description?: string;
  id?: string;
}

interface ServerResponse {
  ok: boolean;
  status: "success" | "error";
  message: string;
}
// --- End Global Declarations ---

function createLesson(msg: ClientMessage): ServerResponse {
  fs.appendFileSync(FILE_PATH, JSON.stringify({ title: msg.title, description: msg.description }) + "\n");
  return { ok: true, status: "success", message: "Lesson created successfully" };
}

function deleteLesson(msg: ClientMessage): ServerResponse {
  // TODO
  return { ok: false, status: "error", message: "Not implemented" };
}

function updateLesson(msg: ClientMessage): ServerResponse {
  // TODO
  return { ok: false, status: "error", message: "Not implemented" };
}

function handleClientData(msg: ClientMessage): ServerResponse {
  switch (msg.type) {
    case "create_lesson":
      return createLesson(msg);

    case "delete_lesson":
      return deleteLesson(msg);

    case "update_lesson":
      return updateLesson(msg);

    default:
      return { ok: false, status: "error", message: "Unknown request type" };
  }
}

let clientCount = 0;

const server = net.createServer((socket) => {
  console.log("Client connected");
  clientCount++;
  console.log(`Total clients connected: ${clientCount}`);

  socket.on("data", (data: Buffer) => {
    const type = data.toString("utf-8", TYPE_OFFSET, TYPE_OFFSET + TYPE_LENGTH).replace(/\0/g, "").trim() as MessageType;
    const title = data.toString("utf-8", TITLE_OFFSET, TITLE_OFFSET + TITLE_LENGTH).trim();
    const description = data.toString("utf-8", DESC_OFFSET, DESC_OFFSET + DESC_LENGTH).trim();

    const msg: ClientMessage = { type, title, description };
    const response: ServerResponse = handleClientData(msg);
    socket.write(JSON.stringify(response));
  });

  socket.on("end", () => {
    console.log("Client disconnected");
    clientCount--;
  });
});

server.listen(PORT, HOST, () => {
  console.log(`TCP server listening on port ${PORT} at ${HOST}`);
});