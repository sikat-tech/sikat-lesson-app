import net from "node:net";
import fs from "node:fs";

const LESSONS_FILE = "frontend/lessons.ndjson";

interface Lesson {
  id: string;
  title: string;
  desc: string;
}

interface ServerResponse {
  action: string;
  lessons?: Lesson[];
  message?: string;
  lesson?: Lesson;
}

interface Request {
  action: "create" | "view";
  title?: string;
  desc?: string;
}

 

const PORT = 3000;
const COL_ID = 12;
const COL_TITLE = 50;
const COL_DESC = 223;
const LINE_RECORD_SIZE = 318;

const clients: net.Socket[] = [];

function byteRead(value: string | number, size: number): string {
  const buf = Buffer.alloc(size);
  buf.write(String(value), "utf8");
  return buf.subarray(0, String(value).length).toString();
}

function getNextId(): number {
  try {
    if (!fs.existsSync(LESSONS_FILE)) return 1;

    const content = fs.readFileSync(LESSONS_FILE, "utf8");
    const lines = content.split("\n").filter((line) => line.trim());

    if (lines.length === 0) return 1;

    return lines.length + 1;
  } catch {
    return 1;
  }
}

function appendLesson(lesson: Lesson): void {
  const cleanLesson: Lesson = {
    id: String(lesson.id).substring(0, COL_ID),
    title: String(lesson.title).substring(0, COL_TITLE),
    desc: String(lesson.desc).substring(0, COL_DESC),
  };

  let jsonStr = JSON.stringify(cleanLesson);
  const paddingNeeded = LINE_RECORD_SIZE - jsonStr.length - 1;

  if (paddingNeeded > 0) {
    jsonStr += " ".repeat(paddingNeeded);
  }

  fs.appendFileSync(LESSONS_FILE, jsonStr + "\n", "utf8");
}

function getAllLessons(): Lesson[] {
  try {
    if (!fs.existsSync(LESSONS_FILE)) return [];

    const content = fs.readFileSync(LESSONS_FILE, "utf8");
    const lines = content.split("\n").filter((line) => line.trim());

    const lessons: Lesson[] = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line.trim()) as Lesson;
        if (parsed.id !== "DELETED") {
          lessons.push(parsed);
        }
      } catch {
        console.error("Failed to parse line:", line);
      }
    }

    return lessons;
  } catch {
    return [];
  }
}

function handleRequest(socket: net.Socket, raw: string): void {
  let request: Request;
  try {
    request = JSON.parse(raw) as Request;
  } catch {
    socket.write(JSON.stringify({ action: "error", message: "Invalid JSON" } satisfies ServerResponse) + "\n");
    return;
  }

  if (request.action === "create") {
    const title = request.title ?? "";
    const desc = request.desc ?? "";

    if (!title.trim() || !desc.trim()) {
      socket.write(JSON.stringify({ action: "error", message: "Title and description are required" } satisfies ServerResponse) + "\n");
      return;
    }

    const id = getNextId();
    const lesson: Lesson = {
      id: byteRead(id, COL_ID),
      title: byteRead(title, COL_TITLE),
      desc: byteRead(desc, COL_DESC),
    };

    appendLesson(lesson);
    console.log(`[Server] Lesson created: [${id}] ${title}`);

    socket.write(JSON.stringify({ action: "lesson_created", lesson } satisfies ServerResponse) + "\n");

    clients.forEach((client) => {
      if (client !== socket && client.writable) {
        client.write(JSON.stringify({ action: "new_lesson_broadcast", lesson } satisfies ServerResponse) + "\n");
      }
    });
  } else if (request.action === "view") {
    const lessons = getAllLessons();
    socket.write(JSON.stringify({ action: "lessons_list", lessons } satisfies ServerResponse) + "\n");
    console.log(`[Server] Sent ${lessons.length} lessons to a client`);
  } else {
    socket.write(JSON.stringify({ action: "error", message: `Unknown action: ${request.action}` } satisfies ServerResponse) + "\n");
  }
}

const server = net.createServer((socket) => {
  clients.push(socket);
  console.log(`Client connected. Total clients: ${clients.length}`);

  let buffer = "";

  socket.on("data", (data) => {
    buffer += data.toString();

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const message = buffer.substring(0, newlineIndex).trim();
      buffer = buffer.substring(newlineIndex + 1);

      if (message) {
        handleRequest(socket, message);
      }
    }
  });

  socket.on("end", () => {
    const index = clients.indexOf(socket);
    if (index > -1) {
      clients.splice(index, 1);
    }
    console.log(`Client disconnected. Total clients: ${clients.length}`);
  });

  socket.on("error", (err) => {
    console.error("Socket error:", err.message);
    const index = clients.indexOf(socket);
    if (index > -1) {
      clients.splice(index, 1);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Lesson Server listening on port ${PORT}`);
  console.log(`Storing lessons in: ${LESSONS_FILE}`);
  console.log("Ready for clients...\n");
});