// Convert the dist/index.html from vite build into a page for an Artifact (without doctype/html/head/body), writing dist/eldor.html.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const html = readFileSync('dist/index.html', 'utf8');
const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g)].map((m) => m[1].replace(/^\.\//, ''));
const css = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="(\.\/assets\/[^"]+)"[^>]*>/g)].map((m) => m[1].replace(/^\.\//, ''));
const preloads = [...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"[^>]*>/g)].map((m) => m[1].replace(/^\.\//, ''));
const out = `<title>艾爾多 Eldor</title>
<meta name="theme-color" content="#0b0a18">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&family=Noto+Serif+TC:wght@700;900&display=swap" rel="stylesheet">
${css.map((c) => `<style>${readFileSync('dist/' + c, 'utf8')}</style>`).join('\n')}
<style>:root{padding:0!important;background:#0b0a18;color-scheme:dark}body{background:#0b0a18;font-family:'Noto Sans TC',system-ui,sans-serif}</style>
<div id="app"><div class="boot-loading" style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:radial-gradient(circle at 50% 40%,#2a1a5a,#0b0a18 70%);color:#ffd978;font-family:'Noto Serif TC',serif;z-index:10"><div style="font-size:44px;font-weight:900;letter-spacing:12px;text-shadow:0 0 24px rgba(255,190,80,.7)">艾爾多</div><div style="font-size:13px;letter-spacing:6px;color:#d8c8ff;animation:bootPulse 1.2s ease-in-out infinite">星門開啟中…</div><style>@keyframes bootPulse{50%{opacity:.35}}</style></div></div>
${preloads.map((p) => `<link rel="modulepreload" href="${p}">`).join('\n')}
${scripts.map((s) => `<script type="module" src="${s}"></script>`).join('\n')}
`;
writeFileSync('dist/eldor.html', out);
console.log('scripts', scripts, 'css', css, 'assets', readdirSync('dist/assets'));
