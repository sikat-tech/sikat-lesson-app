import net from 'net';

const server = net.createServer(() => {
   console.log('Client connected');
});