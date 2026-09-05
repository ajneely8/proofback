// Minimal service worker — its only real job is to exist and be registered,
// which (alongside the manifest) is what makes Chrome/Android offer
// "Add to Home Screen" as an actual app install rather than just a
// bookmark. It doesn't cache anything or work offline; every request just
// passes straight through to the network.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // Intentionally not calling event.respondWith — letting the browser
  // handle every request normally.
})
