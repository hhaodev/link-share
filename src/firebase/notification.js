import { deleteToken, getToken } from "firebase/messaging";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { db, firebaseConfig, getFirebaseMessaging } from "./index.js";

const DEVICE_ID_KEY = "link-share:notification-device-id";
let tokenOperationQueue = Promise.resolve();

function runTokenOperation(operation) {
  const result = tokenOperationQueue.then(operation);
  tokenOperationQueue = result.catch(() => {});
  return result;
}

export function getNotificationDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

function waitForServiceWorkerActivation(registration) {
  const worker =
    registration.active || registration.installing || registration.waiting;

  if (!worker) {
    throw new Error("Không tìm thấy Service Worker để bật thông báo");
  }
  if (worker.state === "activated") return Promise.resolve();
  if (worker.state === "redundant") {
    throw new Error("Service Worker không thể được kích hoạt");
  }

  return new Promise((resolve, reject) => {
    function handleStateChange() {
      if (worker.state === "activated") {
        worker.removeEventListener("statechange", handleStateChange);
        resolve();
      } else if (worker.state === "redundant") {
        worker.removeEventListener("statechange", handleStateChange);
        reject(new Error("Service Worker không thể được kích hoạt"));
      }
    }

    worker.addEventListener("statechange", handleStateChange);
    handleStateChange();
  });
}

async function getMessagingServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Trình duyệt không hỗ trợ Service Worker");
  }

  const serviceWorkerUrl = new URL(
    "/firebase-messaging-sw.js",
    window.location.origin,
  );
  Object.entries(firebaseConfig).forEach(([key, value]) => {
    if (value) serviceWorkerUrl.searchParams.set(key, value);
  });
  const registration = await navigator.serviceWorker.register(
    serviceWorkerUrl.toString(),
  );
  await waitForServiceWorkerActivation(registration);
  return registration;
}

async function saveDeviceToken(userId, token, deviceId) {
  const tokenCollection = collection(db, "users", userId, "fcmTokens");
  const existingTokens = await getDocs(
    query(tokenCollection, where("deviceId", "==", deviceId)),
  );
  const batch = writeBatch(db);

  batch.set(
    doc(tokenCollection, token),
    {
      token,
      deviceId,
      platform: navigator.userAgent,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  existingTokens.docs.forEach((tokenDocument) => {
    if (tokenDocument.id !== token) batch.delete(tokenDocument.ref);
  });
  await batch.commit();
}

async function getCurrentToken() {
  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    throw new Error("Firebase Messaging không được hỗ trợ");
  }

  const registration = await getMessagingServiceWorkerRegistration();
  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error("Không lấy được FCM Token");
  return { messaging, token };
}

export function enableNotification(userId) {
  return runTokenOperation(async () => {
    if (!("Notification" in window)) {
      throw new Error("Trình duyệt không hỗ trợ Notification");
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("Bạn chưa cấp quyền thông báo");
    }

    const { token } = await getCurrentToken();
    await saveDeviceToken(userId, token, getNotificationDeviceId());
    return token;
  });
}

export function syncNotificationToken(userId) {
  return runTokenOperation(async () => {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return false;
    }

    const deviceId = getNotificationDeviceId();
    const tokenCollection = collection(db, "users", userId, "fcmTokens");
    const existingTokens = await getDocs(
      query(tokenCollection, where("deviceId", "==", deviceId)),
    );
    const legacyTokens = existingTokens.empty
      ? await getDocs(
          query(tokenCollection, where("platform", "==", navigator.userAgent)),
        )
      : null;
    if (existingTokens.empty && legacyTokens.empty) return false;

    const { messaging, token } = await getCurrentToken();
    if (
      existingTokens.empty &&
      !legacyTokens.docs.some((tokenDocument) => tokenDocument.id === token)
    ) {
      await deleteToken(messaging);
      return false;
    }
    await saveDeviceToken(userId, token, deviceId);
    return true;
  });
}

export function disableNotification(userId) {
  return runTokenOperation(async () => {
    const deviceId = getNotificationDeviceId();
    const tokenCollection = collection(db, "users", userId, "fcmTokens");
    const existingTokens = await getDocs(
      query(tokenCollection, where("deviceId", "==", deviceId)),
    );
    const legacyTokens = await getDocs(
      query(tokenCollection, where("platform", "==", navigator.userAgent)),
    );
    if (existingTokens.empty && legacyTokens.empty) return true;

    let current;
    let tokenRevoked = true;
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        current = await getCurrentToken();
      } catch (error) {
        console.error("Failed to get the local FCM token:", error);
        tokenRevoked = false;
      }
    }

    const batch = writeBatch(db);
    existingTokens.docs.forEach((tokenDocument) => {
      batch.delete(tokenDocument.ref);
    });
    if (
      current &&
      legacyTokens.docs.some(
        (tokenDocument) => tokenDocument.id === current.token,
      )
    ) {
      batch.delete(doc(tokenCollection, current.token));
    }
    await batch.commit();

    if (!current) return tokenRevoked;

    try {
      return await deleteToken(current.messaging);
    } catch (error) {
      console.error("Failed to revoke the local FCM token:", error);
      return false;
    }
  });
}
