import net from "net";
import readline from "readline";

// --- Global Declarations ---
const PORT = 8080;
const HOST = "127.0.0.1";

const BUF_SIZE = 170;
const TYPE_OFFSET = 0;
const TYPE_LENGTH = 20;
const TITLE_OFFSET = 20;
const TITLE_LENGTH = 50;
const DESC_OFFSET = 70;
const DESC_LENGTH = 100;

type MessageType = "create_lesson" | "delete_lesson" | "update_lesson";

interface ClientMessage {
  type: MessageType;
  title?: string;
  description?: string;
  id?: string;
}

interface ServerResponse {
  ok: boolean;
  status: "success" | "error";
  message: string;
}
// --- End Global Declarations ---

const client = net.createConnection({ port: PORT, host: HOST }, () => {});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const ask = (q: string): Promise<string> =>
  new Promise((resolve) => rl.question(q, resolve));

function sendRecord(record: ClientMessage): Promise<ServerResponse> {
  return new Promise((resolve) => {
    const onData = (data: Buffer) => {
      client.off("data", onData);
      const response: ServerResponse = JSON.parse(data.toString());
      resolve(response);
    };
    client.on("data", onData);

    const buf = Buffer.alloc(BUF_SIZE);
    buf.write(record.type || "",        TYPE_OFFSET,  TYPE_LENGTH,  "utf-8");
    buf.write(record.title || "",       TITLE_OFFSET, TITLE_LENGTH, "utf-8");
    buf.write(record.description || "", DESC_OFFSET,  DESC_LENGTH,  "utf-8");
    client.write(buf);
  });
}

async function showMenu() {
  while (true) {
    console.log("\nMenu:");
    console.log("1. Create a Lesson");
    console.log("2. Delete a Lesson");
    console.log("3. Update a Lesson");
    console.log("4. Exit");

    const choice = await ask("Enter your choice: ");

    if (choice === "1") {
      const title = await ask("Enter lesson title: ");
      const description = await ask("Enter lesson description: ");
      const response = await sendRecord({ type: "create_lesson", title, description });
      console.log("Server Response:", response);

    } else if (choice === "2") {
      // TODO
      console.log("Not yet implemented");

    } else if (choice === "3") {
      // TODO
      console.log("Not yet implemented");

    } else if (choice === "4") {
      console.log("Exiting...");
      rl.close();
      client.end();
      break;
    }
  }
}

client.on("connect", () => {
  console.log("Connected to TCP server");
  showMenu();
});

client.on("error", (err) => {
  console.error(`Connection error: ${err.message}`);
});

client.on("end", () => {
  console.log("Disconnected from TCP server");
});