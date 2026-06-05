const readline = require("readline");
const fs = require("fs");
const filePath = "lessons.ndjson";

const pack = (lessonObject) => ({
  i: lessonObject.id,
  t: lessonObject.title,
  d: lessonObject.desc,
});
const unpack = (lessonObject) => ({
  id: lessonObject.i,
  title: lessonObject.t,
  desc: lessonObject.d,
});

const COL_ID = 12;
const COL_TITLE = 50;
const COL_DESC = 256;


// Nag declare buffer for global use
const byteRead = (value, size) => {
  const buf = Buffer.alloc(size);
  buf.write(String(value), 'utf8');
  return buf.subarray(0, String(value).length).toString();
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function appendLesson(lesson) {
  fs.appendFileSync(
    filePath,
    JSON.stringify(pack(lesson)) + "\n", //convert lesson object para pack format and append to file.
    "utf8", // used utf8 kasi mostly english characters
  );
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



/// Dito refrator kopa ito
// add ako ng stream.pause at stream.resume para hindi na magbasa ng sobra sa page limit, 
// kasi dati nagbabasa ng buong file tapos lang pinapakita yung page limit, so mas efficient na ito kasi hindi na magbasa ng sobra sa page limit.

function showPage(mode = "view") {
  const skipPage = page * 10;
  let count = 0;
  let shown = 0;
  let hasNext = false;
  let stopped = false;

  const readcontentstream = fs.createReadStream(filePath, "utf8"); // Read file in chunk
  const getLiner = readline.createInterface({ input: readcontentstream }); // get per page from stream

  console.log(`\n--- Page ${page + 1} ---`);


  getLiner.on("line", (line) => {
    
    if (stopped || !line.trim()) return; 
    count++;

    if (count <= skipPage) return; 

    if (shown >= 10) {
      hasNext = true;
      stopped = true;
      getLiner.close();
      readcontentstream.destroy(); //destroy stream para hindi na magbasa ng sobra sa page limit
      return; //return para hindi na magprocess ng sobra sa page limit
    }

    shown++;
    const l = unpack(JSON.parse(line)); // convert line to lesson object para ma display sa console
    console.log(`${skipPage + shown}. [id:${l.id}] ${l.title} - ${l.desc}`);
  });

  getLiner.on("close", () => {
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
      const key = ans.toLowerCase();

      if (key === "N") {
        page++;
        showPage(mode);
      } else if (key === "P" && page > 0) {
        page--;
        showPage(mode);
      } else if (key === "E" && mode === "edit") {
        updateList();
      } else if (key === "C" && mode === "edit") {
        showmenu();
      } else if (key === "M") {
        showmenu();
      } else {
        console.log("Invalid Option");
        showmenu();
      }
    });
  });
}

// need to refractor para hindi na kailangan magbasa ng buong file para malaman yung id, instead read last line lang para malaman yung last id then add 1.
function getId() {
  if (!fs.existsSync(filePath)) return 1;
  const LessonContent = fs.readFileSync(filePath, "utf8");
  const lines = LessonContent.trim().split("\n").filter(Boolean);
  return lines.length + 1;
}

function createLesson() {
  rl.question("Do you want to create a new lesson? (Y/N): ", (answer) => {
    if (answer.toLowerCase() === "y") {
      rl.question("Lesson Title: ", (title) => {
        rl.question("Description: ", (desc) => {
          const id = getId();

          // // added fill to cleanup yung previous data sa buffer bago gumawa bago
          // bufId.fill(0);
          // bufTitle.fill(0);
          // bufDesc.fill(0);

          // //to input sa mismong buffer
          // bufId.write(id.toString());
          // bufTitle.write(title);
          // bufDesc.write(desc);

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
      const lesson = unpack(JSON.parse(lines[i]));
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
        const oldLesson = unpack(JSON.parse(lines[lessonIndex]));

        // bufId.fill(0);
        // bufTitle.fill(0);
        // bufDesc.fill(0);

        // bufId.write(oldLesson.id.toString());
        // bufTitle.write(newTitle || oldLesson.title);
        // bufDesc.write(newDesc || oldLesson.desc);

        const updatedLesson = {
          id: byteRead(oldLesson.id, COL_ID),
          title: byteRead(newTitle || oldLesson.title, COL_TITLE),
          desc: byteRead(newDesc || oldLesson.desc, COL_DESC),
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
