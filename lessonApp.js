const fs = require("fs");
const readline = require("readline");
const { stdin: input, stdout: output } = require("process");

let filePath = "dataset.ndjson";

const rl = readline.createInterface({ input, output });

const IdSize = 5;
const TitleSize = 50;
const DescSize = 100;
const NdJsonSize = 41; // depends ito sa laki ng id, title, at description, dahil ito yung total bytes na kailangan para sa isang record sa file
const RecordSize = 193;

function insertBuffer(colValue, bufferSized) {
  const buffer = Buffer.alloc(bufferSized);
  const colValueStr = String(colValue);
  buffer.write(colValueStr, "utf-8");
  return buffer.toString("utf-8").replace(/\0/g, "").trim().padEnd(bufferSized); //
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
      const chunkSize = Math.min(RecordSize, stats.size); // kunin ang mas maliit sa pagitan ng 512 at ng laki ng file
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
              id: String(newIds).padStart(IdSize, "0"),
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
  const bytesPerRecord = RecordSize; // RecordSize
  // const position = skipPage * bytesPerRecord;

  fs.open(filePath, "r", (err, fileCountChecker) => {
    if (err) {
      return displayedLessons([]);
    }

    let filePosition = 0; // guys ito ung start pos
    let allData = ""; // ito naman storage ng data na nabasa
    let newLineCount = 0; // counter lang to sa newline \n
    let pageRecords = []; //paglalagyan ng record per page

    function readChunk() {
      const buf = Buffer.alloc(512); // nag allocate ako ng empty buffer

      fs.read(fileCountChecker, buf, 0, 512, filePosition, (err, bytesRead) => {
        if (err || bytesRead === 0) {
          console.error("Error reading file or end of file reached:", err);
          fs.close(fileCountChecker, () => {});

          processData(); // I-call ang function na magha-handle ng display ng page records kahit na may error o naabot na ang end of file
          return; // Exit the function if there's an error or if we've reached the end of the file
        }

        console.log("Bytes read from file:", bytesRead); // I-print ang bilang ng bytes na nabasa
        const chunkData = buf.toString("utf-8", 0, bytesRead);

        allData += chunkData;
        // i add ko yung chunk data sa all data, kasi baka yung isang chunk lang ay hindi sapat para makabuo ng isang buong record, kaya kailangan ko i-accumulate yung data hanggang sa makabuo ako ng isang buong record

        //dito sa for loop, binibilang ko yung mga newline character para malaman ko kung ilang records na ang nabasa ko, kasi yung page size is 10, kaya kapag nakabasa na ako ng 10 newline character, ibig sabihin nakabasa na ako ng 10 records, kaya pwede ko nang i-process yung page records at i-display sa user

        for (let i = 0; i < chunkData.length; i++) {
          if (chunkData[i] === "\n") {
            newLineCount++;

            console.log("New line count:", newLineCount); // I-print ang bilang ng mga bagong linya na nabasa

            if (newLineCount >= skipPage + pageSize) {
              console.log("Page records:", pageRecords); // I-print ang mga records ng page na nabasa
              fs.close(fileCountChecker, () => {});
              // Process the page records
              processData(); // I-call ang function na magha-handle ng display ng page records
              return; //exit the loop and wait for the next chunk to be read
            }
          }
        }

        filePosition += bytesRead;
        // position + bytesRead, para mag move yung position sa next chunk

        readChunk(); // I-call ulit ang function para magbasa ng next chunk
      });
    }

    function processData() {
      const lines = allData.split("\n").filter((line) => line.trim() !== ""); // Tanggalin yung mga empty lines

      let recordCount = 0; // ito yung counter para malaman ko kung ilang records na ang na-process, kasi kailangan ko i-skip yung mga records na hindi kasama sa current page, kaya kailangan ko i-count yung mga records na na-process para malaman ko kung kailan ako magsisimula mag-add ng records sa pageRecords array

      for (let line of lines) {
        if (recordCount >= skipPage && pageRecords.length < pageSize) {
          try {
            const record = JSON.parse(line);
            pageRecords.push(record);
          } catch {
            console.error("Error parsing JSON:", line);
          }
        }
        recordCount++;
      }

      console.log("Final page records:", pageRecords); // I-print ang mga final records ng page na na-process

      displayedLessons(pageRecords);
    }

    readChunk(); // Simulan ang pagbasa ng file sa pamamagitan ng pag-call sa readChunk function
  });
}

function viewLesson(page = 1) {
  loadAndPaginate(page, (records) => {
    records.forEach((record, index) => {
      console.log(
        `.${index + 1}. ID: ${record.id}, Title: ${record.title}, Description: ${record.description}`,
      );
    });

    rl.question("Do you want to view the next page? (Y or N): ", (ans) => {
      if (ans.toLowerCase() === "y") {
        viewLesson(page + 1);
      } else {
        showMenu();
      }
    });
  });
}

function editLesson(page = 1) {
  loadAndPaginate(page, (records) => {
    console.log("Available lessons:");
    records.forEach((record, index) => {
      console.log(
        `.${index + 1}. ID: ${record.id}, Title: ${record.title}, Description: ${record.description}`,
      );
    });

    rl.question("Do you want to view the next page? (Y or N): ", (ans) => {
      if (ans.toLowerCase() === "y") {
        editLesson(page + 1);
      } else {
        rl.question("Enter lesson ID to edit: ", (idInput) => {
          findRecordOnly(idInput, (foundRecord) => {
            if (!foundRecord) {
              console.log("Lesson not found!");
              return showMenu();
            }

            askWhatToEdit(foundRecord, (updatedRecord) => {
              if (!updatedRecord) {
                return showMenu();
              }

              updateRecordInFile(updatedRecord, (success) => {
                if (success) {
                  console.log("Lesson updated!");
                } else {
                  console.log(" Error updating!");
                }
                showMenu();
              });
            });
          });
        });
      }
    });
  });
}

function findRecordOnly(targetId, callback) {
  fs.open(filePath, "r", (err, fd) => {
    if (err) return callback(null);

    let filePosition = 0;
    let allData = "";
    let foundRecord = null;

    function readChunk() {
      const buf = Buffer.alloc(512);

      fs.read(fd, buf, 0, 512, filePosition, (err, bytesRead) => {
        if (err || bytesRead === 0) {
          fs.close(fd, () => {});
          return callback(foundRecord);
        }

        console.log("Bytes read from file:", buf);

        console.log("Bytes read from file:", bytesRead);

        const chunkData = buf.toString("utf-8", 0, bytesRead);
        allData += chunkData;

        const lines = allData.split("\n");
        allData = lines[lines.length - 1];

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];

          if (line.trim() !== "") {
            try {
              const record = JSON.parse(line);

              if (
                record.id ===
                String(parseInt(targetId, 10)).padStart(IdSize, "0")
              ) {
                console.log(` Found record!`);
                fs.close(fd, () => {});
                return callback(record);
              }
            } catch {}
          }
        }

        filePosition += bytesRead;
        readChunk();
      });
    }

    readChunk();
  });
}

function askWhatToEdit(record, callback) {
  console.log(`\nCurrent:`);
  console.log(`   Title: ${record.title}`);
  console.log(`   Description: ${record.description}`);

  rl.question(
    "\nWhat to edit? (1=title, 2=description, 0=cancel): ",
    (choice) => {
      if (choice === "0") {
        return callback(null);
      }

      if (choice === "1") {
        rl.question("Enter new title: ", (newTitle) => {
          record.title = newTitle;
          callback(record);
        });
      } else if (choice === "2") {
        rl.question("Enter new description: ", (newDesc) => {
          record.description = newDesc;
          callback(record);
        });
      } else {
        callback(null);
      }
    },
  );
}

function updateRecordInFile(updatedRecord, callback) {
  const index = parseInt(updatedRecord.id, 10) - 1;
  const position = index * RecordSize;

  // i-ensure na exact RecordSize ang bytes
  const jsonStr = JSON.stringify({
    id: updatedRecord.id,
    title: String(updatedRecord.title)
      .substring(0, TitleSize)
      .padEnd(TitleSize),
    description: String(updatedRecord.description)
      .substring(0, DescSize)
      .padEnd(DescSize),
  });

  const padded = jsonStr.padEnd(RecordSize - 1) + "\n";
  const buf = Buffer.from(padded, "utf-8");

  fs.open(filePath, "r+", (err, fd) => {
    if (err) return callback(false);

    fs.write(fd, buf, 0, RecordSize, position, (err) => {
      fs.close(fd, () => {});
      callback(!err);
    });
  });
}

function deleteLesson() {
  console.log("Deleting lesson...");
}

showMenu();
