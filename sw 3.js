/* Service worker Pengaturan: buka instan, tetap jalan offline, hemat data */
const CACHE = 'pengaturan-v9';
const SHELL = ['./', './index.html'];
const CEK_MS = 6 * 60 * 60 * 1000;   // cek versi baru paling sering tiap 6 jam
const CEK_KEY = './__cek';           // penanda waktu cek terakhir (di dalam cache)

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function perluCek(c) {
  const r = await c.match(CEK_KEY);
  if (!r) return true;
  const t = Number(await r.text());
  return !(t > 0) || Date.now() - t > CEK_MS;
}

/* Cek ringan: permintaan bersyarat (ETag). Kalau tidak ada perubahan, server
   membalas 304 yang hanya beberapa ratus byte, bukan mengunduh ulang file. */
async function segarkan(c, target) {
  try {
    const r = await fetch(target, { cache: 'no-cache' });
    if (r && r.ok) {
      await c.put(target, r.clone());
      await c.put(CEK_KEY, new Response(String(Date.now())));
    }
  } catch (_) { /* offline atau sinyal buruk: abaikan, cache tetap dipakai */ }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const nav = req.mode === 'navigate';
  const key = nav ? './index.html' : req;
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(key, { ignoreSearch: true });
      if (hit) {
        if (await perluCek(c)) e.waitUntil(segarkan(c, nav ? './index.html' : req));
        return hit;                       // selalu langsung dari cache, tanpa menunggu jaringan
      }
      try {                               // belum ada di cache: ambil dari jaringan sekali
        const r = await fetch(req);
        if (r && r.ok) c.put(key, r.clone());
        return r;
      } catch (_) {
        return (await c.match('./index.html')) || Response.error();
      }
    })
  );
});
