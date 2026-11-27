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
  const events = await db
    .collectionGroup("notificationQueue")
    .where("state", "==", "pending")
    .get();

  for (const event of events.docs) {
    try {
      await sendNotificationEvent(event);
    } catch (error) {
      console.error(`Notification event ${event.id} failed:`, error);
    }
  }
}

export async function cleanupCompletedNotificationEvents() {
  const events = await db
    .collectionGroup("notificationQueue")
    .where("completed", "==", true)
    .get();
  let deletedCount = 0;

  for (const completedEvent of events.docs) {
    if (completedEvent.data().completed !== true) continue;

    const userRef = completedEvent.ref.parent.parent;
    const trackingNumber = completedEvent.data().trackingNumber;
    if (!userRef || !trackingNumber) {
      console.error(
        `Cannot clean completed notification event: ${completedEvent.ref.path}`,
      );
      continue;
    }

    const trackingEvents = await userRef
      .collection("notificationQueue")
      .where("trackingNumber", "==", trackingNumber)
      .get();
    if (trackingEvents.docs.some((event) => event.data().state === "pending")) {
      continue;
    }

    for (let offset = 0; offset < trackingEvents.docs.length; offset += 500) {
      const batch = db.batch();
      trackingEvents.docs
        .slice(offset, offset + 500)
        .forEach((event) => batch.delete(event.ref));
      await batch.commit();
      deletedCount += Math.min(500, trackingEvents.docs.length - offset);
    }
  }

  console.log(`Completed notification events deleted: ${deletedCount}`);
  return deletedCount;
}

export async function sendTestNotifications() {
  const tokenSnapshot = await db.collectionGroup("fcmTokens").get();
  const tokens = [
    ...new Set(
      tokenSnapshot.docs
        .map((tokenDoc) => tokenDoc.data().token || tokenDoc.id)
        .filter(Boolean),
    ),
  ];

  if (tokens.length === 0) {
    console.error("No registered FCM tokens; no test notifications sent.");
    return { devices: 0, success: 0, failure: 0, errors: 0 };
  }

  let success = 0;
  let failure = 0;
  let errors = 0;

  for (let offset = 0; offset < tokens.length; offset += 500) {
    const batchTokens = tokens.slice(offset, offset + 500);
    try {
      const response = await messaging.sendEachForMulticast({
        tokens: batchTokens,
        notification: {
          title: "Space Tool - Thông báo thử",
          body: "Thông báo push hoạt động bình thường.",
        },
        data: {
          type: "TEST_NOTIFICATION",
        },
      });
      success += response.successCount;
      failure += response.failureCount;
      errors += response.failureCount;

      response.responses.forEach((result, index) => {
        if (!result.success) {
          console.error(
            `Test notification failed for token ${index + 1} in batch:`,
            result.error?.code || result.error?.message,
          );
        }
      });
    } catch (error) {
      errors += batchTokens.length;
      console.error("Test FCM batch failed:", error);
    }
  }

  return {
    devices: tokens.length,
    success,
    failure,
    errors,
  };
}

async function sendNotificationEvent(event) {
  const eventData = event.data();
  const userRef = event.ref.parent.parent;
  if (!userRef) {
    console.error(`Notification event has no user parent: ${event.ref.path}`);
    return;
  }

  let pendingTokens = eventData.pendingTokens;
  let tokenDocuments = null;
  if (!Array.isArray(pendingTokens)) {
    const tokenSnapshot = await userRef.collection("fcmTokens").get();
    tokenDocuments = tokenSnapshot.docs;
    pendingTokens = tokenSnapshot.docs
      .map((tokenDoc) => tokenDoc.data().token || tokenDoc.id)
      .filter(Boolean);

    if (pendingTokens.length === 0) {
      await event.ref.update({
        state: "no_tokens",
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(
        `No FCM tokens for user ${userRef.id}; event ${event.id} skipped`,
      );
      return;
    }

    await event.ref.update({
      pendingTokens,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  if (!tokenDocuments) {
    const tokenSnapshot = await userRef.collection("fcmTokens").get();
    tokenDocuments = tokenSnapshot.docs;
  }
  const tokenDocumentByValue = new Map(
    tokenDocuments.map((tokenDoc) => [
      tokenDoc.data().token || tokenDoc.id,
      tokenDoc,
    ]),
  );

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
        await tokenDocumentByValue.get(token)?.ref.delete();
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
