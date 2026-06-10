import net from "node:net";

// Store all connected client sockets
const clients: net.Socket[] = [];

const server = net.createServer((socket) => {
  // Add this client to our list when they connect
  clients.push(socket);
  console.log(`Client connected. Total clients: ${clients.length}`);

  socket.on("data", (data) => {
    const message = data.toString().trim();
    console.log(`[Server] Received: "${message}"`);

    // Broadcast this message to ALL other connected clients
    clients.forEach((client) => {
      // Don't send the message back to the sender
      if (client !== socket && client.writable) {
        client.write(message + "\n");
      }
    });
  });

  socket.on("end", () => {
    // Remove this client from the list when they disconnect
    const index = clients.indexOf(socket);
    if (index > -1) {
      clients.splice(index, 1);
    }
    console.log(`Client disconnected. Total clients: ${clients.length}`);
  });

  socket.on("error", (err) => {
    console.error("Socket error:", err.message);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`TCP Server listening on port ${PORT}`);
  console.log("Server is ready to distribute messages between clients...\n");
});
