import * as net from 'net';

const client = net.createConnection({ port: 3000 }, () => {
    console.log('Connected to Lesson Storage Server');
});

// client.setEncoding('utf8'); // Convert all incoming server data to Strings
// process.stdin.setEncoding('utf8'); // Convert all keyboard inputs to Strings

// Listen for prompts from the server
client.on('data', (text: string) => {
    process.stdout.write(text); 
});

// Listen for your terminal typing and send it to the server
process.stdin.on('data', (text: string) => {
    client.write(text);
});

// Handle when the server hangs up the connection
client.on('end', () => {
    console.log('\n Server connection closed');
    process.exit(0); // Stop the terminal script
});