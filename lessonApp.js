const fs = require("fs/promises");
const readline = require("readline");
const { stdin: input, stdout: output } = require("process");

let filePath = "dataset.ndjson";

let saveLesson = [];

const rl = readline.createInterface({ input, output });

function insertLesson(saveLesson) {
    fs.appendFile(filePath, JSON.stringify(saveLesson) + '\n');
}

function showMenu(answer) {
  console.log("Anong gagawin mo dito?");
  console.log("1. Create Lesson");
  console.log("2. View Lesson");
  console.log("3. Edit Lesson");
  console.log("4. Delete Lesson");
  console.log("5. Exit");

  rl.question("Choose an options:", handleOptions);
}

function handleOptions(answer) {
  if (answer === "1") {
    createLesson();
  } else if (answer === "2") {
    viewLesson();
  } else if (answer === "3") {
    editLesson();
  } else if (answer === "4") {
    deleteLesson();
  } else {
    console.log("Maliii puu");
    showMenu();
    console.log(saveLesson);
    rl.close();
  }
}

function createLesson() {
  rl.question("Are you sure you want to create a lesson?: (Y or N)", (ans) => {
    if (ans.toLowerCase() === "y") {
      rl.question("Enter lesson title: ", (title) => {
        rl.question("Enter lesson description: ", (description) => {
          saveLesson.push({
            title: title,
            description: description,
          });

          insertLesson(saveLesson);
        });
      });
    } else {
      console.log("Lesson creation cancelled.");
      showMenu();
    }
  });
}

function viewLesson() {
  console.log("Viewing lesson...");
}

function editLesson() {
  console.log("Editing lesson...");
}

function deleteLesson() {
  console.log("Deleting lesson...");
}

showMenu();
