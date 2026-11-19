/* Heureux Qui Communique : garde l'application sur le téléphone pour qu'elle marche sans internet. */
const VERSION = 'qcep-v4';
const FILES = [
  "./",
  "app.css",
  "comm.js",
  "core.js",
  "games.js",
  "index.html",
  "learn.js",
  "main.js",
  "manifest.webmanifest",
  "fonts/atkinson-hyperlegible-latin-400-normal.woff2",
  "fonts/atkinson-hyperlegible-latin-700-normal.woff2",
  "icons/apple-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "images/boire.jpg",
  "images/change.jpg",
  "images/cour.jpg",
  "images/logo.jpg",
  "images/manger.jpg",
  "images/repos.jpg",
  "images/toilettes.jpg",
  "mediapipe/face_mesh.binarypb",
  "mediapipe/face_mesh.js",
  "mediapipe/face_mesh_solution_packed_assets.data",
  "mediapipe/face_mesh_solution_packed_assets_loader.js",
  "mediapipe/face_mesh_solution_simd_wasm_bin.js",
  "mediapipe/face_mesh_solution_simd_wasm_bin.wasm",
  "mediapipe/face_mesh_solution_wasm_bin.js",
  "mediapipe/face_mesh_solution_wasm_bin.wasm"
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, {ignoreSearch: true}).then(r => r || fetch(e.request)));
});
