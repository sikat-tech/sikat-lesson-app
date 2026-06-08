function editLesson() {
  // Step 1: Display all lessons (same as viewLesson)
  loadAndPaginate(1, (records) => {
    console.log("\n=== Available Lessons ===");
    records.forEach((record, index) => {
      console.log(
        `${index + 1}. ID: ${record.id} | Title: ${record.title}`
      );
    });

    // Step 2: Ask which ID to edit
    rl.question("\nEnter lesson ID to edit: ", (idInput) => {
      findAndEditRecord(idInput, (success) => {
        if (success) {
          console.log("✅ Lesson updated!");
        } else {
          console.log("❌ Lesson not found!");
        }
        showMenu();
      });
    });
  });
}

function findAndEditRecord(targetId, callback) {
  fs.open(filePath, "r", (err, fd) => {
    if (err) return callback(false);

    let filePosition = 0;
    let allData = "";
    let recordPosition = 0;  // ← WHERE IN FILE THE RECORD STARTS
    let foundRecord = null;
    let foundRecordData = null;
    let foundRecordLength = 0;

    function readChunk() {
      const buf = Buffer.alloc(512);

      fs.read(fd, buf, 0, 512, filePosition, (err, bytesRead) => {
        if (err || bytesRead === 0) {
          fs.close(fd, () => {});
          
          if (foundRecord) {
            // ✅ FOUND - Ask user what to edit
            askWhatToEdit(foundRecord, foundRecordData, fd, recordPosition, foundRecordLength, callback);
          } else {
            callback(false);
          }
          return;
        }

        const chunkData = buf.toString("utf-8", 0, bytesRead);
        allData += chunkData;

        // ============================================
        // PARSE LINES AND TRACK POSITIONS
        // ============================================
        const lines = allData.split("\n");
        
        // Keep incomplete line in allData
        allData = lines[lines.length - 1];
        recordPosition = filePosition + bytesRead - allData.length;

        // Process complete lines
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];
          
          if (line.trim() !== "") {
            try {
              const record = JSON.parse(line);
              
              // ✅ CHECK IF THIS IS THE RECORD WE WANT
              if (record.id === targetId) {
                console.log(`✅ Found record at position: ${recordPosition}`);
                foundRecord = record;
                foundRecordData = line;
                foundRecordLength = line.length + 1;  // +1 for \n
                fs.close(fd, () => {});
                askWhatToEdit(foundRecord, foundRecordData, fd, recordPosition, foundRecordLength, callback);
                return;  // STOP READING
              }
              
              recordPosition += line.length + 1;  // Move position forward
            } catch {}
          }
        }

        console.log(`📖 Read ${bytesRead} bytes, searching...`);

        filePosition += bytesRead;
        readChunk();  // Read next chunk
      });
    }

    readChunk();
  });
}

function askWhatToEdit(record, recordData, fd, position, recordLength, callback) {
  console.log(`\n✅ Found record:`);
  console.log(`   ID: ${record.id}`);
  console.log(`   Title: ${record.title}`);
  console.log(`   Description: ${record.description}`);

  rl.question("\nWhat to edit? (1=title, 2=description, 0=cancel): ", (choice) => {
    if (choice === "0") {
      return callback(false);
    }

    if (choice === "1") {
      rl.question("Enter new title: ", (newTitle) => {
        record.title = newTitle;
        writeRecordInPlace(fd, record, position, recordLength, callback);
      });
    } else if (choice === "2") {
      rl.question("Enter new description: ", (newDesc) => {
        record.description = newDesc;
        writeRecordInPlace(fd, record, position, recordLength, callback);
      });
    } else {
      callback(false);
    }
  });
}

function writeRecordInPlace(fd, updatedRecord, position, recordLength, callback) {
  // ============================================
  // Convert updated record to JSON string
  // ============================================
  const newRecordData = JSON.stringify(updatedRecord);
  const newRecordLength = newRecordData.length + 1;  // +1 for \n

  console.log(`\nOld record length: ${recordLength}`);
  console.log(`New record length: ${newRecordLength}`);

  // ============================================
  // Check if sizes match (can overwrite in place)
  // ============================================
  if (newRecordLength !== recordLength) {
    console.log("⚠️  Record size changed!");
    console.log("   Old: " + recordLength + " bytes");
    console.log("   New: " + newRecordLength + " bytes");
    console.log("   Cannot overwrite in place!");
    
    // Fallback: read entire file and rewrite
    console.log("   Rewriting entire file...");
    rewriteEntireFile(updatedRecord, callback);
    return;
  }

  // ============================================
  // SAME SIZE - Overwrite at position
  // ============================================
  const buf = Buffer.from(newRecordData + "\n", "utf-8");

  fs.write(fd, buf, 0, buf.length, position, (err, bytesWritten) => {
    fs.close(fd, () => {});

    if (err) {
      console.error("Error writing file:", err);
      return callback(false);
    }

    console.log(`✅ Wrote ${bytesWritten} bytes at position ${position}`);
    callback(true);
  });
}

function rewriteEntireFile(targetRecord, callback) {
  // Fallback if size changed
  fs.readFile(filePath, "utf-8", (err, data) => {
    if (err) return callback(false);

    const lines = data.split("\n").filter(l => l.trim() !== "");
    
    const updatedLines = lines.map(line => {
      try {
        const record = JSON.parse(line);
        if (record.id === targetRecord.id) {
          return JSON.stringify(targetRecord);
        }
      } catch {}
      return line;
    });

    fs.writeFile(filePath, updatedLines.join("\n") + "\n", (err) => {
      callback(!err);
    });
  });
}