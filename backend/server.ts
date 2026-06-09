const net = require('net');
const createClient = require('../frontend/client.js');
const PORT = 3000;
const HOST = '';




const server = net.createServer((socket) => {
    
    console.log('Client connected');

    socket.on('error', (err) => {
        console.error('Socket error:', err.message);
    });

    socket.on('end', () => {
        console.log('Client disconnected');
    });

    socket.on('data', (data) => {
        console.log(`Received from client: ${data}`);
        socket.write(`Server received: ${data}`);
    });
});

server.listen(PORT, () => {
    createClient(PORT);
    console.log(`Server listening on port ${PORT}`);
});