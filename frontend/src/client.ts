import net from "node:net";
import readline from "node:readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}
const client = net.createConnection({ port: 3000, host: "127.0.0.1" }, () => {
  console.log("Connected to Lesson Server!");
  showMenu();
});

let dataBuffer = "";

client.on("data", (data) => {
  dataBuffer += data.toString();

  let newlineIndex: number;
  while ((newlineIndex = dataBuffer.indexOf("\n")) !== -1) {
    const rawMessage = dataBuffer.substring(0, newlineIndex).trim();
    dataBuffer = dataBuffer.substring(newlineIndex + 1);

    if (!rawMessage) continue;

    try {
      const response = JSON.parse(rawMessage);
      handleServerResponse(response);
    } catch {
      console.log(`[Server]: ${rawMessage}`);
    }
  }
});

function handleServerResponse(response: { action: string; lessons?: Array<{ id: string; title: string; desc: string }>; message?: string; lesson?: { id: string; title: string; desc: string } }) {
  if (response.action === "lesson_created") {
    console.log(`\nLesson created successfully!`);
    if (response.lesson) {
      console.log(`   ID: ${response.lesson.id}`);
      console.log(`   Title: ${response.lesson.title}`);
      console.log(`   Description: ${response.lesson.desc}`);
    }
    showMenu();
  } else if (response.action === "lessons_list") {
    const lessons = response.lessons ?? [];
    if (lessons.length === 0) {
      console.log("\nNo lessons available.");
    } else {
      console.log(`\n ─── All Lessons (${lessons.length}) ───`);
      lessons.forEach((lesson, index) => {
        console.log(`  ${index + 1}. [ID: ${lesson.id}] ${lesson.title}`);
        console.log(`     ${lesson.desc}`);
      });
    }
    showMenu();
  } else if (response.action === "error") {
    console.log(`\nError: ${response.message}`);
    showMenu();
  } else if (response.action === "new_lesson_broadcast") {
    if (response.lesson) {
      console.log(`\nNew lesson added by another client: "${response.lesson.title}"`);
    }
  }
}

client.on("end", () => {
  console.log("\nDisconnected from server");
  process.exit(0);
});

client.on("error", (err) => {
  console.error("Connection error:", err.message);
  process.exit(1);
});


async function showMenu() {
  console.log("\n─── Lesson Menu ───");
  console.log("1. Create Lesson");
  console.log("2. View Lessons");
  console.log("3. Exit");

  const choice = await ask("Choose an option: ");

  if (choice === "1") {
    await createLesson();
  } else if (choice === "2") {
    viewLessons();
  } else if (choice === "3") {
    console.log("Goodbye!");
    client.end();
    rl.close();
  } else {
    console.log("Invalid option.");
    showMenu();
  }
}

async function createLesson() {
  const title = await ask("Lesson Title: ");
  if (!title.trim()) {
    console.log("Title cannot be empty.");
    return showMenu();
  }

  const desc = await ask("Description: ");
  if (!desc.trim()) {
    console.log("Description cannot be empty.");
    return showMenu();
  }

  const request = {
    action: "create",
    title: title.trim(),
    desc: desc.trim(),
  };

  client.write(JSON.stringify(request) + "\n");
}

function viewLessons() {
  const request = { action: "view" };
  client.write(JSON.stringify(request) + "\n");
}

process.on("SIGINT", () => {
  console.log("\nExiting...");
  client.end();
  rl.close();
  process.exit(0);
});
