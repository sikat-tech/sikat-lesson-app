import * as net from "net";
import * as readline from "readline";

interface LessonRecord {
  id: number;
  title: string;
  desc: string;
}

interface ServerResponse {
  ok: boolean;
  status?: "success" | "error";
  message?: string;
  lessons?: LessonRecord[];
}


const COL_ID = 12;
const COL_TITLE = 30;
const COL_DESC = 223;
const LINE_RECORD = 318;

// Connect to server on port 8080, same machine localhost.
const client: net.Socket = net.createConnection(
  { port: 8080, host: "127.0.0.1" },
  () => {},
);

const rl: readline.Interface = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// We wrap readline's "question" in a Promise so we can use await with it.
const ask = (question: string): Promise<string> =>
  new Promise((resolve) => rl.question(question, resolve));

// Send message to the server
function sendRecord(messageToSend: object): Promise<ServerResponse> {
  return new Promise((resolve) => {
      client.on("data", (data) => { 
      resolve(JSON.parse(data.toString()) as ServerResponse);
    });

    client.write(JSON.stringify(messageToSend));
  });
}

let currentPage = 0;
const itemsPerPage = 10;

async function handleViewPagination(lessons: LessonRecord[]): Promise<void> {
  const startIndex = currentPage * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, lessons.length);
  const pageLessons = lessons.slice(startIndex, endIndex);
 
  console.log(`\n--- View Lessons (Page ${currentPage + 1}) ---`);

  if (pageLessons.length === 0) {
    console.log("No lessons found on this page.");
  } else {
    pageLessons.forEach((lesson, index) => {
      console.log(
        `${startIndex + index + 1}. ID: ${lesson.id} - ${lesson.title} - ${lesson.desc}`,
      );
    });
  }

  const options: string[] = [];
  const hasNextPage = endIndex < lessons.length;

  if (hasNextPage) {
    options.push("N = Next Page");
  }

  if (currentPage > 0) {
    options.push("P = Prev Page");
  }

  options.push("M = Main Menu");

  const answer = await ask(`\n[${options.join(" | ")}]: `);
  const choice = answer.toLowerCase();

  if (choice === "n" && hasNextPage) {
    currentPage++;
    await handleViewPagination(lessons);
  } else if (choice === "p" && currentPage > 0) {
    currentPage--;
    await handleViewPagination(lessons);
  } else {
    currentPage = 0;
    await showMenu();
  }
}

async function showMenu(): Promise<void> {
  console.log("\nMenu:");
  console.log("1. Create a Lesson");
  console.log("2. View Lessons");
  console.log("3. Edit a Lesson");
  console.log("4. Delete a Lesson");
  console.log("5. Exit");

    const choice = await ask("Enter your choice: ");

    if (choice === "1") {
      const title = await ask("Enter lesson title: ");
      const description = await ask("Enter lesson description: ");

    console.log("Sending to server, please wait...");

    // Send create request to the server
    const response = await sendRecord({
      type: "create_lesson",
      title,
      description,
    });

    console.log(`Server says: ${response.message}`);
  } else if (choice === "2") {
    const response = await sendRecord({ type: "view_lessons" });

    if (response.ok && response.lessons && response.lessons.length > 0) {
      await handleViewPagination(response.lessons);
      return;
    } else {
      console.log("\nNo lessons available to show.");
    }
  } else if (choice === "3") {
    // use promisified method because async/await for multiple sequential inputs
    const id = await ask("Enter the lesson ID to edit: ");
    const title = await ask("Enter new title (press Enter to keep current): ");
    const description = await ask(
      "Enter new description (press Enter to keep current): ",
    );

    console.log("Sending update to server...");

    const response = await sendRecord({
      type: "update_lesson",
      id: id,
      title: title.trim() !== "" ? title : undefined,
      description: description.trim() !== "" ? description : undefined,
    });

    console.log(`Server says: ${response.message}`);
  }

  else if (choice === "4") {
    const id = await ask("Enter the lesson ID to delete: ");

    const confirm = await ask(
      `Are you sure you want to delete lesson ID ${id}? (Y/N): `,
    );

    if (confirm.toLowerCase() === "y") {
      console.log("Sending delete request to server...");

      const response = await sendRecord({
        type: "delete_lesson",
        id: id,
      });

      console.log(`Server says: ${response.message}`);
    } else {
      console.log("Deletion cancelled. Nothing was changed.");
    }
  }

  else if (choice === "5") {
    console.log("Goodbye!");
    rl.close();  
    client.end(); 
    return;
  }

  else {
    console.log("That's not a valid option. Please enter valid choice from menu");
  }

  await showMenu();
}

// Initialize connection to server
client.on("connect", () => {
  console.log("Connected to the server!");
  showMenu();

});

// connection errors
client.on("error", (err: Error) => {
  console.error(`Could not connect to server: ${err.message}`);
});

// server closes the connection
client.on("end", () => {
  console.log("\nDisconnected from the server.");
});

