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
  sortBy?: "title"; // for sorting
  page?: number; // for pagination
}

// A reply BACK to the client
interface ServerResponse {
  ok: boolean;
  status?: "success" | "error";
  message?: string; // optional message to show the user
  lessons?: LessonRecord[]; // optional list of lessons for view
  hasNextPage?: boolean; // for pagination
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
    if (!fs.existsSync(filePath))
      return { ok: true, lessons: [], hasNextPage: false };

    const ITEMS_PER_PAGE = 10;
    const page = msg.page ?? 0; // default to page 0 if client did not send itåå
    const size = fs.statSync(filePath).size;
    // Number of records = file size divided by the fixed record size
    const totalRecords = Math.floor(size / LINE_RECORD);

    const fd = fs.openSync(filePath, "r");
    const lessons: LessonRecord[] = [];

    // const slotStart = page * ITEMS_PER_PAGE;
    // const slotEnd = Math.min(slotStart + ITEMS_PER_PAGE, totalRecords);

    // // If the requested page starts beyond the file, nothing to show
    // if (slotStart >= totalRecords) {
    //   return { ok: true, lessons: [], hasNextPage: false };
    // }

    let currentSlot = 0;
    let validLessons = 0;
    const targetSkipCount = page * ITEMS_PER_PAGE;

    // Find where the requested page should actually start
    while (currentSlot < totalRecords && validLessons < targetSkipCount) {
      const lesson = readRecordAt(fd, currentSlot * LINE_RECORD);

      console.log(lesson);
      if (lesson && lesson.id !== "DELETED") {
        validLessons++;
      }
      currentSlot++;
    }

    // Collect 10 valid lesson for each page
    while (currentSlot < totalRecords && lessons.length < ITEMS_PER_PAGE) {
      const lesson = readRecordAt(fd, currentSlot * LINE_RECORD);
      console.log(ITEMS_PER_PAGE);
      if (lesson && lesson.id !== "DELETED") {
        lessons.push(lesson);
      }
      currentSlot++;
    }

    // Next Page check valid lessons
    let hasNextPage = false;
    while (currentSlot < totalRecords) {
      const lesson = readRecordAt(fd, currentSlot * LINE_RECORD);
      console.log("Checking for next page, found lesson:", lesson);
      if (lesson && lesson.id !== "DELETED") {
        hasNextPage = true;
        break;
      }
      currentSlot++;
    }

    fs.closeSync(fd);

    return {
      ok: true,
      lessons,
      hasNextPage,
    };
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

    console.log("Existing lesson:", existingLesson);

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
    const id = Number(msg.id);
    if (isNaN(id) || id < 1) {
      return { ok: false, message: "Invalid lesson ID." };
    }

    if (!fs.existsSync(filePath)) {
      return { ok: false, message: "No data file exists." };
    }

    const offset = byteOffset(id);
    const size = fs.statSync(filePath).size;

    if (offset + LINE_RECORD > size) {
      return { ok: false, message: `Lesson ID ${id} not found.` };
    }

    const fd = fs.openSync(filePath, "r+");
    const existingLesson = readRecordAt(fd, offset);

    console.log("Existing lesson for deletion:", existingLesson);

    if (!existingLesson || existingLesson.id === "DELETED") {
      fs.closeSync(fd);
      return { ok: false, message: `Lesson with ID ${id} not found.` };
    }

    // Mark the record as deleted by writing a tombstone value
    writeRecordAt(fd, offset, {
      id: "DELETED",
      title: "",
      desc: "",
    });
    fs.closeSync(fd);
    return { ok: true, message: `Lesson with ID ${id} deleted successfully.` };
  }

  if (msg.type === "sort_by_title") {
    if (!fs.existsSync(filePath)) {
      return { ok: true, status: "success", lessons: [] };
    }
    //binabasa pa lahat ng records
    const lessons: LessonRecord[] = [];
    const size = fs.statSync(filePath).size;
    const fd = fs.openSync(filePath, "r");
    let offset = 0;
    
    const LIMIT = 10;

    // debugger counters
    let totalChunksRead = 0;
    let validRecordsCount = 0;
    let deletedRecordsCount = 0;

    while (offset < size && totalChunksRead < LIMIT) {
      const record = readRecordAt(fd, offset);
      totalChunksRead++;
      
      
      if (record && record.id !== "DELETED") {
        lessons.push(record);
        validRecordsCount++;
      }
      else{
      deletedRecordsCount++;
      }
      offset += LINE_RECORD;
    }

    fs.closeSync(fd);
    //debugger logs just to verify the reading process and counts
    console.log(`Total chunks read: ${totalChunksRead}`);
    console.log(`Valid records found: ${validRecordsCount}`);
    console.log(`Deleted records skipped: ${deletedRecordsCount}`);
    
    // sort the lessons by title if requested
    if (msg.sortBy === "title") {
      lessons.sort((a, b) => {
        // Normalize for case-insensitive sorting and trim whitespace padding
        const titleA = a.title.trim().toLowerCase();
        const titleB = b.title.trim().toLowerCase();
        
        if (titleA < titleB) return -1;
        if (titleA > titleB) return 1;
        return 0;
      });
    }

    return {
      ok: true,
      status: "success",
      lessons: lessons
    };
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
    clientCounter--;
    console.log(`Total connected clients: ${clientCounter}`);
  });
});

// Tell server to start listening on chosen port and host
server.listen(PORT, HOST, () => {
  console.log(`Server is running! Listening on port ${PORT} at ${HOST}`);
});
