importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
const raw = params.get("config");
const cfg = raw ? JSON.parse(decodeURIComponent(raw)) : null;

if (cfg) {
  firebase.initializeApp(cfg);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const n = payload.notification || {};
    const title = n.title || "LifePet";
    const data = payload.data || {};
    const actions = data.doneUrl
      ? [
          { action: "done", title: "Segna fatto" },
          { action: "open", title: "Apri" },
        ]
      : [];
    const options = {
      body: n.body || "",
      data,
      actions,
    };
    self.registration.showNotification(title, options);
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification?.data || {};
  const url = event.action === "done" && data.doneUrl
    ? String(data.doneUrl)
    : (data.url ? String(data.url) : "/app/dashboard");
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for (const c of clientsArr) {
        if ("navigate" in c) {
          return c.navigate(url).then(() => ("focus" in c ? c.focus() : undefined));
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
