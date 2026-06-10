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
function sendRecord(record: any): Promise<any> {
  return new Promise((resolve) => {
   const onData = (data: Buffer) => {
     client.off("data" , onData);
      //note ko: .off is used to remove the listener after receiving the response to avoid multiple responses for multiple requests 
      const response = JSON.parse(data.toString());
   }
    client.on("data", onData);

    const buf = Buffer.alloc(150);

    buf.write(record.title || "",0 ,50,"utf-8");
    buf.write(record.description || "",50 ,100,"utf-8");

    

    client.write(buf);
  });



}

async function showMenu() {
  while (true) {
    console.log("Menu:");
    console.log("1. Create a Lesson");
    console.log("2. Exit");

    const choice = await ask("Enter your choice: ");

    if (choice === "1") {
      const title = await ask("Enter lesson title: ");
      const description = await ask("Enter lesson description: ");

      console.log("Sending...");

      const response = await sendRecord({
        type: "create_lesson",
        title,
        description,
      });

      console.log("Server Response:", response);
    }

    else if (choice === "2") {
      console.log("Exiting...");

      rl.close();
      client.end();
      break; // IMPORTANT
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
