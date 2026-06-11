import * as net from "net";
import * as fs from "fs";

const filePath = "lesson.ndjson";
const PORT = 8080;
const HOST = "127.0.0.1";

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

// Read all lessons from the file
function getAllLessons(): LessonRecord[] {
  // If the file does not exist yet, just return an empty list
  if (!fs.existsSync(filePath)) {
    return [];
  }

  // Will change this and apply yung previous code for reading the file and parsing it into objects.
  const content: string = fs.readFileSync(filePath, "utf8");

  return content
    .split("\n")
    .filter((line: string) => line.trim()) // remove empty/blank lines
    .map((line: string): LessonRecord | null => {
      // If the line is broken/invalid, skip it instead of crashing.
      try {
        return JSON.parse(line) as LessonRecord;
      } catch {
        console.log("Found a broken line in the file, skipping it...");
        return null;
      }
    })
    .filter((lesson) => lesson !== null); // remove nulls from broken lines
}

// Receives Client Request
function handleClientData(msg: ClientMessage): ServerResponse {
  // Create lesson
  if (msg.type === "create_lesson") {
    const lessons = getAllLessons();

    // skip deleted entries and convert existing IDs to numbers
    const numericIds = lessons
      .map((lesson) => Number(lesson.id)) // convert id to a number
      .filter((id) => !isNaN(id)); // keep only valid numbers

    // If wala pa lessons, start at 1.
    const nextId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;

    // Build new lesson object
    const newLesson: LessonRecord = {
      id: nextId.toString(),
      title: msg.title || "", // use title from client, or blank if no input
      desc: msg.description || "", // use description from client, or blank if no input
    };

    // append lesson new line at the bottom of the file
    fs.appendFileSync(filePath, JSON.stringify(newLesson) + "\n");

    // confirm to client
    return {
      ok: true,
      status: "success",
      message: "Lesson created successfully",
    };
  }

  // Client Request to View lesson
  if (msg.type === "view_lessons") {
    const lessons = getAllLessons();

    // Filter rows that were deleted
    const activeLessons = lessons.filter((lesson) => lesson.id !== "DELETED");

    // Send back to client list
    return { ok: true, lessons: activeLessons };
  }

  // Client to UPDATE a lesson
  if (msg.type === "update_lesson") {
    if (!fs.existsSync(filePath)) {
      return { ok: false, message: "No data file exists." };
    }

    const content: string = fs.readFileSync(filePath, "utf8");
    const lines: string[] = content.split("\n");

    // use this flag to know if we found and updated the lesson
    let found = false;

    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i];

      // Skip blank lines
      if (!currentLine || !currentLine.trim()) continue;

      try {
        // check ID
        const parsed = JSON.parse(currentLine) as LessonRecord;

        // Check if line match ID from client request and Skip if been deleted.
        const isMatch =
          parsed &&
          parsed.id !== "DELETED" &&
          String(parsed.id) === String(msg.id);

        if (isMatch) {
          // Lesson details update from client. If details are blank, keep old value.
          lines[i] = JSON.stringify({
            id: parsed.id, // always keep the original ID
            title: msg.title !== undefined ? msg.title : parsed.title,
            desc: msg.description !== undefined ? msg.description : parsed.desc,
          });

          found = true;
          break;
        }
      } catch {
        console.log("Found a broken line, skipping it...");
      }
    }

    // If found and changed the lesson, write all lines back to the file. Will change this and apply previous code where specific index/size lang kinukuwa.
    if (found) {
      fs.writeFileSync(filePath, lines.join("\n"));
      return { ok: true, message: `Lesson ${msg.id} updated successfully.` };
    }

    // If never found
    return { ok: false, message: "Lesson ID not found or has been deleted." };
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
