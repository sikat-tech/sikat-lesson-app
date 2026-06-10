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

let clientCount = 0;

const server = net.createServer((socket) => {
  console.log("Client connected");
  clientCount++;


  console.log(`total clients connected: ${clientCount}`);

  socket.on("data", (data: Buffer) => {

    const title = data.toString("utf-8", 0, 50); 

    const description = data.toString("utf-8", 50, 150);

    const msg = {
      type: "create_lesson",
      title,
      description,
    };
    
    
    const response = handleClientData(msg);

    socket.write(JSON.stringify(response)); 
  });

  socket.on("end", () => {
    console.log("Client disconnected");
    clientCount--;
  });
});

server.listen(PORT, HOST, () => {
  console.log(`TCP server listening on port ${PORT} at ${HOST}`);
});
