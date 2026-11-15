import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { COLLECTIONS, MAX_FILE_BYTES, type SourceFileDoc } from "@/types/firestore";
import { normalizePath, sha256Sync, sourceFileDocId } from "@/lib/hash";
import { byteSize, nowIso } from "@/lib/utils";
import { detectLanguage, extractExportSignatures, extractImports } from "./analyze";
import type { VfsFile, VfsMap } from "./types";
import { toVfsFile } from "./types";

export class FileTooLargeError extends Error {
  constructor(filePath: string, size: number) {
    super(
      `"${filePath}" is ${size} bytes; the per-document limit is ${MAX_FILE_BYTES} bytes. Split the file.`,
    );
    this.name = "FileTooLargeError";
  }
}

/** Builds a fully analysed VFS record from raw text. */
export function makeVfsFile(filePath: string, content: string): VfsFile {
  const path = normalizePath(filePath);
  const size = byteSize(content);
  if (size > MAX_FILE_BYTES) throw new FileTooLargeError(path, size);
  return {
    filePath: path,
    language: detectLanguage(path),
    content,
    sha256: sha256Sync(content),
    byteSize: size,
    exportSignatures: extractExportSignatures(content),
    imports: extractImports(content),
    updatedAt: nowIso(),
    dirty: true,
  };
}

export function toSourceFileDoc(
  projectId: string,
  file: VfsFile,
  userId: string,
): SourceFileDoc {
  return {
    id: sourceFileDocId(projectId, file.filePath),
    projectId,
    filePath: file.filePath,
    language: file.language,
    content: file.content,
    sha256: file.sha256,
    byteSize: file.byteSize,
    exportSignatures: file.exportSignatures,
    imports: file.imports,
    lastModifiedBy: userId,
    createdAt: file.updatedAt,
    updatedAt: nowIso(),
  };
}

/** Loads every source file for a project — one document per file. */
export async function loadProjectFiles(
  db: Firestore,
  projectId: string,
): Promise<VfsMap> {
  const q = query(
    collection(db, COLLECTIONS.sourceFiles),
    where("projectId", "==", projectId),
  );
  const snap = await getDocs(q);
  const map: VfsMap = {};
  snap.forEach((d) => {
    const data = d.data() as SourceFileDoc;
    map[normalizePath(data.filePath)] = toVfsFile(data);
  });
  return map;
}

export async function persistFile(
  db: Firestore,
  projectId: string,
  file: VfsFile,
  userId: string,
): Promise<void> {
  const payload = toSourceFileDoc(projectId, file, userId);
  await setDoc(doc(db, COLLECTIONS.sourceFiles, payload.id), payload, { merge: true });
}

/** Writes many files in chunked batches (Firestore caps a batch at 500 ops). */
export async function persistFiles(
  db: Firestore,
  projectId: string,
  files: VfsFile[],
  userId: string,
): Promise<void> {
  for (let i = 0; i < files.length; i += 400) {
    const batch = writeBatch(db);
    for (const file of files.slice(i, i + 400)) {
      const payload = toSourceFileDoc(projectId, file, userId);
      batch.set(doc(db, COLLECTIONS.sourceFiles, payload.id), payload, { merge: true });
    }
    await batch.commit();
  }
}

export async function deleteFile(
  db: Firestore,
  projectId: string,
  filePath: string,
): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.sourceFiles, sourceFileDocId(projectId, filePath)));
}
