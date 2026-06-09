const readline = require("readline");
const fs = require("fs");
const filePath = "lessons.ndjson";

const COL_ID = 12;
const COL_TITLE = 50;
const COL_DESC = 223;
const LINE_RECORD_SIZE = 318;
 
// Nag declare buffer for global use
const byteRead = (value, size) => {
  const buf = Buffer.alloc(size);
  buf.write(String(value), "utf8");
  return buf.subarray(0, String(value).length).toString();
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function appendLesson(lesson) {
  // 1. Create a clean, stripped object
  const cleanLesson = {
    id: String(lesson.id).substring(0, COL_ID),
    title: String(lesson.title).substring(0, COL_TITLE),
    desc: String(lesson.desc).substring(0, COL_DESC)
  };

  // 2. Stringify it without the newline ye
  let jsonStr = JSON.stringify(cleanLesson);

  // 3. Calculate how much padding is needed to force this line to exactly 318 bytes
  // We subtract 1 to leave room for the '\n' character at the very end
  const paddingNeeded = LINE_RECORD_SIZE - jsonStr.length - 1;

  if (paddingNeeded > 0) {
    jsonStr += " ".repeat(paddingNeeded);
  }

  // 4. Append the finalized 318-byte line
  fs.appendFileSync(filePath, jsonStr + "\n", "utf8");
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
    viewLesson();
  } else if (option === "3") {
    editLesson();
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

function getId() {
  try {
    if (!fs.existsSync(filePath)) {
      return 1;
    }

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content
      .split("\n")
      .filter((line) => line.trim());

    if (lines.length === 0) {
      return 1;
    }

    const lastLine = lines[lines.length - 1];
    const lastLesson = JSON.parse(lastLine);

    return Number(lastLesson.id) + 1;
  } catch (err) {
    console.error("Error reading file:", err);
    return 1;
  }
}

function createLesson() {
  rl.question("Do you want to create a new lesson? (Y/N): ", (answer) => {
    if (answer.toLowerCase() === "y") {
      rl.question("Lesson Title: ", (title) => {
        rl.question("Description: ", (desc) => {
          const id = getId();

          const lessonObject = {
            id: byteRead(id, COL_ID),
            title: byteRead(title, COL_TITLE),
            desc: byteRead(desc, COL_DESC),
          };

          appendLesson(lessonObject);
          console.log(`\nLesson Created`);
          showmenu();
        });
      });
    } else {
      console.log("Lesson Creation Cancelled.");
      showmenu();
    }
  });
}

let page = 0;
let currentSortMode = "id";

function showPage(mode = "view") {
  const itemsPerPage = 10;

  try {
    if (!fs.existsSync(filePath)) {
      console.log("No Lessons Available");
      return showmenu();
    }

    const stats = fs.statSync(filePath);
    const totalRecords = Math.floor(stats.size / LINE_RECORD_SIZE);

    if (totalRecords === 0) {
      console.log("No Lessons Available");
      return showmenu();
    }

    const fd = fs.openSync(filePath, "r");
    let allValidLessons = [];

    // Gather keys for index layout mapping
    for (let i = 0; i < totalRecords; i++) {
      const byteOffset = i * LINE_RECORD_SIZE;
      const recordBuffer = Buffer.alloc(LINE_RECORD_SIZE);
      fs.readSync(fd, recordBuffer, 0, LINE_RECORD_SIZE, byteOffset);

      const rawStr = recordBuffer.toString("utf8");
      const firstBrace = rawStr.indexOf("{");
      const lastBrace = rawStr.lastIndexOf("}");

      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {  //{fdft}
        const cleanJsonStr = rawStr.substring(firstBrace, lastBrace + 1);
        const lesson = JSON.parse(cleanJsonStr);

        if (lesson.id !== "DELETED") {
          allValidLessons.push({
            id: Number(lesson.id),
            title: lesson.title,
            desc: lesson.desc,
            offset: byteOffset
          });
        }
      }
    }
    fs.closeSync(fd);

    // Apply Sort conditional rules on our layout array before pagination slices it
    if (currentSortMode === "title") {
      allValidLessons.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      allValidLessons.sort((a, b) => a.id - b.id); // Sort by numerical ID
    }

    // Slice out our targeted pagination page array window
    const startIndex = page * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, allValidLessons.length);
    const pageLessons = allValidLessons.slice(startIndex, endIndex);

    if (pageLessons.length === 0 && page > 0) {
      page--;  
      return showPage(mode);
    }

    console.log(`\n--- Page ${page + 1} (Sorted by: ${currentSortMode.toUpperCase()}) ---`);
    pageLessons.forEach((lesson, index) => {
      const itemNumber = startIndex + index + 1;
      console.log(`${itemNumber}. id:${lesson.id} - ${lesson.title} - ${lesson.desc}`);
    });

    // Option controls
    const hasNextPage = endIndex < allValidLessons.length;
    const options = [];

    if (hasNextPage) options.push("N = Next");
    if (page > 0) options.push("P = Prev");
    options.push("S = Sort"); // Lets user switch sort modes on the fly
    if (mode === "edit") options.push("E = Edit");
    if (mode === "edit") options.push("C = Close");
    options.push("M = Menu");

    rl.question(`\n[${options.join(" | ")}]: `, (answer) => {
      const key = answer.toLowerCase();

      if (key === "n" && hasNextPage) {
        page++;
        showPage(mode);
      } else if (key === "p" && page > 0) {
        page--;
        showPage(mode);
      } else if (key === "s") {
        // Toggle sort type criteria and refresh page display
        currentSortMode = currentSortMode === "id" ? "title" : "id";
        showPage(mode);
      } else if (key === "e" && mode === "edit") {
        updateList();
      } else if (key === "c" && mode === "edit") {
        showmenu();
      } else if (key === "m") {
        showmenu();
      } else {
        console.log("Invalid Option");
        showmenu();
      }
    });
  } catch (error) {
    console.error("Error displaying sorted page view window:", error);
    showmenu();
  }
}

function viewLesson() {
  if (!fs.existsSync(filePath)) {
    console.log("No Lessons Available");
    return showmenu();
  }
  showPage("view");
}

function editLesson() {
  if (!fs.existsSync(filePath)) {
    console.log("No Lessons Available");
    return showmenu();
  }
  showPage("edit");
}

function findLessonIndex(id) {
  if (!fs.existsSync(filePath)) return { found: false };

  // Convert input to a clean integer
  const idNum = parseInt(id, 10);
  if (isNaN(idNum) || idNum < 1) return { found: false };

  const fd = fs.openSync(filePath, "r");
  const stats = fs.statSync(filePath);

  // Math-calculate exactly where this ID's block lives
  const targetIndex = idNum - 1; 
  const byteOffset = targetIndex * LINE_RECORD_SIZE; 

  if (byteOffset >= stats.size) {
    fs.closeSync(fd);
    return { found: false };
  }

  try {
    const recordBuffer = Buffer.alloc(LINE_RECORD_SIZE);
    fs.readSync(fd, recordBuffer, 0, LINE_RECORD_SIZE, byteOffset);

    const lineStr = recordBuffer.toString("utf8").trim();
    if (!lineStr) return { found: false };

    const lesson = JSON.parse(lineStr);

    // Verify it's actually the correct ID and not a tombstoned row
    if (String(lesson.id) === String(id)) {
      console.log(`Directly jumped to record at byte offset ${byteOffset}!`);
      return {
        found: true,
        index: targetIndex,
        byteOffset: byteOffset,
        recordSize: LINE_RECORD_SIZE,
        lesson
      };
    }
  } catch (err) {
    console.error("Error doing random-access read:", err);
  } finally {
    fs.closeSync(fd);
  }

  return { found: false };
}

function updateList() {
  rl.question("Enter lesson ID to edit: ", (id) => {
    const result = findLessonIndex(id);

    if (!result.found) {
      console.log("Lesson not found.");
      return showmenu();
    }

    console.log(`\nCurrent: [${result.lesson.id}] ${result.lesson.title} - ${result.lesson.desc}`);

    rl.question("New Title : ", (newTitle) => {
      rl.question("New Description: ", (newDesc) => {
        
        const updatedLesson = {
          id: result.lesson.id,
          title: (newTitle || result.lesson.title).substring(0, COL_TITLE),
          desc: (newDesc || result.lesson.desc).substring(0, COL_DESC),
        };

        let jsonStr = JSON.stringify(updatedLesson);
        const paddingNeeded = LINE_RECORD_SIZE - jsonStr.length - 1;

        if (paddingNeeded > 0) {
          jsonStr += " ".repeat(paddingNeeded);
        }
        
        const updatedLine = jsonStr + "\n";

        // Open file and write directly to the target block location
        const fd = fs.openSync(filePath, "r+");
        const writeBuffer = Buffer.from(updatedLine, "utf8");
        
        fs.writeSync(fd, writeBuffer, 0, LINE_RECORD_SIZE, result.byteOffset);
        fs.closeSync(fd);

        console.log("Lesson Updated!");
        showmenu();
      });
    });
  });
}

function deleteLesson() {
  if (!fs.existsSync(filePath)) {
    console.log("No Lessons Available");
    return showmenu();
  }

  rl.question("Enter lesson ID to delete: ", (id) => {
    const result = findLessonIndex(id);

    if (!result.found) {
      console.log("Data already deleted or not found.");
      return showmenu();
    }

    console.log(`\nDeleting: [${result.lesson.id}] ${result.lesson.title} - ${result.lesson.desc}`);

    rl.question("Are you sure? (Y/N): ", (confirm) => {
      if (confirm.toLowerCase() === "y") {
        
        // 1. Create a standardized "Deleted/Tombstone" row that matches exactly 318 bytes
        const deletedObject = { id: "DELETED", title: "", desc: "" };
        let jsonStr = JSON.stringify(deletedObject);
        const paddingNeeded = LINE_RECORD_SIZE - jsonStr.length - 1;
        
        if (paddingNeeded > 0) {
          jsonStr += " ".repeat(paddingNeeded);
        }
        const deletedLine = jsonStr + "\n";

        // 2. Overwrite ONLY that specific position in the file instantly
        const fd = fs.openSync(filePath, "r+");
        const writeBuffer = Buffer.from(deletedLine, "utf8");
        
        fs.writeSync(fd, writeBuffer, 0, LINE_RECORD_SIZE, result.byteOffset);
        fs.closeSync(fd);

        console.log("Lesson Deleted (Marked as inactive)");
      } else {
        console.log("Delete Cancelled");
      }
      showmenu();
    });
  });
}

showmenu();
