#!/usr/bin/env node
/* 把 index.html 引用的 CSS 和经典脚本按顺序内联，输出 dist/sensor-craft.html。无第三方依赖。 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const sourcePath = resolve(root, 'index.html');
const outputPath = resolve(root, 'dist/sensor-craft.html');

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

function inlineCss(html) {
  return html.replace(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/g, (match, href) => {
    const cssPath = href.replace(/^\.\//, '');
    const css = read(cssPath);
    return `<style>\n/* ${href} */\n${css}\n</style>`;
  });
}

function inlineJs(html) {
  return html.replace(/<script\s+defer\s+src="([^"]+)"><\/script>/g, (match, src) => {
    const jsPath = src.replace(/^\.\//, '');
    const js = read(jsPath);
    return `<script>\n/* ${src} */\n${js}\n</script>`;
  });
}

const source = readFileSync(sourcePath, 'utf8');
const bundled = inlineJs(inlineCss(source));

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, bundled, 'utf8');

const size = statSync(outputPath).size;
console.log(`built ${outputPath} (${(size / 1024).toFixed(1)} KB)`);
