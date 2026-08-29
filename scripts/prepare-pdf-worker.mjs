import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const source = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
const output = resolve(process.cwd(), 'public/pdf.worker.min.mjs');

await mkdir(dirname(output), { recursive: true });
await copyFile(source, output);
