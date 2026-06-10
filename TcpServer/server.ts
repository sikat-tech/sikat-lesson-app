import net from "net";
import fs from "fs";

const filePath = "lessons.ndjson";

const PORT = 8080;
const HOST = "127.0.0.1";

function lessonToNDJSON(title: string, description: string) {
  const lesson = {
    title,
    description,
  };

  fs.appendFileSync(filePath, JSON.stringify(lesson) + "\n");
}

function handleClientData(msg: any) {
  if (msg.type === "create_lesson") {
    lessonToNDJSON(msg.title, msg.description);

    return {
      ok: true,
      status: "success",
      message: "Lesson created successfully",
    };
  } else {
    return {
      ok: false,
      status: "error",
      message: "Invalid request type",
    };
  }
}

const server = net.createServer((socket) => {
  console.log("Client connected");

  socket.on("data", (data) => {

    console.log(`Received data from client: ${data}`);

    const msg = JSON.parse(data.toString()); // Assuming the client sends JSON data
    const response = handleClientData(msg); // Process the message and generate a response
    socket.write(JSON.stringify(response)); // covert the response to JSON and send it back to the client

  });

  socket.on("end", () => {
    console.log("Client disconnected");
  });
});

server.listen(PORT, HOST, () => {
  console.log(`TCP server listening on port ${PORT} at ${HOST}`);
});
