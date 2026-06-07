const readline = require("readline");
const fs = require("fs");
const filePath = "lessons.ndjson";

const COL_ID = 12;
const COL_TITLE = 50;
const COL_DESC = 256;

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
  fs.appendFileSync(
    filePath,
    JSON.stringify(lesson) + "\n", //convert lesson object to JSON and append to file.
    "utf8", // used utf8 kasi mostly english characters
  );
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
      .trim()
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

function showPage(mode = "view") {
  // ===== SETUP =====
  const itemsPerPage = 10;
  const linesToSkip = page * itemsPerPage; // How many lines to skip

  try {
    if (!fs.existsSync(filePath)) {
      console.log("No Lessons Available");
      return showmenu();
    }

    // ===== FIND WHERE PAGE DATA STARTS & ENDS =====
    const fd = fs.openSync(filePath, "r");
    let currentByte = 0; //store byte for pagestartbyte and pageendbyte
    let currentLineNumber = 0; //used for reference to get the line
    let pageStartByte = -1; //start to 1 kasi wala naman byte na = 1
    let pageEndByte = -1; //start to 1 kasi wala naman byte na = 1

    // Scan file in 50-byte chunks, looking for newlines
    while (true) {
      const chunk = Buffer.alloc(50);
      const bytesRead = fs.readSync(fd, chunk, 0, 50, currentByte);
      if (bytesRead === 0) break; // Reached end of file

      // Check each byte for newline character
      for (let i = 0; i < bytesRead; i++) {
        if (chunk[i] === 10) {
          // 10 is newline character in ASCII
          currentLineNumber++;

          // check what line is being counted
          if (currentLineNumber === linesToSkip && pageStartByte === -1) {
            pageStartByte = currentByte + i + 1;
          }

          // check if the end line is reached
          if (currentLineNumber === linesToSkip + itemsPerPage) {
            pageEndByte = currentByte + i;
            break;
          }
        }
      }

      currentByte += bytesRead;
    }

    // ===== HANDLE EDGE CASES =====
    // if (linesToSkip === 0) pageStartByte = 0; // First page starts at beginning

    // if (pageEndByte === -1) {
    //   // Last page - read until end of file
    //   const stats = fs.statSync(filePath);
    //   pageEndByte = stats.size;
    // }

    // if (pageStartByte === -1 || pageStartByte >= pageEndByte) {
    //   console.log("No Lessons Available");
    //   fs.closeSync(fd);
    //   return showmenu();
    // }

    // ===== READ ONLY THE PAGE DATA =====
    const pageSize = pageEndByte - pageStartByte;
    const pageBuffer = Buffer.alloc(pageSize);
    fs.readSync(fd, pageBuffer, 0, pageSize, pageStartByte);
    fs.closeSync(fd);

    // ===== DISPLAY PAGE =====
    const pageContent = pageBuffer.toString("utf8");
    const lessons = pageContent
      .trim()
      .split("\n")
      .filter((line) => line.trim());

    console.log(`\n--- Page ${page + 1} ---`);
    lessons.forEach((line, index) => {
      const lesson = JSON.parse(line);
      const itemNumber = linesToSkip + index + 1;
      console.log(
        `${itemNumber}. [id:${lesson.id}] ${lesson.title} - ${lesson.desc}`,
      );
    });

    // ===== SHOW OPTIONS & HANDLE INPUT =====
    const hasNextPage = currentLineNumber >= linesToSkip + itemsPerPage;
    const options = [];

    if (hasNextPage) options.push("N = Next");
    if (page > 0) options.push("P = Prev");
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
    console.error("Error displaying page:", error);
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

function updateList() {
  rl.question("Enter lesson ID to edit: ", (id) => {
    if (!fs.existsSync(filePath)) {
      console.log("No Lessons Available");
      return showmenu();
    }

    const readFileContent = fs.readFileSync(filePath, "utf8");
    const lines = readFileContent.trim().split("\n");
    let found = false;
    let lessonIndex = -1;

    // for each loop displaying lesson
    for (let i = 0; i < lines.length; i++) {
      const lesson = JSON.parse(lines[i]);
      if (String(lesson.id) === String(parseInt(id))) {
        found = true;
        lessonIndex = i;
        console.log(
          `\nCurrent: [${lesson.id}] ${lesson.title} - ${lesson.desc}`,
        );
        break;
      }
    }

    if (!found) {
      console.log("Lesson not found.");
      return showmenu();
    }

    // Ask for new title and description
    rl.question("New Title : ", (newTitle) => {
      rl.question("New Description: ", (newDesc) => {
        const oldLesson = JSON.parse(lines[lessonIndex]);

        const updatedLesson = {
          id: byteRead(oldLesson.id, COL_ID),
          title: byteRead(newTitle || oldLesson.title, COL_TITLE),
          desc: byteRead(newDesc || oldLesson.desc, COL_DESC),
        };

        lines[lessonIndex] = JSON.stringify(updatedLesson);
        fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
        console.log("Lesson Updated");
        showmenu();
      });
    });
  });
}

function deleteLesson() {
  // check if file exists, if not return to menu
  if (!fs.existsSync(filePath)) {
    console.log("No Lessons Available");
    return showmenu();
  }

  // ask for lesson id to delete
  rl.question("Enter lesson ID to delete: ", (id) => {
    const readFileContent = fs.readFileSync(filePath, "utf8");
    const lines = readFileContent.trim().split("\n");
    let found = false;
    let lessonIndex = -1;

    // Find the lesson with matching ID
    for (let i = 0; i < lines.length; i++) {
      const lesson = JSON.parse(lines[i]);
      if (String(lesson.id) === String(parseInt(id))) {
        found = true;
        lessonIndex = i;
        console.log(
          `\nDeleting: [${lesson.id}] ${lesson.title} - ${lesson.desc}`,
        );
        break;
      }
    }

    if (!found) {
      console.log("Lesson not found.");
      return showmenu();
    }

    // Ask for confirmation before deleting
    rl.question("Are you sure? (Y/N): ", (confirm) => {
      if (confirm.toLowerCase() === "y") {
        // Remove the lesson from the array
        lines.splice(lessonIndex, 1);
        // Write the updated lines back to file
        fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
        console.log("Lesson Deleted");
      } else {
        console.log("Delete Cancelled");
      }
      showmenu();
    });
  });
}

showmenu();
