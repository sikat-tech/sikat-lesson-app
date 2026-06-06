const fs = require("fs");
const readline = require("readline");
const { stdin: input, stdout: output } = require("process");

let filePath = "dataset.ndjson";

const rl = readline.createInterface({ input, output });

const IdSize = 10;
const TitleSize = 50;
const DescSize = 100;

function insertBuffer(colValue, bufferSized) {
  const buffer = Buffer.alloc(bufferSized);
  const colValueStr = String(colValue);
  buffer.write(colValueStr, "utf-8");
  return buffer.subarray(0, colValueStr.length).toString();
}

function insertLesson(lesson) {
  fs.appendFile(filePath, JSON.stringify(lesson) + "\n", (err) => {
    if (err) {
      console.error("Error insertingLesson to file:", err);
    }
  });
}

function showMenu(answer) {
  console.log("Anong gagawin mo dito?");
  console.log("1. Create Lesson");
  console.log("2. View Lesson");
  console.log("3. Edit Lesson");
  console.log("4. Delete Lesson");
  console.log("5. Exit");
  rl.question("Choose an options: ", handleOptions);
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
    rl.close();
  }
}

function getId(newIds) {
  //papasok ako sa file
  //r nag iindicate para yung file is to read

  fs.open(filePath, "r", (err, fileCountChecker) => {
    if (err) {
      return newIds(1);
    }
    //now kukunin ko total bytes
    fs.fstat(fileCountChecker, (err, stats) => {
      if (err || stats.size === 0) {
        return newIds(1);
      }

      //kunin ko yung last 10 bytes ng file
      //yung stats.size ito yung ano buoang bytes ng entire file
      const chunkSize = Math.min(512, stats.size); // kunin ang mas maliit sa pagitan ng 512 at ng laki ng file
      const position = stats.size - chunkSize; // simula sa posisyon kung saan magsisimula ang pagbasa (sa huling bahagi ng file)
      const idbuf = Buffer.alloc(chunkSize); // buffer para sa pagbasa ng data


      //ang ginawa ko dito is neread ko ung last line lang 
      //kasi yung last line lang yung may pinaka latest id, so babasahin ko lang ung last line para makuha ko yung latest id

      fs.read(
        fileCountChecker,
        idbuf,
        0,
        chunkSize,
        position,
        (err, bytesRead) => {
          if (err) {
            console.error("Error reading file:", err);
            return newIds(1);
          }

          fs.close(fileCountChecker, (err) => {});// Isara ang file pagkatapos basahin

          const data = idbuf
            .toString()
            .trim()
            .split("\n")
            .filter((line) => line.trim() !== "");// Tanggalin yung mga empty lines

          // Kung walang laman ang data, ibig sabihin walang mga data sa file, kaya magsisimula tayo sa ID 1
          if (data.length === 0) {
            return newIds(1);
          }


          try {
            const lastLine = data[data.length - 1];// Kunin ang huling line ng data, kaya minus 1 dahil zero-based index
            const lastRecord = JSON.parse(lastLine);
            const lastId = parseInt(lastRecord.id, 10);
            return newIds(lastId + 1);
          } catch (err) {
            return newIds(1);
          }
        },
      );
    });
  });
}

function createLesson() {
  rl.question("Are you sure you want to create a lesson?(Y or N):  ", (ans) => {
    if (ans.toLowerCase() === "y") {
      rl.question("Enter lesson title: ", (title) => {
        rl.question("Enter lesson description: ", (description) => {
          getId((newIds) => {
            const lesson = {
              id: insertBuffer(newIds, IdSize),
              title: insertBuffer(title, TitleSize),
              description: insertBuffer(description, DescSize),
            };

            insertLesson(lesson);
            console.log("matagumpay ka idol");
            showMenu();
          });
        });
      });
    } else {
      console.log("Bakit mo naman kinacel?");
      showMenu();
    }
  });
}

function viewLesson() {}

function editLesson() {
  console.log("Editing lesson...");
}

function deleteLesson() {
  console.log("Deleting lesson...");
}

showMenu();
