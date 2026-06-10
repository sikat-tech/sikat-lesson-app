import net from "net"

const client = net.createConnection({ port: 8080 }, () => {
    console.log("Connected to server");
});

client.on("data", (data) => {
    console.log(`Received data from server: ${data}`);
});

client.on("close", () => {
    console.log("Disconnected from server");
});