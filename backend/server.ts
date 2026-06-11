import * as net from "net";
import * as fs from "fs";

const filePath = "lesson.ndjson";
const PORT = 8080;
const HOST = "127.0.0.1";

const COL_ID = 12;
const COL_TITLE = 30;
const COL_DESC = 223;
const LINE_RECORD = 318;

// lesson record required or what looks like.
interface LessonRecord {
  id: string;
  title: string;
  desc: string;
}

// message from the client
interface ClientMessage {
  type: "create_lesson" | "view_lessons" | "delete_lesson" | "update_lesson";
  title?: string;
  description?: string;
  id?: string;
}

// A reply BACK to the client
interface ServerResponse {
  ok: boolean;
  status?: "success" | "error";
  message?: string; // optional message to show the user
  lessons?: LessonRecord[]; // optional list of lessons for view
}

function processRecordBuffer(lesson: LessonRecord): Buffer {
  const trimmed = {
    id: String(lesson.id).substring(0, COL_ID),
    title: String(lesson.title).substring(0, COL_TITLE),
    desc: String(lesson.desc).substring(0, COL_DESC),
  };
  let jsonStr = JSON.stringify(trimmed);

  const paddingNeeded = LINE_RECORD - jsonStr.length - 1;
  if (paddingNeeded > 0) {
    jsonStr += " ".repeat(paddingNeeded);
  }

  return Buffer.from(jsonStr + "\n");
}
//read exact one record at a time using offset and size

function readRecordAt(fd: number, offset: number): LessonRecord | null {
  const buffer = Buffer.alloc(LINE_RECORD);

  fs.readSync(fd, buffer, 0, LINE_RECORD, offset);

  try {
    return JSON.parse(buffer.toString("utf8")) as LessonRecord;
  } catch {
    return null;
  }
}

//dito na ooverwrite yung record at specific index/size sa file
function writeRecordAt(fd: number, offset: number, lesson: LessonRecord): void {
  const buffer = processRecordBuffer(lesson);
  fs.writeSync(fd, buffer, 0, LINE_RECORD, offset);
}

//ito yung function na kukwenta ng byte offset sa file base sa lesson ID. Since fixed size yung record, madali lang magcompute ng offset gamit yung formula na (id - 1) * LINE_RECORD.
function byteOffset(id: number): number {
  return (id - 1) * LINE_RECORD;
}

function getNextId(): number {
  if (!fs.existsSync(filePath)) return 1;

  const size = fs.statSync(filePath).size;

  // no file reading, just metadata.
  // Dividing by LINE_RECORD tells us exactly how many slots exist.
  return Math.floor(size / LINE_RECORD) + 1;
}

// Receives Client Request
function handleClientData(msg: ClientMessage): ServerResponse {
  // Create lesson
  if (msg.type === "create_lesson") {
    const newLesson: LessonRecord = {
      id: String(getNextId()),
      title: msg.title || "",
      desc: msg.description || "",
    };

    const buffer = processRecordBuffer(newLesson);

    fs.appendFileSync(filePath, buffer);

    return {
      ok: true,
      status: "success",
      message: `Lesson created successfully with ID ${newLesson.id}.`,
    };
  }

  // Client Request to View lesson
  if (msg.type === "view_lessons") {
   
  }

  // Client to UPDATE a lesson
  if (msg.type === "update_lesson") {
    const id = Number(msg.id);
    if (isNaN(id) || id < 1) {
      return { ok: false, message: "Invalid lesson ID." };
    }

    if (!fs.existsSync(filePath)) {
      return { ok: false, message: "No data file exists." };
    }

    const offset = byteOffset(id);
    const size = fs.statSync(filePath).size;

    if (offset >= size) {
      //check yung offset is within the file size
      return { ok: false, message: `Lesson with ID ${id} not found.` };
    }

    const fd = fs.openSync(filePath, "r+");

    const existingLesson = readRecordAt(fd, offset);

    if (!existingLesson || existingLesson.id === "DELETED") {
      fs.closeSync(fd);
      return { ok: false, message: `Lesson with ID ${id} not found.` };
    }

    writeRecordAt(fd, offset, {
      id: existingLesson.id,
      title: msg.title || existingLesson.title,
      desc: msg.description || existingLesson.desc,
    });


    fs.closeSync(fd);
    return { ok: true, message: `Lesson with ID ${id} updated successfully.` };
  }

  // Client wants to DELETE a lesson
  if (msg.type === "delete_lesson") {
    if (!fs.existsSync(filePath)) {
      return { ok: false, message: "No data file exists." };
    }

    const content: string = fs.readFileSync(filePath, "utf8");
    const lines: string[] = content.split("\n");
    let found = false;

    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i];

      if (!currentLine || !currentLine.trim()) continue;

      try {
        const parsed = JSON.parse(currentLine) as LessonRecord;

        // If match yung ID na client wants to delete
        if (parsed && String(parsed.id) === String(msg.id)) {
          // replace it with a "DELETED" marker.
          lines[i] = JSON.stringify({ id: "DELETED", title: "", desc: "" });

          found = true;
          break;
        }
      } catch {
        console.log("Found a broken line in the file, skipping it...");
      }
    }

    if (found) {
      fs.writeFileSync(filePath, lines.join("\n"));
      return { ok: true, message: `Lesson ${msg.id} marked as DELETED.` };
    }

    return { ok: false, message: "Lesson ID not found or already deleted." };
  }

  return { ok: false, status: "error", message: "Invalid request type" };
}

let clientCounter = 0;
// Server setup
// createServer that listens for incoming connections.
const server: net.Server = net.createServer((socket: net.Socket) => {
  console.log("A client has connected!");
  clientCounter++;
  console.log(`Total connected clients: ${clientCounter}`);
  // runs ever time client sends data through the socket
  socket.on("data", (data: Buffer) => {
    try {
      console.log(`Message received from client: ${data.toString()}`);

      // parse from JSON to regular JavaScript object
      const msg = JSON.parse(data.toString()) as ClientMessage;

      // Pass and get back a response
      const response = handleClientData(msg);

      // Convert response then send to client
      socket.write(JSON.stringify(response));
    } catch (err) {
      const errorResponse: ServerResponse = {
        ok: false,
        message: "Invalid data formatting.",
      };
      socket.write(JSON.stringify(errorResponse));
    }
  });

  // runs when the client disconnects
  socket.on("end", () => {
    console.log("Client disconnected.");
  });
});

// Tell server to start listening on chosen port and host
server.listen(PORT, HOST, () => {
  console.log(`Server is running! Listening on port ${PORT} at ${HOST}`);
});
