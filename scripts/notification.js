import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { db, messaging } from "./firebase-admin.js";

const INVALID_TOKEN_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

export function getStatusEventId(trackingNumber, status) {
  const fingerprint = [
    trackingNumber,
    status.statusCode,
    status.status,
    status.timestamp,
  ].join("\n");
  return createHash("sha256").update(fingerprint).digest("hex");
}

export async function sendPendingNotifications() {
  const events = await db.collectionGroup("notificationQueue").get();

  for (const event of events.docs) {
    if (event.data().state !== "pending") continue;

    try {
      await sendNotificationEvent(event);
    } catch (error) {
      console.error(`Notification event ${event.id} failed:`, error);
    }
  }
}

async function sendNotificationEvent(event) {
  const eventData = event.data();
  const userRef = event.ref.parent.parent;
  if (!userRef) {
    console.error(`Notification event has no user parent: ${event.ref.path}`);
    return;
  }

  let pendingTokens = eventData.pendingTokens;
  if (!Array.isArray(pendingTokens)) {
    const tokenSnapshot = await userRef.collection("fcmTokens").get();
    pendingTokens = tokenSnapshot.docs
      .map((tokenDoc) => tokenDoc.data().token || tokenDoc.id)
      .filter(Boolean);

    if (pendingTokens.length === 0) {
      await event.ref.update({
        state: "no_tokens",
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`No FCM tokens for user ${userRef.id}; event ${event.id} skipped`);
      return;
    }

    await event.ref.update({
      pendingTokens,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  const tokensToProcess = pendingTokens;
  const pendingTokenSet = new Set(pendingTokens);
  for (let offset = 0; offset < tokensToProcess.length; offset += 500) {
    const batchTokens = tokensToProcess.slice(offset, offset + 500);
    const response = await messaging.sendEachForMulticast({
      tokens: batchTokens,
      notification: {
        title: "SPX - Cập nhật đơn hàng",
        body: `${eventData.nickname ? `${eventData.nickname} (${eventData.trackingNumber})` : eventData.trackingNumber}: ${eventData.status}`,
      },
      data: {
        trackingNumber: eventData.trackingNumber,
        userId: userRef.id,
        type: "SPX_STATUS_UPDATE",
      },
      webpush: {
        notification: {
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: `spx-${eventData.trackingNumber}`,
        },
      },
    });

    for (let index = 0; index < response.responses.length; index += 1) {
      const result = response.responses[index];
      const token = batchTokens[index];
      if (result.success || INVALID_TOKEN_CODES.has(result.error?.code)) {
        pendingTokenSet.delete(token);
      }
      if (!result.success && INVALID_TOKEN_CODES.has(result.error?.code)) {
        await userRef.collection("fcmTokens").doc(token).delete();
        console.log(`Removed invalid FCM token for user ${userRef.id}`);
      } else if (!result.success) {
        console.error(
          `FCM delivery failed for user ${userRef.id}:`,
          result.error?.code || result.error?.message,
        );
      }
    }

    pendingTokens = [...pendingTokenSet];
    await event.ref.update({
      pendingTokens,
      state: pendingTokens.length === 0 ? "sent" : "pending",
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  console.log(
    `Notification event ${event.id}: ${pendingTokens.length === 0 ? "sent" : "pending retry"}`,
  );
}
