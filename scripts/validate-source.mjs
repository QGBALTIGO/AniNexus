import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { HtmlValidate } from 'html-validate';
import * as csstree from 'css-tree';
import { ACTIVE_PREVIEW_DIRS } from './repository-layout.mjs';

const root = process.cwd();
const htmlPath = path.join(root, 'index.html');
const html = await fs.readFile(htmlPath, 'utf8');
const validator = new HtmlValidate({
  rules: {
    'close-order': 'error',
    'element-permitted-content': 'error',
    'no-dup-id': 'error',
    'no-inline-style': 'off',
    'valid-id': 'error',
  },
});
const report = await validator.validateString(html, 'index.html');
if (!report.valid) {
  const messages = report.results.flatMap(result => result.messages.map(message =>
    `${result.filePath}:${message.line}:${message.column} ${message.ruleId}: ${message.message}`));
  throw new Error(`HTML inválido:\n${messages.join('\n')}`);
}

if (/\son(?:click|change|submit|load|error)\s*=/i.test(html)) {
  throw new Error('A shell contém manipuladores inline incompatíveis com a CSP');
}

const cssFiles = [];
const scriptFiles = [];
for (const directory of ACTIVE_PREVIEW_DIRS) {
  const absolute = path.join(root, directory);
  for (const file of await fs.readdir(absolute)) {
    if (file.endsWith('.css')) cssFiles.push(path.join(absolute, file));
    if (file.endsWith('.js')) scriptFiles.push(path.join(absolute, file));
  }
}
for (const file of cssFiles) {
  const source = await fs.readFile(file, 'utf8');
  try { csstree.parse(source, { filename: file, positions: true }); }
  catch (error) { throw new Error(`CSS inválido em ${path.relative(root, file)}: ${error.message}`); }
}

for (const file of scriptFiles) {
  const source = await fs.readFile(file, 'utf8');
  try { new vm.Script(source, { filename: path.relative(root, file) }); }
  catch (error) { throw new Error(`JavaScript inválido em ${path.relative(root, file)}: ${error.message}`); }
}

console.log(`[validate-source] HTML semântico, ${cssFiles.length} CSS e ${scriptFiles.length} scripts válidos`);
