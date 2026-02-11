/**
 * SVGファビコンからElectron用アイコン(PNG/ICO)を生成するスクリプト
 * Usage: node scripts/generate-icons.mjs
 * 前提: npm install -D playwright-core (一時的)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SVG_PATH = path.join(ROOT, 'apps', 'web', 'public', 'favicon.svg');
const OUTPUT_DIR = path.join(ROOT, 'apps', 'desktop', 'build');

// ICO file format writer (multi-size)
function createIco(pngBuffers, sizes) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let dataOffset = headerSize + dirEntrySize * count;

  const parts = [];
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  parts.push(header);

  for (let i = 0; i < count; i++) {
    const entry = Buffer.alloc(dirEntrySize);
    const sz = sizes[i];
    entry.writeUInt8(sz === 256 ? 0 : sz, 0);
    entry.writeUInt8(sz === 256 ? 0 : sz, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(pngBuffers[i].length, 8);
    entry.writeUInt32LE(dataOffset, 12);
    parts.push(entry);
    dataOffset += pngBuffers[i].length;
  }

  for (const buf of pngBuffers) {
    parts.push(buf);
  }

  return Buffer.concat(parts);
}

async function main() {
  // Dynamic import to handle npx-installed playwright-core
  const { chromium } = await import('playwright-core');

  const svgContent = fs.readFileSync(SVG_PATH, 'utf-8');
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;

  const sizes = [256, 64, 48, 32, 16];
  const pngBuffers = [];

  for (const size of sizes) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!DOCTYPE html><html><head><style>*{margin:0;padding:0}body{width:${size}px;height:${size}px;overflow:hidden}img{width:${size}px;height:${size}px}</style></head><body><img src="${svgDataUrl}"/></body></html>`);
    await page.waitForLoadState('networkidle');

    const buf = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: size, height: size },
      omitBackground: true
    });
    pngBuffers.push(buf);

    if (size === 256) {
      fs.writeFileSync(path.join(OUTPUT_DIR, 'icon.png'), buf);
      console.log(`Created icon.png (${size}x${size})`);
    }
  }

  // Create ICO
  const icoBuffer = createIco(pngBuffers, sizes);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'icon.ico'), icoBuffer);
  console.log('Created icon.ico (sizes: ' + sizes.join(', ') + ')');

  // 512px for high-DPI
  await page.setViewportSize({ width: 512, height: 512 });
  await page.setContent(`<!DOCTYPE html><html><head><style>*{margin:0;padding:0}body{width:512px;height:512px;overflow:hidden}img{width:512px;height:512px}</style></head><body><img src="${svgDataUrl}"/></body></html>`);
  await page.waitForLoadState('networkidle');
  const png512 = await page.screenshot({
    type: 'png',
    clip: { x: 0, y: 0, width: 512, height: 512 },
    omitBackground: true
  });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'icon-512.png'), png512);
  console.log('Created icon-512.png (512x512)');

  await browser.close();
  console.log('\nAll icons generated in:', OUTPUT_DIR);
}

main().catch(console.error);
