import * as net from "net";
import * as fs from "fs";

// Define what a Lesson looks like
interface Lesson {
  title: string;
  desc: string;
}

// Define the state tracking for a connected client
interface ClientState {
  socket: net.Socket;
  status: "User Typing Title" | "User Typing Description" | "User Finished";
  tempTitle: string;
}

const FILE_PATH = "./lessonStorage.json";

// Helper function to safely save a lesson to the JSON file
function saveLessonToFile(newLesson: Lesson) {
  let lessons: Lesson[] = [];

  // If the file already exists, read the existing lessons first
  if (fs.existsSync(FILE_PATH)) {
    try {
      const fileData = fs.readFileSync(FILE_PATH, "utf8");
      lessons = JSON.parse(fileData);
    } catch (error) {
      console.log(
        "Creating a new file structure due to empty or invalid JSON.",
      );
    }
  }

  // Add the new lesson to the list
  lessons.push(newLesson);

  // Save the updated list back to the file (null, 2 makes the JSON look pretty)
  fs.writeFileSync(FILE_PATH, JSON.stringify(lessons, null, 2), "utf8");
  console.log(`Saved lesson: "${newLesson.title}" to JSON file.`);
}

const server = net.createServer((socket: net.Socket) => {
  socket.setEncoding("utf8");
  console.log("A client has connected.");

  // Track this specific client's current step
  const clientStatus: ClientState = {
    socket: socket,
    status: "User Typing Title",
    tempTitle: "",
  };

  // Prompt the client immediately for the first input
  socket.write("Welcome to Lesson Storage! Please enter the Lesson Title: ");

  socket.on("data", (text: string) => {
    const input = text.trim();
    // Capture the Title
    if (clientStatus.status === "User Typing Title") {
      if (!input) {
        socket.write("Title cannot be empty. Please enter a Lesson Title: ");
        return;
      }
      clientStatus.tempTitle = input;
      clientStatus.status = "User Typing Description"; // Move to the next step
      socket.write("Great! Now enter the Lesson Description: ");
      return;
    }

    // Capture the Description & Save
    if (clientStatus.status === "User Typing Description") {
      if (!input) {
        socket.write(
          "Description cannot be empty. Please enter a Description: ",
        );
        return;
      }

      // Construct our final Lesson object
      const finalLesson: Lesson = {
        title: clientStatus.tempTitle!,
        desc: input,
      };

      // Save it to the JSON file
      saveLessonToFile(finalLesson);

      // Inform the user and change step to finished
      clientStatus.status = "User Finished";
      socket.write("\nSuccessfully saved! Thank you. Disconnecting...\n");
      socket.end(); // close the connection
    }
  });

  socket.on("end", () => {
    console.log("Client finished and disconnected.");
  });
});

server.listen(3000, () => {
  console.log("Server is running on port 3000...");
});
