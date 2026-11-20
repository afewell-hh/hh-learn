/**
 * confined-read.mjs — read a file named by authored data, but only if its *canonical* path is inside
 * the module directory. A lexical check ("no ../") is not enough: a symlink inside the module can
 * point anywhere, and following it would embed an outside file in the payload.
 *
 * Throws an Error whose `.code` is:
 *   'ESCAPE'  the path (or the real path after resolving symlinks) is outside the module directory
 *   'MISSING' the file does not exist (or is a dangling symlink)
 *   'NOTFILE' the target is not a regular file
 */
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';

function inside(root, target) {
  const rel = relative(root, target);
  return rel !== '' && rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel);
}

function fail(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

export async function readConfined(moduleDir, src) {
  if (typeof src !== 'string' || !src) throw fail('MISSING', 'no path given');
  if (src.includes('\0')) throw fail('ESCAPE', `src "${src}" contains a NUL byte`);
  const root = await realpath(resolve(moduleDir));
  const lexical = resolve(root, src);
  if (!inside(root, lexical)) throw fail('ESCAPE', `src "${src}" must stay inside the module directory`);
  let real;
  try { real = await realpath(lexical); }
  catch { throw fail('MISSING', `src "${src}" not found`); }
  if (!inside(root, real)) throw fail('ESCAPE', `src "${src}" resolves outside the module directory (symlink?)`);
  const st = await stat(real);
  if (!st.isFile()) throw fail('NOTFILE', `src "${src}" is not a regular file`);
  return readFile(real, 'utf-8');
}
