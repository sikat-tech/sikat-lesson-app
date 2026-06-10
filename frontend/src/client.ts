import net from "node:net";
import readline from "node:readline";
import promises from "node:fs/promises";


// Create a readline interface for reading user input from the terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Connect to the server
const client = net.createConnection({ port: 3000, host: "localhost" }, () => {
  console.log("Connected to server!");
  console.log("Type a message and press Enter to send. Type 'exit' to quit.\n");
  promptUser();
});

// Listen for messages from the server (from other clients)
client.on("data", (data) => {
  const message = data.toString().trim();
  console.log(`\n[Other Client]: ${message}`);
  promptUser(); // Show the prompt again
});

// Handle when the connection closes
client.on("end", () => {
  console.log("\nDisconnected from server");
  process.exit(0);
});

// Handle connection errors
client.on("error", (err) => {
  console.error("Connection error:", err.message);
  process.exit(1);
});

// Function to prompt the user for input
async function promptUser() {
  const input = await new Promise<string>((resolve) => {
    rl.question("You: ", resolve);
  });
  const message = input.trim();

  // Allow user to exit
  if (message.toLowerCase() === "exit") {
    console.log("Goodbye!");
    client.end();
    rl.close();
    return;
  }

  // Send the message to the server
  if (message) {
    client.write(message + "\n");
  }

  // Ask for the next message
  await promptUser();
}

// Handle when user exits the program (Ctrl+C)
process.on("SIGINT", () => {
  console.log("\nExiting...");
  client.end();
  rl.close();
  process.exit(0);
});
