import {net} from "net";


module.exports = function createClient(port) {
  const client = new net.Socket();

  client.connect(port, () => {
    console.log("Connected to server");

    client.write("Hello, server! This is the client.");
  });

  client.on("close", () => {
    console.log("Connection closed");
  });
};


