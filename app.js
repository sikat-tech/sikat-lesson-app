const readline = require("readline");
const fs = require("fs");
const filePath = "lessons.ndjson";

const pack = (lessonObject) => ({
  id: lessonObject.id,
  t: lessonObject.title,
  d: lessonObject.desc,
});
const unpack = (lessonObject) => ({
  id: lessonObject.id,
  title: lessonObject.t,
  desc: lessonObject.d,
});

const allocCol = (size) => Buffer.alloc(size);

const bufId = allocCol(12);
const bufTitle = allocCol(50);
const bufDesc = allocCol(256);
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function appendLesson(lesson) {
  fs.appendFileSync(filePath, JSON.stringify(pack(lesson)) + "\n", "utf8");
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
  const skip = page * 10;
  let count = 0;
  let shown = 0;
  let hasNext = false;
  let stopped = false;

  const stream = fs.createReadStream(filePath, "utf8");
  const liner = readline.createInterface({ input: stream });

  console.log(`\n--- Page ${page + 1} ---`);

  liner.on("line", (line) => {
    if (stopped || !line.trim()) return;
    count++;

    if (count <= skip) return;

    if (shown >= 10) {
      hasNext = true;
      stopped = true;
      liner.close();
      stream.destroy();
      return;
    }

    shown++;
    const l = unpack(JSON.parse(line));
    console.log(`${skip + shown}. [id:${l.id}] ${l.title} - ${l.desc}`);
  });

  liner.on("close", () => {
    if (shown === 0) {
      console.log("No Lessons Available");
      return showmenu();
    }

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
  });
};

function getId(){
  if(!fs.existsSync(filePath)) return 1;
  const LessonContent = fs.readFileSync(filePath, "utf8");
  const lines = LessonContent.trim().split("\n");
  return lines.length + 1;
}

function createLesson() {
  rl.question("Do you want to create a new lesson? (Y/N): ", (answer) => {
    if (answer === "y") {
      rl.question("Lesson Title: ", (title) => {
        rl.question("Description: ", (desc) => {
          const id = getId();
          appendLesson({ id, title, desc });
          console.log(`\nLesson Created`);
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
  if (lesson.length === 0) {
    console.log("No lessons to edit.");
    return showmenu();
  }

  console.log("\nSelect lesson to edit:\n");

  lesson.forEach((l, i) => {
    console.log(`${i + 1}. ${l.title}`);
  });

  rl.question("\nEnter number: ", (num) => {
    const index = parseInt(num) - 1;

    if (index < 0 || index >= lesson.length) {
      console.log("Invalid selection");
      return showmenu();
    }

    rl.question("New Title: ", (newTitle) => {
      rl.question("New Description: ", (newDesc) => {
        lesson[index].title = newTitle;
        lesson[index].desc = newDesc;

        saveLesson();

        console.log("\nLesson Updated!");
        showmenu();
      });
    });
  });
}

showmenu();