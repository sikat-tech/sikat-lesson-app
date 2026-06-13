import * as net from "net";
import * as readline from "readline";
import { PORT, HOST } from "./shared/constants.ts";
import type { ServerResponse } from "./shared/types.ts";

const client: net.Socket = net.createConnection({ port: PORT, host: HOST });

const rl: readline.Interface = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (question: string): Promise<string> =>
  new Promise((resolve) => rl.question(question, resolve));

function sendRecord(messageToSend: object): Promise<ServerResponse> {
  return new Promise((resolve) => {
    client.once("data", (data) => {
      resolve(JSON.parse(data.toString()) as ServerResponse);
    });
    client.write(JSON.stringify(messageToSend));
  });
}

let currentPage = 0;

async function handleViewPagination(): Promise<void> {
  const response = await sendRecord({
    type: "view_lessons",
    page: currentPage,
  });

  const pagelessons = response.lessons ?? [];
  const hasNextPage = response.hasNextPage ?? false;

  console.log(`\n--- View Lessons (Page ${currentPage + 1}) ---`);

  if (pagelessons.length === 0) {
    console.log("No lessons found on this page.");
  } else {
    pagelessons.forEach((lesson, index) => {
      const itemNumber = currentPage * 10 + index + 1;
      console.log(`${itemNumber}. ID: ${lesson.id} - ${lesson.title.trim()} - ${lesson.desc.trim()}`);
    });
  }

  const options: string[] = [];
  if (hasNextPage) options.push("N = Next Page");
  if (currentPage > 0) options.push("P = Prev Page");
  options.push("M = Main Menu");

  const answer = await ask(`\n[${options.join(" | ")}]: `);
  const choice = answer.toLowerCase();

  if (choice === "n" && hasNextPage) {
    currentPage++;
    await handleViewPagination();
  } else if (choice === "p" && currentPage > 0) {
    currentPage--;
    await handleViewPagination();
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
  console.log("5. View Lessons Sorted by Title");
  console.log("6. Exit");

  const choice = await ask("Enter your choice: ");

  if (choice === "1") {
    const title = await ask("Enter lesson title: ");
    const description = await ask("Enter lesson description: ");
    console.log("Sending to server, please wait...");

    const response = await sendRecord({ type: "create_lesson", title, description });
    console.log(`Server says: ${response.message}`);
  } else if (choice === "2") {
    currentPage = 0;
    await handleViewPagination();
    return;
  } else if (choice === "3") {
    const id = await ask("Enter the lesson ID to edit: ");
    const title = await ask("Enter new title (press Enter to keep current): ");
    const description = await ask("Enter new description (press Enter to keep current): ");
    console.log("Sending update to server...");

    const response = await sendRecord({
      type: "update_lesson",
      id: id,
      title: title.trim() !== "" ? title : undefined,
      description: description.trim() !== "" ? description : undefined,
    });
    console.log(`Server says: ${response.message}`);
  } else if (choice === "4") {
    const id = await ask("Enter the lesson ID to delete: ");
    const confirm = await ask(`Are you sure you want to delete lesson ID ${id}? (Y/N): `);

    if (confirm.toLowerCase() === "y") {
      console.log("Sending delete request to server...");
      const response = await sendRecord({ type: "delete_lesson", id: id });
      console.log(`Server says: ${response.message}`);
    } else {
      console.log("Deletion cancelled. Nothing was changed.");
    }
  } else if (choice === "5") {
    const sortByChoice = await ask("Sort lessons by title? (Y/N): ");
    const sortBy = sortByChoice.toLowerCase() === "y" ? "title" : undefined;

    let sortPage = 0;
    let keepViewing = true;

    while (keepViewing) {
      console.log(`\nFetching sorted lessons (Page ${sortPage + 1})...`);
      const response = await sendRecord({ type: "sort_by_title", sortBy, page: sortPage });

      if (response.ok && response.lessons && response.lessons.length > 0) {
        console.log("\n--- Sorted Lessons ---");
        response.lessons.forEach((lesson) => {
          console.log(`Title: ${lesson.title.trim()}`);
        });

        console.log(`\n[Current Page: ${sortPage + 1}]`);
        if (response.hasNextPage) console.log("N. Next Page");
        if (sortPage > 0) console.log("P. Previous Page");
        console.log("M. Main Menu");

        const nav = (await ask("Choose an option: ")).toUpperCase();
        if (nav === "N" && response.hasNextPage) {
          sortPage++;
        } else if (nav === "P" && sortPage > 0) {
          sortPage--;
        } else if (nav === "M") {
          keepViewing = false;
        } else {
          console.log("Invalid option.");
        }
      } else {
        console.log("\nNo lessons available to show on this page.");
        keepViewing = false;
      }
    }
  } else if (choice === "6") {
    console.log("Goodbye!");
    rl.close();
    client.end();
    return;
  } else {
    console.log("That's not a valid option. Please enter valid choice from menu");
  }

  await showMenu();
}

client.on("connect", () => {
  console.log("Connected to the server!");
  showMenu();
});

client.on("error", (err: Error) => {
  console.error(`Could not connect to server: ${err.message}`);
});

client.on("end", () => {
  console.log("\nDisconnected from the server.");
});