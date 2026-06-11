import * as net from "net";
import * as fs from "fs";

const filePath = "lesson.ndjson";
const PORT = 8080;
const HOST = "127.0.0.1";

const COL_ID = 12;
const COL_TITLE = 50;
const COL_DESC = 223;
const LINE_RECORD_SIZE = 318;
const ITEMS_PER_PAGE = 10;

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

function formatToFixedRecord(lesson: LessonRecord): string {
  const recordLesson = {
    id: String(lesson.id).substring(0, COL_ID),
    title: String(lesson.title).substring(0, COL_TITLE),
    desc: String(lesson.desc).substring(0, COL_DESC),
  };

  let jsonStr = JSON.stringify(recordLesson);
  const paddingNeeded = LINE_RECORD_SIZE - jsonStr.length - 1;

  if (paddingNeeded > 0) {
    jsonStr += " ".repeat(paddingNeeded);
  }

  return jsonStr + "\n";
}

function getNextId(): number {
  if (!fs.existsSync(filePath)) {
    return 1;
  }
  const stats = fs.statSync(filePath);
  return Math.floor(stats.size / LINE_RECORD_SIZE) + 1;
}

function findLessonIndex(idStr: string) {
  if (!fs.existsSync(filePath)) return { found: false };

  const idNum = parseInt(idStr, 10);
  if (isNaN(idNum) || idNum < 1) return { found: false };

  const targetIndex = idNum - 1;
  const byteOffset = targetIndex * LINE_RECORD_SIZE;
  const stats = fs.statSync(filePath);

  if (byteOffset >= stats.size) {
    return { found: false };
  }

  const fd = fs.openSync(filePath, "r");
  try {
    const recordBuffer = Buffer.alloc(LINE_RECORD_SIZE);
    fs.readSync(fd, recordBuffer, 0, LINE_RECORD_SIZE, byteOffset);
    const lineStr = recordBuffer.toString("utf8").trim();
    
    if (!lineStr) return { found: false };

    const lesson = JSON.parse(lineStr) as LessonRecord;

    if (String(lesson.id) === String(idStr)) {
      return {
        found: true,
        byteOffset: byteOffset,
        lesson: lesson,
      };
    }
  } catch (err) {
    console.error("Error doing random-access read:", err);
  } finally {
    fs.closeSync(fd);
  }

  return { found: false };
}

// // Read all lessons from the file
// function getAllLessons(): LessonRecord[] {
//   // If the file does not exist yet, just return an empty list
//   if (!fs.existsSync(filePath)) {
//     return [];
//   }

//   // Will change this and apply yung previous code for reading the file and parsing it into objects.
//   const content: string = fs.readFileSync(filePath, "utf8");

//   return content
//     .split("\n")
//     .filter((line: string) => line.trim()) // remove empty/blank lines
//     .map((line: string): LessonRecord | null => {
//       // If the line is broken/invalid, skip it instead of crashing.
//       try {
//         return JSON.parse(line) as LessonRecord;
//       } catch {
//         console.log("Found a broken line in the file, skipping it...");
//         return null;
//       }
//     })
//     .filter((lesson) => lesson !== null); // remove nulls from broken lines
// }

// Receives Client Request
function handleClientData(msg: ClientMessage): ServerResponse {
  // Create lesson
  if (msg.type === "create_lesson") {
    // const lessons = getAllLessons();
    const nextId = getNextId();

    // skip deleted entries and convert existing IDs to numbers
    // const numericIds = lessons
    //   .map((lesson) => Number(lesson.id)) // convert id to a number
    //   .filter((id) => !isNaN(id)); // keep only valid numbers

    // If wala pa lessons, start at 1.
    // const nextId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;

    // Build new lesson object
    const newLesson: LessonRecord = {
      id: nextId.toString(),
      title: msg.title || "", // use title from client, or blank if no input
      desc: msg.description || "", // use description from client, or blank if no input
    };

    const formattedRecord = formatToFixedRecord(newLesson);

    // append lesson new line at the bottom of the file
    fs.appendFileSync(filePath, formattedRecord);

    // confirm to client
    return {
      ok: true,
      status: "success",
      message: "Lesson created successfully",
    };
  }

  // Client Request to View lesson
  if (msg.type === "view_lessons") {
    if (!fs.existsSync(filePath)) {
      return { ok: true, lessons: [], hasNextPage: false };
    }

    const targetPage = msg.page || 0;
    const stats = fs.statSync(filePath);
    const totalRecordsInFile = Math.floor(stats.size / LINE_RECORD_SIZE);

    // Track state variables
    const lessons: LessonRecord[] = [];
    let activeRecordsSkipped = 0;
    const targetSkipCount = targetPage * ITEMS_PER_PAGE;
    
    let currentRecordIndex = 0;
    const fd = fs.openSync(filePath, "r");
    const recordBuffer = Buffer.alloc(LINE_RECORD_SIZE);

    try {
      // Scan through the file until collect 10 active
      while (currentRecordIndex < totalRecordsInFile && lessons.length < ITEMS_PER_PAGE) {
        const byteOffset = currentRecordIndex * LINE_RECORD_SIZE;
        fs.readSync(fd, recordBuffer, 0, LINE_RECORD_SIZE, byteOffset);
        
        const lineStr = recordBuffer.toString("utf8").trim();
        currentRecordIndex++; // Advance tracking pointer to next record position

        // Guard: Skip empty string rows or deleted tombstones
        if (!lineStr || lineStr.includes('"id":"DELETED"')) {
          continue; 
        }

        try {
          const parsed = JSON.parse(lineStr) as LessonRecord;
          
          // If we haven't reached the requested page index offset yet, count past valid items
          if (activeRecordsSkipped < targetSkipCount) {
            activeRecordsSkipped++;
          } else {
            // We are on the target page view! Add record to response array
            lessons.push(parsed);
          }
        } catch {
          // Skip broken line formats safely
        }
      }

      // determine if a next page exists
      let hasNextPage = false;
      while (currentRecordIndex < totalRecordsInFile) {
        const byteOffset = currentRecordIndex * LINE_RECORD_SIZE;
        fs.readSync(fd, recordBuffer, 0, LINE_RECORD_SIZE, byteOffset);
        const lineStr = recordBuffer.toString("utf8").trim();
        
        if (lineStr && !lineStr.includes('"id":"DELETED"')) {
          hasNextPage = true;
          break; // Stop peeking immediately once we confirm another valid item exists
        }
        currentRecordIndex++;
      }

      return { ok: true, lessons, hasNextPage };

    } catch (err) {
      console.error("Error during high-performance view scanning:", err);
      return { ok: false, message: "Internal server error reading lessons from storage." };
    } finally {
      fs.closeSync(fd); // Always close file description handles cleanly
    }
  }

  // Client to UPDATE a lesson
  if (msg.type === "update_lesson") {
    if (!fs.existsSync(filePath)) {
      return { ok: false, message: "No data file exists." };
    }
    
    // const content: string = fs.readFileSync(filePath, "utf8");
    // const lines: string[] = content.split("\n");

    const result = findLessonIndex(msg.id || "");

    if (!result.found || result.lesson?.id === "DELETED") {
      return { ok: false, message: "Lesson ID not found or has been deleted." };
    }

    const currentLesson = result.lesson!;
    const updatedLesson: LessonRecord = {
      id: currentLesson.id,
      title: msg.title !== undefined ? msg.title : currentLesson.title,
      desc: msg.description !== undefined ? msg.description : currentLesson.desc,
    };

    const updatedLine = formatToFixedRecord(updatedLesson);
    const fd = fs.openSync(filePath, "r+");
    const writeBuffer = Buffer.from(updatedLine, "utf8");

    fs.writeSync(fd, writeBuffer, 0, LINE_RECORD_SIZE, result.byteOffset);
    fs.closeSync(fd);

    return { ok: true, message: `Lesson ${msg.id} updated successfully.` };

    // use this flag to know if we found and updated the lesson
    // let found = false;

    // for (let i = 0; i < lines.length; i++) {
    //   const currentLine = lines[i];

    //   // Skip blank lines
    //   if (!currentLine || !currentLine.trim()) continue;

    //   try {
    //     // check ID
    //     const parsed = JSON.parse(currentLine) as LessonRecord;

    //     // Check if line match ID from client request and Skip if been deleted.
    //     const isMatch =
    //       parsed &&
    //       parsed.id !== "DELETED" &&
    //       String(parsed.id) === String(msg.id);

    //     if (isMatch) {
    //       // Lesson details update from client. If details are blank, keep old value.
    //       lines[i] = JSON.stringify({
    //         id: parsed.id, // always keep the original ID
    //         title: msg.title !== undefined ? msg.title : parsed.title,
    //         desc: msg.description !== undefined ? msg.description : parsed.desc,
    //       });

    //       found = true;
    //       break;
    //     }
    //   } catch {
    //     console.log("Found a broken line, skipping it...");
    //   }
    // }

    // If found and changed the lesson, write all lines back to the file. Will change this and apply previous code where specific index/size lang kinukuwa.
    // if (found) {
    //   fs.writeFileSync(filePath, lines.join("\n"));
    //   return { ok: true, message: `Lesson ${msg.id} updated successfully.` };
    // }

    // If never found
    // return { ok: false, message: "Lesson ID not found or has been deleted." };
  }

  // Client wants to DELETE a lesson
  if (msg.type === "delete_lesson") {
    if (!fs.existsSync(filePath)) {
      return { ok: false, message: "No data file exists." };
    }

    const result = findLessonIndex(msg.id || "");

    if (!result.found || result.lesson?.id === "DELETED") {
      return { ok: false, message: "Lesson ID not found or already deleted." };
    }

    // const currentLesson = result.lesson!;
    // const updatedLesson: LessonRecord = {
    //   id: currentLesson.id,
    //   title: msg.title !== undefined ? msg.title : currentLesson.title,
    //   desc: msg.description !== undefined ? msg.description : currentLesson.desc,
    // };

    // const updatedLine = formatToFixedRecord(updatedLesson);
    // const fd = fs.openSync(filePath, "r+");
    // const writeBuffer = Buffer.from(updatedLine, "utf8");

    const deletedObject: LessonRecord = { id: "DELETED", title: "", desc: "" };
    const deletedLine = formatToFixedRecord(deletedObject);

    const fd = fs.openSync(filePath, "r+");
    const writeBuffer = Buffer.from(deletedLine, "utf8");

    fs.writeSync(fd, writeBuffer, 0, LINE_RECORD_SIZE, result.byteOffset);
    fs.closeSync(fd);

    return { ok: true, message: `Lesson ${msg.id} marked as DELETED.` };

    // const content: string = fs.readFileSync(filePath, "utf8");
    // const lines: string[] = content.split("\n");
    // let found = false;

    // for (let i = 0; i < lines.length; i++) {
    //   const currentLine = lines[i];

    //   if (!currentLine || !currentLine.trim()) continue;

    //   try {
    //     const parsed = JSON.parse(currentLine) as LessonRecord;

    //     // If match yung ID na client wants to delete
    //     if (parsed && String(parsed.id) === String(msg.id)) {
    //       // replace it with a "DELETED" marker.
    //       lines[i] = JSON.stringify({ id: "DELETED", title: "", desc: "" });

    //       found = true;
    //       break;
    //     }
    //   } catch {
    //     console.log("Found a broken line in the file, skipping it...");
    //   }
    // }

    // if (found) {
    //   fs.writeFileSync(filePath, lines.join("\n"));
    //   return { ok: true, message: `Lesson ${msg.id} marked as DELETED.` };
    // }

    // return { ok: false, message: "Lesson ID not found or already deleted." };
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

// server checker
server.listen(PORT, HOST, () => {
  console.log(`Server is running! Listening on port ${PORT} at ${HOST}`);
});
