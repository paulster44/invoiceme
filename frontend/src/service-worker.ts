/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute, setDefaultHandler } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any };

clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);

const apiBgSync = new BackgroundSyncPlugin('sync-api-writes', {
  maxRetentionTime: 24 * 60
});

registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api') && request.method === 'GET',
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5
  })
);

(['POST', 'PUT', 'DELETE'] as const).forEach((method) => {
  registerRoute(
    ({ url, request }) => url.pathname.startsWith('/api') && request.method === method,
    new NetworkFirst({
      cacheName: 'api-write-cache',
      networkTimeoutSeconds: 10,
      plugins: [apiBgSync]
    }),
    method
  );
});

setDefaultHandler(new StaleWhileRevalidate());
