/* Service worker de la agenda: guarda las dos páginas (ya cifradas) para abrirlas sin conexión.
   Red primero (4 s) para recibir actualizaciones; si no hay red, copia guardada. */
const CACHE = "agenda-v1";
const SHELL = ["./", "index.html", "semana.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/sw.js")) return;
  e.respondWith(networkFirst(req, e));
});

async function networkFirst(req, e) {
  const cache = await caches.open(CACHE);
  const net = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; });
  net.catch(() => {});
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000));
  try {
    return await Promise.race([net, timeout]);
  } catch (err) {
    const hit = (await cache.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? await cache.match("index.html") : undefined);
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  }
}
