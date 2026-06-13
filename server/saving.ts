import * as fs from "fs";
import { FILE_PATH, LINE_RECORD, COL_ID, COL_TITLE, COL_DESC } from "../shared/constants.ts";
import type { LessonRecord } from "../shared/types.ts";


// Serializes a record and forces it into a fixed size block
export function processRecordBuffer(lesson: LessonRecord): Buffer {
  const trimmed = {
    id: String(lesson.id).substring(0, COL_ID),
    title: String(lesson.title).substring(0, COL_TITLE),
    desc: String(lesson.desc).substring(0, COL_DESC),
  };
  let jsonStr = JSON.stringify(trimmed);

  const paddingNeeded = LINE_RECORD - jsonStr.length - 1;
  if (paddingNeeded > 0) {
    jsonStr += " ".repeat(paddingNeeded);
  }

  return Buffer.from(jsonStr + "\n");
}

// Reads exactly one record block using a precise byte offset
export function readRecordAt(fd: number, offset: number): LessonRecord | null {
  const buffer = Buffer.alloc(LINE_RECORD);
  fs.readSync(fd, buffer, 0, LINE_RECORD, offset);

  try {
    return JSON.parse(buffer.toString("utf8")) as LessonRecord;
  } catch {
    return null;
  }
}

// Overwrites data at a specific byte offset
export function writeRecordAt(fd: number, offset: number, lesson: LessonRecord): void {
  const buffer = processRecordBuffer(lesson);
  fs.writeSync(fd, buffer, 0, LINE_RECORD, offset);
}

// Formula to translate record positions directly to raw file locations
export function byteOffset(id: number): number {
  return (id - 1) * LINE_RECORD;
}

// Scans file metadata to determine the total slots available
export function getNextId(): number {
  if (!fs.existsSync(FILE_PATH)) return 1;
  const size = fs.statSync(FILE_PATH).size;
  return Math.floor(size / LINE_RECORD) + 1;
}