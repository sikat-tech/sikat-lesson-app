const readline = require("readline");
const fs = require("fs");

const filePath = "lessons.ndjson";

const pack   = (lessonObject) => ({ t: lessonObject.title, d: lessonObject.desc });
const unpack = (lessonObject) => ({ title: lessonObject.t,   desc: lessonObject.d  });

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function loadLessons() {
    if (!fs.existsSync(filePath)) return [];

    const lessons = [];
    const stream  = fs.createReadStream(filePath, "utf8");
    const liner   = readline.createInterface({ input: stream });

    liner.on("line", (line) => {
        if (line.trim()) lessons.push(unpack(JSON.parse(line)));
    });

    return lessons;
}

function saveLessons(lessons) {
    const lines = lessons.map((lessonObject) => JSON.stringify(pack(lessonObject))).join("\n") + "\n";
    fs.writeFileSync(filePath, lines, "utf8");
}

function appendLesson(lesson) {
    fs.appendFileSync(filePath, JSON.stringify(pack(lesson)) + "\n", "utf8");
}

function showmenu() {
    console.log("\n--- Menu List ---");
    console.log("1. Create Lesson");
    console.log("2. View Lesson");
    console.log("3. Edit Lesson");
    console.log("4. Exit");

    rl.question("Choose an option: ", handleMenu);
}

function handleMenu(option) {
    if (option === "1") {
        createLesson();
    } else if (option === "2") {
        viewLesson();
    } else if (option === "3") {
        editLesson();
    } else if (option === "4") {
        console.log("Goodbye!");
        rl.close();
    } else {
        console.log("Invalid Option");
        showmenu();
    }
}
 
function createLesson() {
    rl.question("Lesson Title: ", (title) => {
        rl.question("Description: ", (desc) => {
            appendLesson({ title, desc });
            console.log("\nLesson Created!");
            showmenu();
        });
    });
}

function viewLesson() {
    if (!fs.existsSync(filePath)) {
        console.log("No Lessons Available");
        return showmenu();
    }

    let page = 0;

    function showPage() {
        const skip  = page * 10;
        let count   = 0;
        let shown   = 0;
        let hasNext = false;
        let stopped = false;

        const stream = fs.createReadStream(filePath, "utf8");
        const liner  = readline.createInterface({ input: stream });

        console.log(`\n--- Page ${page + 1} ---`);

        liner.on("line", (line) => {
            if (stopped || !line.trim()) return;
            count++;

            if (count <= skip) return;         

            if (shown >= 10) {                 
                hasNext = true;
                stopped = true;
                liner.close();
                stream.destroy();
                return;
            }

            shown++;
            const l = unpack(JSON.parse(line));
            console.log(`${skip + shown}. ${l.title} - ${l.desc}`);
        });

        liner.on("close", () => {
            if (shown === 0) {
                console.log("No Lessons Available");
                return showmenu();
            }

            const opts = [];
            if (hasNext)  opts.push("N = Next");
            if (page > 0) opts.push("P = Prev");
            opts.push("M = Menu");

            rl.question(`\n[${opts.join(" | ")}]: `, (ans) => {
                const key = ans.toUpperCase();
                if      (key === "N" && hasNext)  { page++; showPage(); }
                else if (key === "P" && page > 0) { page--; showPage(); }
                else showmenu();
            });
        });
    }

    showPage();
}


function editLesson() {
    if (!fs.existsSync(filePath)) {
        console.log("No Lessons Available");
        return showmenu();
    }

    let page = 0;

    function showPage() {
        const skip  = page * 10;
        let count   = 0;
        let shown   = 0;
        let hasNext = false;
        let stopped = false;

        const stream = fs.createReadStream(filePath, "utf8");
        const liner  = readline.createInterface({ input: stream });

        console.log(`\n--- Page ${page + 1} ---`);

        liner.on("line", (line) => {
            if (stopped || !line.trim()) return;
            count++;

            if (count <= skip) return;         

            if (shown >= 10) {                 
                hasNext = true;
                stopped = true;
                liner.close();
                stream.destroy();
                return;
            }

            shown++;
            const l = unpack(JSON.parse(line));
            console.log(`${skip + shown}. ${l.title} - ${l.desc}`);
        });

        liner.on("close", () => {
            if (shown === 0) {
                console.log("No Lessons Available");
                return showmenu();
            }

            const opts = [];
            if (hasNext)  opts.push("N = Next");
            if (page > 0) opts.push("P = Prev");
            opts.push("# = Pick lesson number");
            opts.push("M = Menu");

            rl.question(`\n[${opts.join(" | ")}]: `, (ans) => {
                const key = ans.toUpperCase();

                if      (key === "N" && hasNext)  { page++; showPage(); }
                else if (key === "P" && page > 0) { page--; showPage(); }
                else if (key === "M")             { showmenu(); }
                else {
                    // treat input as a lesson number
                    const lessons = [];
                    if (!fs.existsSync(filePath)) {
                        console.log("No Lessons Available");
                        return showmenu();
                    }

                    const s2   = fs.createReadStream(filePath, "utf8");
                    const lin2 = readline.createInterface({ input: s2 });

                    lin2.on("line", (line) => {
                        if (line.trim()) lessons.push(unpack(JSON.parse(line)));
                    });

                    lin2.on("close", () => {
                        const index = parseInt(ans) - 1;

                        if (isNaN(index) || index < 0 || index >= lessons.length) {
                            console.log("Invalid selection");
                            return showPage();
                        }

                        rl.question("New Title (Leave blank to keep current): ", (newTitle) => {
                            rl.question("New Description (Leave blank to keep current): ", (newDesc) => {
                                lessons[index].title = newTitle || lessons[index].title;
                                lessons[index].desc  = newDesc  || lessons[index].desc;

                                saveLessons(lessons);
                                console.log("\nLesson Updated!");
                                showmenu();
                            });
                        });
                    });
                }
            });
        });
    }
    showPage();
}

showmenu();