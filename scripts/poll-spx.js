import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase-admin.js";
import { getSPXTracking } from "./spx-api.js";
import {
  getStatusEventId,
  sendPendingNotifications,
  sendTestNotifications,
} from "./notification.js";

function hasPreviousStatus(data) {
  return Boolean(
    data.lastStatus ||
    data.lastStatusCode ||
    data.lastCheckpointTime ||
    data.lastStatusAt,
  );
}

function normalizeTimestamp(value) {
  if (value?.toDate) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value == null ? "" : String(value);
}

function isCompletedStatus(status) {
  const value =
    `${status.status || ""} ${status.statusCode || ""}`.toLowerCase();

  return (
    value.includes("giao hàng thành công") ||
    value.includes("giao thành công") ||
    /\bdelivered\b/.test(value) ||
    value.includes("hoàn hàng thành công") ||
    value.includes("chuyển hoàn thành công") ||
    /\b(returned|return completed)\b/.test(value) ||
    value.includes("đã hủy") ||
    value.includes("đơn hàng đã hủy") ||
    /\b(cancelled|canceled)\b/.test(value)
  );
}

async function updateTrackingStatus(watchRef, userRef, trackingNumber, latest) {
  const settingsSnapshot = isCompletedStatus(latest)
    ? await userRef.collection("accountSettings").doc("tracking").get()
    : null;
  const deleteWhenDone = settingsSnapshot?.get("deleteWhenDone") !== false;
  const statusRef = userRef
    .collection("notificationQueue")
    .doc(getStatusEventId(trackingNumber, latest));

  return db.runTransaction(async (transaction) => {
    const watchSnapshot = await transaction.get(watchRef);
    if (!watchSnapshot.exists) return "removed";

    const current = watchSnapshot.data();
    const hadPreviousStatus = hasPreviousStatus(current);
    const changed =
      current.lastStatus !== latest.status ||
      String(current.lastStatusCode ?? "") !== String(latest.statusCode ?? "") ||
      normalizeTimestamp(current.lastCheckpointTime ?? current.lastStatusAt) !==
        normalizeTimestamp(latest.timestamp);
    const completed = isCompletedStatus(latest);
    const shouldNotify = changed && hadPreviousStatus;
    const needsBaseline =
      !current.lastStatusCode ||
      current.lastCheckpointTime === undefined ||
      current.lastStatusAt === undefined;

    if (!completed && !changed && !needsBaseline) return "unchanged";

    const statusSnapshot =
      shouldNotify || completed ? await transaction.get(statusRef) : null;

    if (completed) {
      if (statusSnapshot.exists) {
        transaction.update(statusRef, {
          completed: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        transaction.create(statusRef, {
          trackingNumber,
          nickname: current.nickname || "",
          status: latest.status,
          statusCode: latest.statusCode,
          timestamp: latest.timestamp,
          state: shouldNotify ? "pending" : "completed",
          completed: true,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      if (deleteWhenDone) {
        transaction.delete(watchRef);
      } else {
        transaction.update(watchRef, {
          lastStatus: latest.status,
          lastStatusCode: latest.statusCode,
          lastCheckpointTime: latest.timestamp,
          lastStatusAt: latest.timestamp,
          completed: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return "completed";
    }

    transaction.update(watchRef, {
      lastStatus: latest.status,
      lastStatusCode: latest.statusCode,
      lastCheckpointTime: latest.timestamp,
      lastStatusAt: latest.timestamp,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (shouldNotify && !statusSnapshot.exists) {
      transaction.create(statusRef, {
        trackingNumber,
        nickname: current.nickname || "",
        status: latest.status,
        statusCode: latest.statusCode,
        timestamp: latest.timestamp,
        state: "pending",
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return changed && hadPreviousStatus ? "changed" : "initialized";
  });
}

async function pollSPX() {
  console.log("========== SPX POLLING START ==========");

  if (process.env.TEST_NOTIFICATION === "true") {
    const summary = await sendTestNotifications();
    console.log("========== SPX TEST NOTIFICATION SUMMARY ==========");
    console.log(JSON.stringify(summary, null, 2));
    if (summary.errors > 0 || summary.success === 0) process.exitCode = 1;
    return;
  }

  const snapshot = await db.collectionGroup("watchlist").get();
  console.log(`Packages to check: ${snapshot.size}`);

  const summary = {
    changed: 0,
    completed: 0,
    initialized: 0,
    unchanged: 0,
    removed: 0,
    errors: 0,
  };
  const watchDocs = snapshot.docs;
  const concurrency = 5;

  for (let offset = 0; offset < watchDocs.length; offset += concurrency) {
    const batch = watchDocs.slice(offset, offset + concurrency);
    await Promise.all(
      batch.map(async (watchDoc) => {
        const userRef = watchDoc.ref.parent.parent;
        const data = watchDoc.data();
        const trackingNumber = data.trackingNumber || watchDoc.id;

        if (!userRef || !trackingNumber) {
          console.error(`Invalid watchlist document: ${watchDoc.ref.path}`);
          summary.errors += 1;
          return;
        }

        try {
          if (data.completed === true) {
            const settingsSnapshot = await userRef
              .collection("accountSettings")
              .doc("tracking")
              .get();
            const deleteWhenDone =
              settingsSnapshot.get("deleteWhenDone") !== false;
            if (deleteWhenDone) {
              await watchDoc.ref.delete();
              summary.removed += 1;
            } else {
              summary.completed += 1;
            }
            return;
          }

          const latest = await getSPXTracking(trackingNumber);
          if (!latest) {
            console.log(`No tracking events yet: ${trackingNumber}`);
            summary.unchanged += 1;
            return;
          }

          const outcome = await updateTrackingStatus(
            watchDoc.ref,
            userRef,
            trackingNumber,
            latest,
          );
          summary[outcome] += 1;
          if (outcome === "changed") {
            console.log(
              `STATUS CHANGED ${trackingNumber}: ${data.lastStatus || "unknown"} => ${latest.status}`,
            );
          }
        } catch (error) {
          summary.errors += 1;
          console.error(`Polling failed for ${trackingNumber}:`, error);
        }
      }),
    );
  }

  await sendPendingNotifications();
  console.log("========== SPX POLLING SUMMARY ==========");
  console.log(JSON.stringify({ total: snapshot.size, ...summary }, null, 2));
  if (summary.errors > 0) process.exitCode = 1;
}

pollSPX().catch((error) => {
  console.error("FATAL SPX polling error:", error);
  process.exitCode = 1;
});
