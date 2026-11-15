import type { SourceFileDoc, SourceLanguage } from "@/types/firestore";

/** The in-memory shape the editor, Sandpack and the patchers all share. */
export interface VfsFile {
  filePath: string;
  language: SourceLanguage;
  content: string;
  sha256: string;
  byteSize: number;
  exportSignatures: string[];
  imports: string[];
  updatedAt: string;
  dirty: boolean;
}

export type VfsMap = Record<string, VfsFile>;

export function toVfsFile(doc: SourceFileDoc): VfsFile {
  return {
    filePath: doc.filePath,
    language: doc.language,
    content: doc.content,
    sha256: doc.sha256,
    byteSize: doc.byteSize,
    exportSignatures: doc.exportSignatures,
    imports: doc.imports,
    updatedAt: doc.updatedAt,
    dirty: false,
  };
}
