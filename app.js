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
    editLesson() ;
  } else if (option === "4") {
    console.log("Goodbye!");
    rl.close();
  } else {
    console.log("Invalid Option");
    showmenu();
  }
}

let page = 0;

function showPage(mode = "view") {
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
    if (mode === "edit") opts.push("E = Edit");
    if (mode === "edit") opts.push("C = CloseList");
    opts.push("M = Menu");

    rl.question(`\n[${opts.join(" | ")}]: `, (ans) => {
      const key = ans.toUpperCase();

      if (key.toUpperCase() === "N") {page++; showPage(mode);}
      else if (key.toUpperCase()  === "P" && page > 0) {page--; showPage(mode);}
      else if (key.toUpperCase() === "E" && mode === "edit") {updateList();}
      else if (key.toUpperCase() === "C" && mode === "edit") {showMenu();}
      else if (key.toUpperCase() === "M") {showmenu();}
      else {
        console.log("Invalid Option");
        showmenu();
      }

      // if (key === "N" && hasNext) {
      //   page++;
      //   showPage();
      // } else if (key === "P" && page > 0) {
      //   page--;
      //   showPage();
      // } else showmenu();
    });
  });
};

function getId(){
  if(!fs.existsSync(filePath)) return 1;
  const LessonContent = fs.readFileSync(filePath, "utf8");
  const lines = LessonContent.trim().split("\n").filter(Boolean);
  return lines.length + 1;
}

function createLesson() {
  rl.question("Do you want to create a new lesson? (Y/N): ", (answer) => {
    if (answer === "y") {
      rl.question("Lesson Title: ", (title) => {
        rl.question("Description: ", (desc) => {
        const id = getId();

          bufId.fill(0);
          bufTitle.fill(0);
          bufDesc.fill(0);

          bufId.write(id.toString());
          bufTitle.write(title);
          bufDesc.write(desc);


          const lessonObject = {
            id: bufId.subarray(0,String(id).length).toString(),
            title: bufTitle.subarray(0,title.length).toString(),
            desc: bufDesc.subarray(0,desc.length).toString()
          }

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
};

function viewLesson() {
  if (!fs.existsSync(filePath)) {
    console.log("No Lessons Available");
    return showmenu();
  }

  showPage("view");
}


function editLesson() 
{ 

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

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.trim().split("\n");
    let found = false;
    let lessonIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const lesson = unpack(JSON.parse(lines[i]));
      if (lesson.id === parseInt(id)) {
        found = true;
        lessonIndex = i;
        console.log(`\nCurrent: [${lesson.id}] ${lesson.title} - ${lesson.desc}`);
        break;
      }
    }

    if (!found) {
      console.log("Lesson not found.");
      return showmenu();
    }

    rl.question("New Title : ", (newTitle) => {
      rl.question("New Description: ", (newDesc) => {
        const oldLesson = unpack(JSON.parse(lines[lessonIndex]));
        const updatedLesson = {
          id: oldLesson.id,
          title: newTitle || oldLesson.title,
          desc: newDesc || oldLesson.desc,
        };

        lines[lessonIndex] = JSON.stringify(pack(updatedLesson));
        fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
        console.log("Lesson Updated");
        showmenu();
      });
    });
  });
}

showmenu();