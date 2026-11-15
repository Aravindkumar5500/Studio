"use client";

import JSZip from "jszip";
import { mergeWithBoilerplate, slugifyPackageName } from "./boilerplate";

/** Builds the full runnable project and triggers a browser download. */
export async function downloadProjectZip(params: {
  projectName: string;
  description?: string;
  files: Record<string, string>;
}): Promise<{ fileName: string; fileCount: number }> {
  const merged = mergeWithBoilerplate(params.files, {
    projectName: params.projectName,
    description: params.description,
  });

  const zip = new JSZip();
  for (const [path, content] of Object.entries(merged)) {
    zip.file(path, content);
  }

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const fileName = `${slugifyPackageName(params.projectName)}.zip`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  return { fileName, fileCount: Object.keys(merged).length };
}
