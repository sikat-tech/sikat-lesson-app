const readline = require("readline");
const fs = require("fs");
const filePath = "lessons.ndjson";

const COL_ID = 12;
const COL_TITLE = 50;
const COL_DESC = 256;
const CHUNK_SIZE = 4096; // Read file in small 4KB increments

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let page = 0;
const itemsPerPage = 10;

// Clean/truncate string inputs safely using a buffer allocation strategy
function processString(value, maxSize) {
  const buf = Buffer.alloc(maxSize);
  buf.write(String(value), "utf8");
  return buf.toString("utf8").replace(/\0/g, "").trim();
}

function readLinesChunked(callback) {
  if (!fs.existsSync(filePath)) return;

  const fd = fs.openSync(filePath, "r");
  const buffer = Buffer.alloc(CHUNK_SIZE);
  let bytesRead = 0;
  let position = 0;
  let leftover = "";

  while ((bytesRead = fs.readSync(fd, buffer, 0, buffer.length, position)) > 0) {
    position += bytesRead;
    const content = leftover + buffer.toString("utf8", 0, bytesRead);
    const lines = content.split("\n");
    
    // The last element is either incomplete or empty (if chunk ends perfectly on \n)
    leftover = lines.pop(); 

    for (const line of lines) {
      const shouldStop = callback(line);
      if (shouldStop) {
        fs.closeSync(fd);
        return;
      }
    }
  }

  // Handle any final data if the file didn't end with a trailing newline
  if (leftover.trim()) {
    callback(leftover);
  }

  fs.closeSync(fd);
}

// Fetch only the records required for the current page
function getPageRecords(page, itemsPerPage) {
  const startIndex = page * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageItems = [];
  let currentIndex = 0;
  let hasNextPage = false;

  readLinesChunked((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;

    if (currentIndex >= startIndex && currentIndex < endIndex) {
      try {
        pageItems.push(JSON.parse(trimmed));
      } catch (e) { /* skip corrupt lines */ }
    } else if (currentIndex === endIndex) {
      hasNextPage = true;
      return true; // Stop execution immediately; we found what we needed
    }
    currentIndex++;
    return false;
  });

  return { pageItems, hasNextPage };
}

// Locate a single record by ID without loading any other row into memory
function findRecordById(id) {
  let foundRecord = null;

  readLinesChunked((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    try {
      const record = JSON.parse(trimmed);
      if (String(record.id) === String(id)) {
        foundRecord = record;
        return true; // Terminate early
      }
    } catch (e) {}
    return false;
  });

  return foundRecord;
}

// Modifies or drops rows by writing sequentially to a temp file in chunks
function processFileModification(id, modifierFn) {
  if (!fs.existsSync(filePath)) return false;
  
  const tempPath = filePath + ".tmp";
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

  let found = false;

  readLinesChunked((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;

    try {
      const record = JSON.parse(trimmed);
      if (String(record.id) === String(id)) {
        found = true;
        const modified = modifierFn(record); // returns null if item is deleted
        if (modified) {
          fs.appendFileSync(tempPath, JSON.stringify(modified) + "\n");
        }
      } else {
        fs.appendFileSync(tempPath, line + "\n");
      }
    } catch (e) {
      fs.appendFileSync(tempPath, line + "\n");
    }
    return false; // Must parse completely to finish copying remaining lines
  });

  if (found) {
    fs.renameSync(tempPath, filePath);
  } else if (fs.existsSync(tempPath)) {
    fs.unlinkSync(tempPath);
  }
  return found;
}

// Scans lines piece by piece to find the max ID fallback safely
function getLastRecordIdChunked() {
  let maxId = 0;
  readLinesChunked((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    try {
      const record = JSON.parse(trimmed);
      if (record.id) maxId = Math.max(maxId, Number(record.id));
    } catch (e) {}
    return false;
  });
  return maxId + 1;
}

// Generate the next auto-incrementing ID safely
function getNextId() {
  try {
    if (!fs.existsSync(filePath)) return 1;
    const stats = fs.statSync(filePath);
    if (stats.size === 0) return 1;

    // Fast tail optimization
    const fd = fs.openSync(filePath, "r");
    const tailSize = Math.min(4096, stats.size);
    const buffer = Buffer.alloc(tailSize);
    const readPos = Math.max(0, stats.size - tailSize);
    fs.readSync(fd, buffer, 0, tailSize, readPos);
    fs.closeSync(fd);

    const content = buffer.toString("utf8");
    const lines = content.split("\n").filter((l) => l.trim() !== "");
    if (lines.length === 0) return 1;

    const lastLine = lines[lines.length - 1];
    try {
      const lastRecord = JSON.parse(lastLine);
      return Number(lastRecord.id) + 1;
    } catch (err) {
      // Memory safe non-stream fallback
      return getLastRecordIdChunked();
    }
  } catch (err) {
    return 1;
  }
}

function showmenu() {
  console.log("\n--- Menu List ---");
  console.log("1. Create Lesson");
  console.log("2. View Lesson");
  console.log("3. Edit Lesson");
  console.log("4. Delete Lesson");
  console.log("5. Exit");

  rl.question("Choose an option: ", handleMenu);
}

function handleMenu(option) {
  if (option === "1") {
    createLesson();
  } else if (option === "2") {
    page = 0;
    showPage("view");
  } else if (option === "3") {
    page = 0;
    showPage("edit");
  } else if (option === "4") {
    deleteLesson();
  } else if (option === "5") {
    console.log("Goodbye!");
    rl.close();
  } else {
    console.log("Invalid Option");
    showmenu();
  }
}

function createLesson() {
  rl.question("Do you want to create a new lesson? (Y/N): ", (answer) => {
    if (answer.toLowerCase() === "y") {
      rl.question("Lesson Title: ", (title) => {
        rl.question("Description: ", (desc) => {
          const nextId = getNextId();

          const lessonObject = {
            id: processString(nextId, COL_ID),
            title: processString(title, COL_TITLE),
            desc: processString(desc, COL_DESC),
          };

          try {
            fs.appendFileSync(filePath, JSON.stringify(lessonObject) + "\n", { encoding: "utf8" });
            console.log(`\nLesson Created Successfully!`);
          } catch (err) {
            console.error("Failed to save lesson:", err.message);
          }

          showmenu();
        });
      });
    } else {
      console.log("Lesson Creation Cancelled.");
      showmenu();
    }
  });
}

function showPage(mode = "view") {
  const { pageItems, hasNextPage } = getPageRecords(page, itemsPerPage);

  if (pageItems.length === 0 && page > 0) {
    page--; 
    return showPage(mode);
  }

  if (pageItems.length === 0 && page === 0) {
    console.log("\nNo Lessons Available");
    return showmenu();
  }

  console.log(`\n--- Page ${page + 1} ---`);
  const startIndex = page * itemsPerPage;
  pageItems.forEach((lesson, index) => {
    const itemNumber = startIndex + index + 1;
    console.log(`${itemNumber}. [id:${lesson.id}] ${lesson.title} - ${lesson.desc}`);
  });

  const hasPrevPage = page > 0;
  const options = [];

  if (hasNextPage) options.push("N = Next");
  if (hasPrevPage) options.push("P = Prev");
  if (mode === "edit") options.push("E = Edit");
  if (mode === "edit") options.push("C = Close");
  options.push("M = Menu");

  rl.question(`\n[${options.join(" | ")}]: `, (answer) => {
    const key = answer.toLowerCase();

    if (key === "n" && hasNextPage) {
      page++;
      showPage(mode);
    } else if (key === "p" && hasPrevPage) {
      page--;
      showPage(mode);
    } else if (key === "e" && mode === "edit") {
      updateList();
    } else if (key === "c" && mode === "edit") {
      showmenu();
    } else if (key === "m") {
      showmenu();
    } else {
      console.log("Invalid Option");
      showPage(mode);
    }
  });
}

function updateList() {
  rl.question("Enter lesson ID to edit: ", (id) => {
    const oldLesson = findRecordById(id);

    if (!oldLesson) {
      console.log("Lesson not found.");
      return showmenu();
    }

    console.log(`\nCurrent: [${oldLesson.id}] ${oldLesson.title} - ${oldLesson.desc}`);

    rl.question("New Title : ", (newTitle) => {
      rl.question("New Description: ", (newDesc) => {
        processFileModification(id, () => {
          return {
            id: oldLesson.id,
            title: processString(newTitle || oldLesson.title, COL_TITLE),
            desc: processString(newDesc || oldLesson.desc, COL_DESC),
          };
        });

        console.log("Lesson Updated Successfully!");
        showmenu();
      });
    });
  });
}

function deleteLesson() {
  rl.question("Enter lesson ID to delete: ", (id) => {
    const lesson = findRecordById(id);

    if (!lesson) {
      console.log("Lesson not found.");
      return showmenu();
    }

    console.log(`\nDeleting: [${lesson.id}] ${lesson.title} - ${lesson.desc}`);

    rl.question("Are you sure? (Y/N): ", (confirm) => {
      if (confirm.toLowerCase() === "y") {
        // Returning null explicitly drops the record during parsing loops
        processFileModification(id, () => null);
        console.log("Lesson Deleted Successfully!");
      } else {
        console.log("Delete Cancelled");
      }
      showmenu();
    });
  });
}

showmenu();