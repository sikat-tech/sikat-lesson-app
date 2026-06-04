const readline = require("readline");
const fs = require("fs");
const filePath = "lessons.json";

const pack = (lessonObject) => ({
  t: lessonObject.title,
  d: lessonObject.desc,
});
const unpack = (lessonObject) => ({
  title: lessonObject.t,
  desc: lessonObject.d,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// function loadLessons() {
//   if (!fs.existsSync(filePath)) return [];

//   const lessons = [];
//   const stream = fs.createReadStream(filePath, "utf8");
//   const liner = readline.createInterface({ input: stream });

//   liner.on("line", (line) => {
//     if (line.trim()) lessons.push(unpack(JSON.parse(line)));
//   });
  const data = fs.readFileSync(filePath, "utf8").trim();
  if (!data) return [];

  return JSON.parse(data).map(unpack);
}
//   return lessons;
// }

<<<<<<< Updated upstream
// function saveLessons(lessons) {
//   const lines =
//     lessons
//       .map((lessonObject) => JSON.stringify(pack(lessonObject)))
//       .join("\n") + "\n";
//   fs.writeFileSync(filePath, lines, "utf8");
// }


///refractor 
function appendLesson(lesson) {
  const lessons = loadLessons();
  lessons.push(lesson);
  saveLessons(lessons);
}

function showmenu() {
  console.log("\n--- Menu List ---");
  console.log("1. Create Lesson");
  console.log("2. View Lesson");
  console.log("3. Edit Lesson");
  console.log("4. Exit");

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
    console.log("Goodbye!");
    rl.close();
  } else {
    console.log("Invalid Option");
    showmenu();
  }
}

let page = 0;

function showPage() {
  const lessons = loadLessons();
  const skip = page * 10;
  const pageItems = lessons.slice(skip, skip + 10);
  const hasNext = lessons.length > skip + 10;

  console.log(`\n--- Page ${page + 1} ---`);

  if (pageItems.length === 0) {
    console.log("No Lessons Available");
    return showmenu();
  }

  pageItems.forEach((l, i) => {
    console.log(`${skip + i + 1}. ${l.title} - ${l.desc}`);
  });

    // Pagination Options
  const opts = [];
  if (hasNext) opts.push("N = Next");
  if (page > 0) opts.push("P = Prev");
  opts.push("M = Menu");

  rl.question(`\n[${opts.join(" | ")}]: `, (ans) => {
    const key = ans.toUpperCase();
    if (key === "N" && hasNext) {
      page++;
      showPage();
    } else if (key === "P" && page > 0) {
      page--;
      showPage();
    } else showmenu();
  });
};

function createLesson() {
  rl.question("Do you want to create a new lesson? (Y/N): ", (answer) => {
    if (answer === "y") {
      rl.question("Lesson Title: ", (title) => {
        rl.question("Description: ", (desc) => {
          appendLesson({ title, desc });
          console.log("\nLesson Created!");
          showmenu();
        });
      });
    } else {
      console.log("Lesson Creation Cancelled.");
      showmenu();
    }
  });
};

function viewLesson() {
  if (!fs.existsSync(filePath)) {
    console.log("No Lessons Available");
    return showmenu();
  }

  showPage();
}

function editLesson() {
  if (!fs.existsSync(filePath)) {
    console.log("No Lessons Available");
    return showmenu();
  }

  showPage();
}

showmenu();
