const fs = require("fs");
const readline = require("readline");
const { stdin: input, stdout: output } = require("process");

let filePath = "dataset.ndjson";

const rl = readline.createInterface({ input, output });

const IdSize = 10;
const TitleSize = 50;
const DescSize = 100;
const NdJsonSize = 37; // depends ito sa laki ng id, title, at description, dahil ito yung total bytes na kailangan para sa isang record sa file
const totalFile = IdSize + TitleSize + DescSize + NdJsonSize; // total bytes na kailangan para sa isang record sa file

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

          fs.close(fileCountChecker, (err) => {}); // Isara ang file pagkatapos basahin

          console.log("Bytes read from file:", idbuf); // I-print ang bilang ng bytes na nabasa

          const data = idbuf
            .toString()
            .trim()
            .split("\n")
            .filter((line) => line.trim() !== ""); // Tanggalin yung mga empty lines

          // Kung walang laman ang data, ibig sabihin walang mga data sa file, kaya magsisimula tayo sa ID 1
          if (data.length === 0) {
            return newIds(1);
          }

          try {
            const lastLine = data[data.length - 1]; // Kunin ang huling line ng data, kaya minus 1 dahil zero-based index
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

// nag create ako ng function dito na mag handle ng display 
function loadAndPaginate(page, displayedLessons) {
  //notee ko
  // kung iniisip na maiidisplay kasama null bytes hindi kasi nag trim na tayo sa storing palang

  const pageSize = 10;
  const skipPage = (page - 1) * pageSize;
  const viewPosition = skipPage * totalFile;
  const chunksRecord = pageSize * totalFile * 2; 


  fs.open(filePath, "r", (err, fileCountChecker) => {
    if (err) {
      return fileCountChecker([]);
    }

  

    fs.fstat(fileCountChecker, (err, stats) => {
      if (err || stats.size === 0) {
        return fileCountChecker([]);
      }

      const fileBuffer = Buffer.alloc(chunksRecord); // kaya nag allocate sa looob ng fstats para di masayang yung bytes na i-nallocate kasi dito sa loob na vavalidate pa damn

      fs.read(
        fileCountChecker,
        fileBuffer,
        0, //position sa buffer kung saan magsisimula ang pagsulat ng data
        chunksRecord,
        viewPosition,//position sa file kung saan magsisimula ang pagbasa
        (err, bytesRead) => {
          if (err) {
            console.error("Error reading file:", err);
            return fileCountChecker([]);
          }

          fs.close(fileCountChecker, (err) => {});

          console.log("Bytes read from file:", bytesRead); // I-print ang bilang ng bytes na nabasa

          const data = fileBuffer
            .toString()
            .trim()
            .split("\n")
            .filter((line) => line.trim() !== ""); // Tanggalin yung mga empty lines'

          const recordSeenCount = 0;
          const recordList = [];

          for (let line of data) {
            if (recordSeenCount >= pageSize && recordList.length < pageSize) {
              try {
                const record = JSON.parse(line);
                recordList.push(record);
              } catch (err) {
                console.error("Error parsing JSON:", err);
              }
            }
            recordSeenCount++;
          }

          console.log("Record list:", recordList.length); // I-print ang listahan ng mga record na nakuh
          displayedLessons(recordList);
        },
      );
    });
  });
}
function viewLesson(page) {

  
}

function editLesson() {
  console.log("Editing lesson...");
}

function deleteLesson() {
  console.log("Deleting lesson...");
}

showMenu();
