import * as net from "net";
import { PORT, HOST } from "./shared/constants.ts";
import type { ClientMessage, ServerResponse } from "./shared/types.ts";
import { handleClientData } from "./server/handlers.ts";

let clientCounter = 0;

const server: net.Server = net.createServer((socket: net.Socket) => {
  console.log("A client has connected!");
  clientCounter++;
  console.log(`Total connected clients: ${clientCounter}`);

  socket.on("data", (data: Buffer) => {
    try {
      console.log(`Message received from client: ${data.toString()}`);
      const msg = JSON.parse(data.toString()) as ClientMessage;

      const response = handleClientData(msg);
      socket.write(JSON.stringify(response));
    } catch (err) {
      const errorResponse: ServerResponse = {
        ok: false,
        message: "Invalid data formatting.",
      };
      socket.write(JSON.stringify(errorResponse));
    }
  });

  socket.on("end", () => {
    console.log("Client disconnected.");
    clientCounter--;
    console.log(`Total connected clients: ${clientCounter}`);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Server is running! Listening on port ${PORT} at ${HOST}`);
});