import * as fs from "fs";
import { FILE_PATH, LINE_RECORD } from "../shared/constants.ts";
import type { ClientMessage, ServerResponse, LessonRecord } from "../shared/types.ts";
import { getNextId, processRecordBuffer, byteOffset, readRecordAt, writeRecordAt } from "./saving.ts";

export function handleClientData(msg: ClientMessage): ServerResponse {

  // 1. CREATE LESSON
  if (msg.type === "create_lesson") {
    const newLesson: LessonRecord = {
      id: String(getNextId()),
      title: msg.title || "",
      desc: msg.description || "",
    };

    const buffer = processRecordBuffer(newLesson);
    fs.appendFileSync(FILE_PATH, buffer);

    return {
      ok: true,
      status: "success",
      message: `Lesson created successfully with ID ${newLesson.id}.`,
    };
  }

  // 2. VIEW LESSONS
  if (msg.type === "view_lessons") {
    if (!fs.existsSync(FILE_PATH))
      return { ok: true, lessons: [], hasNextPage: false };

    const ITEMS_PER_PAGE = 10;
    const page = msg.page ?? 0;
    const size = fs.statSync(FILE_PATH).size;
    const totalRecords = Math.floor(size / LINE_RECORD);

    const fd = fs.openSync(FILE_PATH, "r");
    const lessons: LessonRecord[] = [];

    let currentSlot = 0;
    let validLessons = 0;
    const targetSkipCount = page * ITEMS_PER_PAGE;

    while (currentSlot < totalRecords && validLessons < targetSkipCount) {
      const lesson = readRecordAt(fd, currentSlot * LINE_RECORD);
      if (lesson && lesson.id !== "DELETED") validLessons++;
      currentSlot++;
    }

    while (currentSlot < totalRecords && lessons.length < ITEMS_PER_PAGE) {
      const lesson = readRecordAt(fd, currentSlot * LINE_RECORD);
      if (lesson && lesson.id !== "DELETED") lessons.push(lesson);
      currentSlot++;
    }

    let hasNextPage = false;
    while (currentSlot < totalRecords) {
      const lesson = readRecordAt(fd, currentSlot * LINE_RECORD);
      if (lesson && lesson.id !== "DELETED") {
        hasNextPage = true;
        break;
      }
      currentSlot++;
    }

    fs.closeSync(fd);
    return { ok: true, lessons, hasNextPage };
  }

  // 3. UPDATE LESSON
  if (msg.type === "update_lesson") {
    const id = Number(msg.id);
    if (isNaN(id) || id < 1) return { ok: false, message: "Invalid lesson ID." };
    if (!fs.existsSync(FILE_PATH)) return { ok: false, message: "No data file exists." };

    const offset = byteOffset(id);
    const size = fs.statSync(FILE_PATH).size;
    if (offset >= size) return { ok: false, message: `Lesson with ID ${id} not found.` };

    const fd = fs.openSync(FILE_PATH, "r+");
    const existingLesson = readRecordAt(fd, offset);

    if (!existingLesson || existingLesson.id === "DELETED") {
      fs.closeSync(fd);
      return { ok: false, message: `Lesson with ID ${id} not found.` };
    }

    writeRecordAt(fd, offset, {
      id: existingLesson.id,
      title: msg.title || existingLesson.title,
      desc: msg.description || existingLesson.desc,
    });

    fs.closeSync(fd);
    return { ok: true, message: `Lesson with ID ${id} updated successfully.` };
  }

  // 4. DELETE LESSON (Tombstoning)
  if (msg.type === "delete_lesson") {
    const id = Number(msg.id);
    if (isNaN(id) || id < 1) return { ok: false, message: "Invalid lesson ID." };
    if (!fs.existsSync(FILE_PATH)) return { ok: false, message: "No data file exists." };

    const offset = byteOffset(id);
    const size = fs.statSync(FILE_PATH).size;
    if (offset + LINE_RECORD > size) return { ok: false, message: `Lesson ID ${id} not found.` };

    const fd = fs.openSync(FILE_PATH, "r+");
    const existingLesson = readRecordAt(fd, offset);

    if (!existingLesson || existingLesson.id === "DELETED") {
      fs.closeSync(fd);
      return { ok: false, message: `Lesson with ID ${id} not found.` };
    }

    writeRecordAt(fd, offset, { id: "DELETED", title: "", desc: "" });
    fs.closeSync(fd);
    return { ok: true, message: `Lesson with ID ${id} deleted successfully.` };
  }

  // 5. SORT LESSONS BY TITLE
  if (msg.type === "sort_by_title") {
    if (!fs.existsSync(FILE_PATH)) {
      return { ok: true, status: "success", lessons: [], hasNextPage: false };
    }

    const ITEMS_PER_PAGE = 10;
    const page = msg.page ?? 0;
    const size = fs.statSync(FILE_PATH).size;
    const totalRecords = Math.floor(size / LINE_RECORD);

    const fd = fs.openSync(FILE_PATH, "r");
    const lessons: LessonRecord[] = [];

    let currentSlot = 0;
    let validLessonsCount = 0;
    const targetSkipCount = page * ITEMS_PER_PAGE;

    while (currentSlot < totalRecords && validLessonsCount < targetSkipCount) {
      const lesson = readRecordAt(fd, currentSlot * LINE_RECORD);
      if (lesson && lesson.id !== "DELETED") validLessonsCount++;
      currentSlot++;
    }

    while (currentSlot < totalRecords && lessons.length < ITEMS_PER_PAGE) {
      const lesson = readRecordAt(fd, currentSlot * LINE_RECORD);
      if (lesson && lesson.id !== "DELETED") lessons.push(lesson);
      currentSlot++;
    }

    let hasNextPage = false;
    while (currentSlot < totalRecords) {
      const lesson = readRecordAt(fd, currentSlot * LINE_RECORD);
      if (lesson && lesson.id !== "DELETED") {
        hasNextPage = true;
        break;
      }
      currentSlot++;
    }

    fs.closeSync(fd);

    if (msg.sortBy === "title" && lessons.length > 0) {
      lessons.sort((a, b) => a.title.trim().toLowerCase().localeCompare(b.title.trim().toLowerCase()));
    }

    return { ok: true, status: "success", lessons, hasNextPage };
  }

  return { ok: false, status: "error", message: "Invalid request type" };
}