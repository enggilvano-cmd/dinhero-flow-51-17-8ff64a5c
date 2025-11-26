// Service Worker for Push Notifications
// This file handles push notifications when the app is closed

// Workbox manifest injection point - DO NOT REMOVE
self.__WB_MANIFEST;

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(clients.claim());
});

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let notificationData = {
    title: 'PlaniFlow',
    body: 'Você tem uma nova notificação',
    icon: '/icon-192.png',
    badge: '/favicon.png',
    tag: 'planiflow-notification',
    requireInteraction: false,
    data: {}
  };

  try {
    if (event.data) {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data,
        data: data.data || {}
      };
    }
  } catch (error) {
    console.error('Error parsing push notification data:', error);
  }

  const promiseChain = self.registration.showNotification(
    notificationData.title,
    {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      vibrate: [200, 100, 200],
      actions: notificationData.actions || []
    }
  );

  event.waitUntil(promiseChain);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  const promiseChain = clients
    .matchAll({
      type: 'window',
      includeUncontrolled: true
    })
    .then((windowClients) => {
      // Check if there's already a window open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    });

  event.waitUntil(promiseChain);
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
});
