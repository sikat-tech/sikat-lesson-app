import net from "net";
import readline from "readline";

//iconnect sa server
const client = net.createConnection(
  { port: 8080, host: "127.0.0.1" },
  () => {},
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

//dito gumamit ako ng promisified method to convert callback style into promise style para mas madali gamitin sa async/await
const ask = (q: string): Promise<string> =>
  new Promise((resolve) => rl.question(q, resolve));


//
function sendRecord(Record: any): Promise<any> {
  return new Promise((resolve) => {
    client.once("data", (data) => {
      resolve(data.toString());
    });

    client.write(JSON.stringify(Record));
  });
}

async function showMenu() {
  console.log("Menu:");
  console.log("1. Create a Lesson");
  console.log("2. Exit");

  const choice = await ask("Enter your choice: ");

  if (choice === "1") {
    const title = await ask("Enter lesson title: ");
    const description = await ask("Enter lesson description: ");

    const record = sendRecord({
      type: "create_lesson",
      title,
      description,
    });
    console.log("Record sent to server, waiting for response...");

    await showMenu();
  }

  else if (choice === "2") {
  rl.close();
  client.end();
  return;
  }

  await showMenu();
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
