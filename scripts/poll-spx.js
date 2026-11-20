import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase-admin.js";
import { getSPXTracking } from "./spx-api.js";
import { getStatusEventId, sendPendingNotifications } from "./notification.js";

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

async function updateTrackingStatus(watchRef, userRef, trackingNumber, latest) {
  const statusRef = userRef
    .collection("notificationQueue")
    .doc(getStatusEventId(trackingNumber, latest));

  return db.runTransaction(async (transaction) => {
    const watchSnapshot = await transaction.get(watchRef);
    if (!watchSnapshot.exists) return "removed";

    const current = watchSnapshot.data();
    const hadPreviousStatus = hasPreviousStatus(current);
    const statusCodeChanged =
      current.lastStatusCode &&
      String(current.lastStatusCode) !== latest.statusCode;
    const changed =
      current.lastStatus !== latest.status ||
      statusCodeChanged ||
      normalizeTimestamp(
        current.lastCheckpointTime ?? current.lastStatusAt,
      ) !== normalizeTimestamp(latest.timestamp);
    const needsBaseline =
      !current.lastStatusCode ||
      current.lastCheckpointTime === undefined ||
      current.lastStatusAt === undefined;

    if (!changed && !needsBaseline) return "unchanged";

    const statusSnapshot =
      changed && hadPreviousStatus
        ? await transaction.get(statusRef)
        : null;

    transaction.update(watchRef, {
      lastStatus: latest.status,
      lastStatusCode: latest.statusCode,
      lastCheckpointTime: latest.timestamp,
      lastStatusAt: latest.timestamp,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (changed && hadPreviousStatus && !statusSnapshot.exists) {
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
  const snapshot = await db.collectionGroup("watchlist").get();
  console.log(`Packages to check: ${snapshot.size}`);

  const summary = {
    changed: 0,
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
