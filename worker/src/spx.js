import {
  getLatestSPXStatus,
  fetchSPXResponse,
  parseSPXResponse,
} from "../../src/utils/spx.js";
import {
  commitWrites,
  createWrite,
  deleteWrite,
  firestoreDocumentName,
  getDocument,
  getDocumentPath,
  listCollectionGroup,
  listSubcollection,
  updateWrite,
} from "./firestore.js";
import { getFirebaseProjectId, sendFcmMessage } from "./fcm.js";

const SERVER_TIMESTAMP = ["createdAt", "updatedAt"];
const INVALID_FCM_STATUSES = new Set(["UNREGISTERED"]);
const TERMINAL_NOTIFICATION_STATES = new Set([
  "sent",
  "no_tokens",
  "completed",
]);
const NOTIFICATION_RETENTION_MS = 1 * 24 * 60 * 60 * 1000;

function documentId(document) {
  return document.name.split("/").pop();
}

function userPath(document) {
  return getDocumentPath(document).split("/").slice(0, 2).join("/");
}

function userId(document) {
  return userPath(document).split("/")[1] || "unknown";
}

function serializeError(error) {
  return JSON.stringify({
    name: error?.name || "Error",
    message: error?.message || String(error),
    stack: error?.stack || "",
  });
}

function addLogRow(rows, row) {
  rows.push({ time: new Date().toISOString(), ...row });
}

function addRunEvent(report, level, message, details = {}) {
  report.events.push({
    time: new Date().toISOString(),
    level,
    message,
    details,
  });
}

async function getAccountInfo(env, accountId, accountCache) {
  if (!accountCache.has(accountId)) {
    accountCache.set(
      accountId,
      (async () => {
        try {
          const accountDocument = await getDocument(env, `users/${accountId}`);
          const displayName = accountDocument?.data?.displayName?.trim();
          return {
            uid: accountId,
            name: displayName || "(no display name)",
          };
        } catch (error) {
          console.error(
            `[ACCOUNT PROFILE ERROR] account=${accountId} Could not load display name:`,
            error,
          );
          return { uid: accountId, name: "(profile unavailable)" };
        }
      })(),
    );
  }
  return accountCache.get(accountId);
}

function logTable(title, columns, rows) {
  console.log(`[TABLE] ${title} (${rows.length} rows)`);
  if (rows.length === 0) {
    console.log("(no rows)");
    return;
  }

  const maxWidth = 48;
  const sortedRows = columns.some(({ key }) => key === "account")
    ? [...rows].sort((a, b) =>
        `${a.account}\n${a.tracking}\n${a.device}`.localeCompare(
          `${b.account}\n${b.tracking}\n${b.device}`,
        ),
      )
    : rows;
  const values = sortedRows.map((row) =>
    columns.map(({ key }) => {
      const value = String(row[key] ?? "-")
        .replace(/[\r\n\t|]/g, " ")
        .trim();
      return value.length > maxWidth
        ? `${value.slice(0, maxWidth - 3)}...`
        : value;
    }),
  );
  const widths = columns.map((column, index) =>
    Math.min(
      maxWidth,
      Math.max(column.label.length, ...values.map((row) => row[index].length)),
    ),
  );
  const border = `+${widths.map((width) => "-".repeat(width + 2)).join("+")}+`;
  const formatRow = (cells) =>
    `| ${cells.map((cell, index) => cell.padEnd(widths[index])).join(" | ")} |`;
  console.log(border);
  console.log(formatRow(columns.map(({ label }) => label)));
  console.log(border);
  values.forEach((row) => console.log(formatRow(row)));
  console.log(border);
}

async function hasUserFcmTokens(env, user, tokenCache) {
  const documents = await getUserTokenDocuments(env, user, tokenCache);
  return documents.length > 0;
}

async function shouldDeleteCompletedWatch(env, user, settingsCache) {
  if (!settingsCache.has(user)) {
    settingsCache.set(
      user,
      getDocument(env, `${user}/accountSettings/tracking`).then(
        (document) => document?.data?.deleteWhenDone !== false,
      ),
    );
  }
  return settingsCache.get(user);
}

async function getUserTokenDocuments(env, user, tokenCache) {
  if (!tokenCache.has(user)) {
    tokenCache.set(user, listSubcollection(env, user, "fcmTokens"));
  }
  return tokenCache.get(user);
}

function hasPreviousStatus(data) {
  return Boolean(
    data.lastStatus ||
    data.lastStatusCode ||
    data.lastCheckpointTime ||
    data.lastStatusAt,
  );
}

function normalizeTimestamp(value) {
  if (value == null) return "";
  return value instanceof Date ? value.toISOString() : String(value);
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

async function getTrackingStatus(trackingNumber) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetchSPXResponse(trackingNumber);
      const tracking = await parseSPXResponse(response, trackingNumber);
      return getLatestSPXStatus(tracking);
    } catch (error) {
      if (error?.name !== "TimeoutError" || attempt >= 1) {
        throw error;
      }

      console.warn(
        `[TRACKING RETRY] tracking=${trackingNumber} attempt=2 reason=timeout`,
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

async function getStatusEvent(user, trackingNumber, latest) {
  const fingerprint = [
    trackingNumber,
    latest.statusCode,
    latest.status,
    latest.timestamp,
  ].join("\n");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(fingerprint),
  );
  const eventId = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return {
    id: eventId,
    path: `${user}/notificationQueue/${eventId}`,
  };
}

async function getRecoveryStatusEvent(user, event) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`payload-mismatch\n${event.id}`),
  );
  const eventId = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return {
    id: eventId,
    path: `${user}/notificationQueue/${eventId}`,
  };
}

export function matchesStatusEvent(eventDocument, trackingNumber, latest) {
  const data = eventDocument?.data || {};
  return (
    String(data.trackingNumber ?? "") === String(trackingNumber ?? "") &&
    String(data.statusCode ?? "") === String(latest.statusCode ?? "") &&
    String(data.status ?? "") === String(latest.status ?? "") &&
    normalizeTimestamp(data.timestamp) === normalizeTimestamp(latest.timestamp)
  );
}

async function updateTrackingStatus(
  env,
  watchDocument,
  latest,
  tokenCache,
  settingsCache,
) {
  const user = userPath(watchDocument);
  const trackingNumber =
    watchDocument.data.trackingNumber || documentId(watchDocument);
  let event = await getStatusEvent(user, trackingNumber, latest);
  const current = watchDocument.data;
  const hadPreviousStatus = hasPreviousStatus(current);
  const changed =
    current.lastStatus !== latest.status ||
    String(current.lastStatusCode ?? "") !== String(latest.statusCode ?? "") ||
    normalizeTimestamp(current.lastCheckpointTime ?? current.lastStatusAt) !==
      normalizeTimestamp(latest.timestamp);
  const completed = isCompletedStatus(latest);
  const deleteWhenDone =
    completed && (await shouldDeleteCompletedWatch(env, user, settingsCache));
  const shouldNotify = changed && hadPreviousStatus;
  const needsBaseline =
    !current.lastStatusCode ||
    current.lastCheckpointTime === undefined ||
    current.lastStatusAt === undefined;

  if (!completed && !changed && !needsBaseline) {
    return { outcome: "unchanged", notification: "no" };
  }

  const writes = [];
  let eventDocument = shouldNotify ? await getDocument(env, event.path) : null;
  if (
    eventDocument &&
    !matchesStatusEvent(eventDocument, trackingNumber, latest)
  ) {
    console.warn(
      `[NOTIFICATION EVENT MISMATCH] event=${event.id} tracking=${trackingNumber} expected=${JSON.stringify(
        {
          status: latest.status,
          statusCode: latest.statusCode,
          timestamp: latest.timestamp,
        },
      )} stored=${JSON.stringify({
        status: eventDocument.data.status,
        statusCode: eventDocument.data.statusCode,
        timestamp: eventDocument.data.timestamp,
      })}; using recovery event ID`,
    );
    event = await getRecoveryStatusEvent(user, event);
    eventDocument = await getDocument(env, event.path);
    if (
      eventDocument &&
      !matchesStatusEvent(eventDocument, trackingNumber, latest)
    ) {
      throw new Error(
        `Recovery notification event has mismatched payload: ${event.path}`,
      );
    }
  }
  const canQueueNotification =
    shouldNotify &&
    (eventDocument || (await hasUserFcmTokens(env, user, tokenCache)));

  if (completed) {
    writes.push(
      deleteWhenDone
        ? deleteWrite(watchDocument)
        : updateWrite(
            watchDocument,
            {
              lastStatus: latest.status,
              lastStatusCode: latest.statusCode,
              lastCheckpointTime: latest.timestamp,
              lastStatusAt: latest.timestamp,
              completed: true,
            },
            [
              "lastStatus",
              "lastStatusCode",
              "lastCheckpointTime",
              "lastStatusAt",
              "completed",
            ],
            ["updatedAt"],
          ),
    );

    if (shouldNotify && eventDocument) {
      writes.push(
        updateWrite(
          eventDocument,
          { completed: true },
          ["completed"],
          ["updatedAt"],
        ),
      );
    } else if (canQueueNotification) {
      writes.push(
        createWrite(
          firestoreDocumentName(env, event.path),
          {
            trackingNumber,
            nickname: current.nickname || "",
            status: latest.status,
            statusCode: latest.statusCode,
            timestamp: latest.timestamp,
            state: "pending",
            completed: true,
          },
          SERVER_TIMESTAMP,
        ),
      );
    }

    await commitWrites(env, writes);
    return {
      outcome: "completed",
      notification: !shouldNotify
        ? "no"
        : eventDocument?.data.state === "no_tokens"
          ? "skipped_no_tokens"
          : !canQueueNotification
            ? "skipped_no_tokens"
            : eventDocument
              ? "deduplicated"
              : "queued",
    };
  }

  writes.push(
    updateWrite(
      watchDocument,
      {
        lastStatus: latest.status,
        lastStatusCode: latest.statusCode,
        lastCheckpointTime: latest.timestamp,
        lastStatusAt: latest.timestamp,
      },
      ["lastStatus", "lastStatusCode", "lastCheckpointTime", "lastStatusAt"],
      ["updatedAt"],
    ),
  );

  if (canQueueNotification && !eventDocument) {
    writes.push(
      createWrite(
        firestoreDocumentName(env, event.path),
        {
          trackingNumber,
          nickname: current.nickname || "",
          status: latest.status,
          statusCode: latest.statusCode,
          timestamp: latest.timestamp,
          state: "pending",
        },
        SERVER_TIMESTAMP,
      ),
    );
  }

  await commitWrites(env, writes);
  return {
    outcome: changed && hadPreviousStatus ? "changed" : "initialized",
    notification: !shouldNotify
      ? "no"
      : eventDocument?.data.state === "no_tokens"
        ? "skipped_no_tokens"
        : !canQueueNotification
          ? "skipped_no_tokens"
          : eventDocument
            ? "deduplicated"
            : "queued",
  };
}

function getErrorStatus(errorBody) {
  return (
    errorBody?.error?.status ||
    errorBody?.error?.details?.find((detail) => detail.errorCode)?.errorCode ||
    ""
  );
}

async function sendToToken(env, projectId, token, message) {
  try {
    const response = await sendFcmMessage(env, projectId, {
      ...message,
      token,
    });
    return {
      token,
      success: response.ok,
      errorStatus: response.ok ? "" : getErrorStatus(response.result),
      error: response.result?.error?.message || "",
      messageId: response.result?.name || "",
    };
  } catch (error) {
    return {
      token,
      success: false,
      errorStatus: "REQUEST_ERROR",
      error: error.message || String(error),
    };
  }
}

async function getUserTokens(env, user, tokenCache) {
  const documents = await getUserTokenDocuments(env, user, tokenCache);
  return documents
    .map((document) => ({
      token: document.data.token || documentId(document),
      document,
    }))
    .filter(({ token }) => Boolean(token));
}

async function sendNotificationEvent(
  env,
  projectId,
  event,
  accountCache,
  logRows,
  tokenCache,
) {
  let eventDocument = event;
  let eventData = event.data;
  const user = userPath(event);
  const accountId = userId(event);
  const account = await getAccountInfo(env, accountId, accountCache);
  if (!user || !eventData.trackingNumber) {
    throw new Error(
      `Notification event has invalid parent or tracking number: ${event.name}`,
    );
  }

  let pendingTokens = eventData.pendingTokens;
  if (!Array.isArray(pendingTokens)) {
    const userTokens = await getUserTokens(env, user, tokenCache);
    pendingTokens = [...new Set(userTokens.map(({ token }) => token))];
    if (pendingTokens.length === 0) {
      await commitWrites(env, [
        updateWrite(
          eventDocument,
          { state: "no_tokens" },
          ["state"],
          ["updatedAt"],
        ),
      ]);
      addLogRow(logRows, {
        account: account.name,
        uid: account.uid,
        tracking: eventData.trackingNumber,
        status: eventData.status || "-",
        device: "-",
        result: "no tokens",
        error: "Notifications were disabled when the event was processed",
      });
      return;
    }

    const result = await commitWrites(env, [
      updateWrite(
        eventDocument,
        { pendingTokens },
        ["pendingTokens"],
        ["updatedAt"],
      ),
    ]);
    eventDocument = {
      ...eventDocument,
      updateTime: result.writeResults?.[0]?.updateTime,
    };
    eventData = { ...eventData, pendingTokens };
  }

  const pendingTokenSet = new Set(pendingTokens);
  const tokenDocuments = await getUserTokens(env, user, tokenCache);
  const tokenDocumentByValue = new Map(
    tokenDocuments.map(({ token, document }) => [token, document]),
  );
  const deviceByToken = new Map(
    tokenDocuments.map(({ token, document }) => [
      token,
      document.data.deviceId || "",
    ]),
  );
  const message = {
    notification: {
      title: "Cập nhật đơn hàng",
      body: `Đơn hàng ${eventData.nickname ? `${eventData.nickname} (${eventData.trackingNumber})` : eventData.trackingNumber}: ${eventData.status}`,
    },
    data: {
      trackingNumber: String(eventData.trackingNumber),
      userId: user.split("/")[1],
      type: "SPX_STATUS_UPDATE",
    },
    webpush: {
      notification: {
        icon: "/app-icon.svg",
        tag: `spx-${eventData.trackingNumber}`,
      },
    },
  };

  let acceptedCount = 0;
  let retryCount = 0;
  let invalidTokenCount = 0;
  for (let offset = 0; offset < pendingTokens.length; offset += 50) {
    const batchTokens = pendingTokens.slice(offset, offset + 50);
    const results = await Promise.all(
      batchTokens.map((token) => sendToToken(env, projectId, token, message)),
    );
    const writes = [];

    results.forEach((result, index) => {
      const deviceNumber = offset + index + 1;
      if (result.success || INVALID_FCM_STATUSES.has(result.errorStatus)) {
        pendingTokenSet.delete(result.token);
      }
      if (INVALID_FCM_STATUSES.has(result.errorStatus)) {
        invalidTokenCount += 1;
        const tokenDocument = tokenDocumentByValue.get(result.token);
        if (tokenDocument) writes.push(deleteWrite(tokenDocument));
        addLogRow(logRows, {
          account: account.name,
          uid: account.uid,
          tracking: eventData.trackingNumber,
          status: eventData.status || "-",
          device:
            deviceByToken.get(result.token) ||
            `${deviceNumber}/${pendingTokens.length}`,
          result: "invalid token removed",
          error: result.errorStatus,
        });
      } else if (result.success) {
        acceptedCount += 1;
        addLogRow(logRows, {
          account: account.name,
          uid: account.uid,
          tracking: eventData.trackingNumber,
          status: eventData.status || "-",
          device:
            deviceByToken.get(result.token) ||
            `${deviceNumber}/${pendingTokens.length}`,
          result: "accepted by FCM",
          error: result.messageId || "-",
        });
      } else if (!result.success) {
        retryCount += 1;
        addLogRow(logRows, {
          account: account.name,
          uid: account.uid,
          tracking: eventData.trackingNumber,
          status: eventData.status || "-",
          device:
            deviceByToken.get(result.token) ||
            `${deviceNumber}/${pendingTokens.length}`,
          result: "retry",
          error: result.errorStatus || result.error,
        });
      }
    });

    const updatedTokens = [...pendingTokenSet];
    writes.push(
      updateWrite(
        eventDocument,
        {
          pendingTokens: updatedTokens,
          state: updatedTokens.length === 0 ? "sent" : "pending",
        },
        ["pendingTokens", "state"],
        ["updatedAt"],
      ),
    );
    const committed = await commitWrites(env, writes);
    eventDocument = {
      ...eventDocument,
      updateTime: committed.writeResults?.[writes.length - 1]?.updateTime,
    };
  }

  addLogRow(logRows, {
    account: account.name,
    uid: account.uid,
    tracking: eventData.trackingNumber,
    status: eventData.status || "-",
    device: "TOTAL",
    result:
      pendingTokenSet.size > 0
        ? "pending retry"
        : acceptedCount > 0
          ? "accepted by FCM"
          : invalidTokenCount > 0
            ? "no valid devices"
            : "no pending devices",
    error: `accepted=${acceptedCount}, retry=${retryCount}, invalid=${invalidTokenCount}, remaining=${pendingTokenSet.size}`,
  });
}

async function sendPendingNotifications(
  env,
  projectId,
  accountCache,
  tokenCache,
) {
  const pendingEvents = await listCollectionGroup(env, "notificationQueue", {
    field: "state",
    equals: "pending",
  });
  console.log(
    `[NOTIFICATION QUEUE] scanned=${pendingEvents.length} pending=${pendingEvents.length}`,
  );
  let errors = 0;
  const logRows = [];
  for (const event of pendingEvents) {
    try {
      await sendNotificationEvent(
        env,
        projectId,
        event,
        accountCache,
        logRows,
        tokenCache,
      );
    } catch (error) {
      errors += 1;
      const account = await getAccountInfo(env, userId(event), accountCache);
      console.error(
        `[NOTIFICATION ERROR] account="${account.name}" uid=${account.uid} tracking=${event.data.trackingNumber || "unknown"} event=${documentId(event)} ${serializeError(error)}`,
      );
      addLogRow(logRows, {
        account: account.name,
        uid: account.uid,
        tracking: event.data.trackingNumber || "unknown",
        status: event.data.status || "-",
        device: "-",
        result: "error",
        error: error.message || String(error),
      });
    }
  }
  logTable(
    "NOTIFICATION DELIVERY",
    [
      { key: "account", label: "ACCOUNT NAME" },
      { key: "uid", label: "ACCOUNT UID" },
      { key: "tracking", label: "TRACKING" },
      { key: "status", label: "SPX STATUS" },
      { key: "device", label: "DEVICE" },
      { key: "result", label: "RESULT" },
      { key: "error", label: "FCM MESSAGE / ERROR" },
    ],
    logRows,
  );
  return {
    errors,
    scanned: pendingEvents.length,
    pending: pendingEvents.length,
    rows: logRows,
  };
}

export async function cleanupExpiredNotificationEvents(env) {
  const terminalEventGroups = await Promise.all(
    [...TERMINAL_NOTIFICATION_STATES].map((state) =>
      listCollectionGroup(env, "notificationQueue", {
        field: "state",
        equals: state,
      }),
    ),
  );
  const events = terminalEventGroups.flat();
  const cutoff = Date.now() - NOTIFICATION_RETENTION_MS;
  const expiredEvents = events.filter((event) => {
    if (
      event.data.state === "pending" ||
      !TERMINAL_NOTIFICATION_STATES.has(event.data.state)
    ) {
      return false;
    }

    const timestamp = Date.parse(event.data.updatedAt || event.data.createdAt);
    return Number.isFinite(timestamp) && timestamp < cutoff;
  });
  let deletedCount = 0;

  for (let offset = 0; offset < expiredEvents.length; offset += 500) {
    const batch = expiredEvents.slice(offset, offset + 500);
    await commitWrites(env, batch.map(deleteWrite));
    deletedCount += batch.length;
  }

  console.log(
    `Expired notification events deleted: ${deletedCount} (retention: 24 hours)`,
  );
  return deletedCount;
}

async function sendTestNotifications(env, projectId, accountCache) {
  const documents = await listCollectionGroup(env, "fcmTokens");
  const targetsByToken = new Map();
  documents.forEach((document) => {
    const token = document.data.token || documentId(document);
    if (!token) return;

    if (!targetsByToken.has(token)) {
      targetsByToken.set(token, {
        token,
        accountIds: new Set(),
        deviceIds: new Set(),
      });
    }
    const target = targetsByToken.get(token);
    target.accountIds.add(userId(document));
    if (document.data.deviceId) target.deviceIds.add(document.data.deviceId);
  });
  const targets = [...targetsByToken.values()];
  let success = 0;
  let failure = 0;
  let errors = 0;
  const logRows = [];

  for (let offset = 0; offset < targets.length; offset += 50) {
    const batchTargets = targets.slice(offset, offset + 50);
    const results = await Promise.all(
      batchTargets.map((target) =>
        sendToToken(env, projectId, target.token, {
          notification: {
            title: "Thông báo mới",
            body: "Test thông báo.",
          },
          data: { type: "TEST_NOTIFICATION" },
        }),
      ),
    );
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      const target = batchTargets[index];
      const accounts = await Promise.all(
        [...target.accountIds].map((accountId) =>
          getAccountInfo(env, accountId, accountCache),
        ),
      );
      const accountNames = accounts.map((account) => account.name).join(", ");
      const accountIds = accounts.map((account) => account.uid).join(", ");
      const deviceIds =
        [...target.deviceIds].join(", ") ||
        `${offset + index + 1}/${targets.length}`;

      if (result.success) {
        success += 1;
        addLogRow(logRows, {
          account: accountNames,
          uid: accountIds,
          tracking: "-",
          status: "TEST",
          device: deviceIds,
          result: "accepted by FCM",
          error: result.messageId || "-",
        });
      } else {
        failure += 1;
        errors += 1;
        console.error(
          `[TEST NOTIFICATION ERROR] accounts="${accountNames}" uids=${accountIds} devices=${deviceIds} ${JSON.stringify({ status: result.errorStatus || "FCM_ERROR", message: result.error })}`,
        );
        addLogRow(logRows, {
          account: accountNames,
          uid: accountIds,
          tracking: "-",
          status: "TEST",
          device: deviceIds,
          result: "failed",
          error: result.errorStatus || result.error,
        });
      }
    }
  }

  if (targets.length === 0) {
    addLogRow(logRows, {
      account: "-",
      uid: "-",
      tracking: "-",
      status: "TEST",
      device: "-",
      result: "not sent",
      error: "No registered FCM tokens",
    });
  }
  logTable(
    "TEST NOTIFICATION DELIVERY",
    [
      { key: "account", label: "ACCOUNT NAME" },
      { key: "uid", label: "ACCOUNT UID" },
      { key: "tracking", label: "TRACKING" },
      { key: "status", label: "TYPE" },
      { key: "device", label: "DEVICE" },
      { key: "result", label: "RESULT" },
      { key: "error", label: "FCM MESSAGE / ERROR" },
    ],
    logRows,
  );
  return {
    summary: { devices: targets.length, success, failure, errors },
    rows: logRows,
  };
}

async function runWithConcurrency(items, concurrency, callback) {
  for (let offset = 0; offset < items.length; offset += concurrency) {
    await Promise.all(items.slice(offset, offset + concurrency).map(callback));
  }
}

export async function pollSPX(env, testNotification = false) {
  const report = {
    runId: crypto.randomUUID(),
    mode: testNotification ? "test-notification" : "spx-poll",
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    summary: null,
    events: [],
    tables: {
      tracking: [],
      notifications: [],
      testNotifications: [],
    },
  };
  const accountCache = new Map();

  try {
    const projectId = getFirebaseProjectId(env);

    if (testNotification) {
      addRunEvent(report, "info", "Starting test notification run");
      const testResult = await sendTestNotifications(
        env,
        projectId,
        accountCache,
      );
      report.summary = testResult.summary;
      report.tables.testNotifications = testResult.rows;
      addRunEvent(report, "info", "Test notification run finished", {
        ...testResult.summary,
      });
      logTable(
        "TEST NOTIFICATION SUMMARY",
        [
          { key: "devices", label: "DEVICES" },
          { key: "success", label: "ACCEPTED BY FCM" },
          { key: "failure", label: "FAILED" },
          { key: "errors", label: "ERRORS" },
        ],
        [testResult.summary],
      );
      if (testResult.summary.errors > 0 || testResult.summary.success === 0) {
        throw new Error("Test notification delivery failed");
      }
    } else {
      console.log("========== SPX POLLING START ==========");
      addRunEvent(report, "info", "SPX polling started");
      const watchDocuments = await listCollectionGroup(env, "watchlist");
      console.log(`Packages to check: ${watchDocuments.length}`);
      addRunEvent(report, "info", "Loaded SPX watchlist", {
        packages: watchDocuments.length,
      });
      const summary = {
        changed: 0,
        completed: 0,
        initialized: 0,
        unchanged: 0,
        removed: 0,
        errors: 0,
      };
      const trackingLogRows = [];
      const tokenCache = new Map();
      const settingsCache = new Map();

      await runWithConcurrency(watchDocuments, 5, async (watchDocument) => {
        const trackingNumber =
          watchDocument.data.trackingNumber || documentId(watchDocument);
        const accountId = userId(watchDocument);
        if (accountId === "unknown" || !trackingNumber) {
          console.error(
            `[TRACKING ERROR] account=${accountId} tracking=${trackingNumber || "unknown"} reason=invalid_watchlist_document document=${watchDocument.name}`,
          );
          addLogRow(trackingLogRows, {
            account: "(unknown)",
            uid: accountId,
            tracking: trackingNumber || "unknown",
            nickname: watchDocument.data.nickname || "-",
            result: "error",
            notification: "-",
            previousStatus: "-",
            previousCode: "-",
            previousTime: "-",
            latestStatus: "-",
            latestCode: "-",
            latestTime: "-",
            detail: "Invalid watchlist document",
          });
          summary.errors += 1;
          return;
        }
        try {
          if (watchDocument.data.completed === true) {
            const deleteWhenDone = await shouldDeleteCompletedWatch(
              env,
              userPath(watchDocument),
              settingsCache,
            );
            if (deleteWhenDone) {
              await commitWrites(env, [deleteWrite(watchDocument)]);
              summary.removed += 1;
            } else {
              summary.completed += 1;
            }

            const account = await getAccountInfo(env, accountId, accountCache);
            addLogRow(trackingLogRows, {
              account: account.name,
              uid: accountId,
              tracking: trackingNumber,
              nickname: watchDocument.data.nickname || "-",
              result: deleteWhenDone ? "removed" : "completed",
              notification: "no",
              previousStatus: watchDocument.data.lastStatus || "-",
              previousCode: watchDocument.data.lastStatusCode || "-",
              previousTime:
                normalizeTimestamp(
                  watchDocument.data.lastCheckpointTime ??
                    watchDocument.data.lastStatusAt,
                ) || "-",
              latestStatus: "-",
              latestCode: "-",
              latestTime: "-",
              detail: deleteWhenDone
                ? "Completed package; removed from watchlist"
                : "Completed package; polling skipped",
            });
            return;
          }

          const latest = await getTrackingStatus(trackingNumber);
          if (!latest) {
            const account = await getAccountInfo(env, accountId, accountCache);
            addLogRow(trackingLogRows, {
              account: account.name,
              uid: account.uid,
              tracking: trackingNumber,
              nickname: watchDocument.data.nickname || "-",
              result: "no events",
              notification: "no",
              previousStatus: watchDocument.data.lastStatus || "-",
              previousCode: watchDocument.data.lastStatusCode || "-",
              previousTime:
                normalizeTimestamp(
                  watchDocument.data.lastCheckpointTime ??
                    watchDocument.data.lastStatusAt,
                ) || "-",
              latestStatus: "-",
              latestCode: "-",
              latestTime: "-",
              detail: "-",
            });
            summary.unchanged += 1;
            return;
          }
          const result = await updateTrackingStatus(
            env,
            watchDocument,
            latest,
            tokenCache,
            settingsCache,
          );
          summary[result.outcome] += 1;
          const account = await getAccountInfo(env, accountId, accountCache);
          const previousStatus = watchDocument.data.lastStatus || "unknown";
          const previousCode = watchDocument.data.lastStatusCode || "unknown";
          const previousTimestamp =
            normalizeTimestamp(
              watchDocument.data.lastCheckpointTime ??
                watchDocument.data.lastStatusAt,
            ) || "unknown";
          addLogRow(trackingLogRows, {
            account: account.name,
            uid: account.uid,
            tracking: trackingNumber,
            nickname: watchDocument.data.nickname || "-",
            result: result.outcome,
            notification: result.notification,
            previousStatus,
            previousCode,
            previousTime: previousTimestamp,
            latestStatus: latest.status,
            latestCode: latest.statusCode,
            latestTime: normalizeTimestamp(latest.timestamp) || "-",
            detail: "-",
          });
        } catch (error) {
          summary.errors += 1;
          const account = await getAccountInfo(env, accountId, accountCache);
          console.error(
            `[TRACKING ERROR] account="${account.name}" uid=${account.uid} tracking=${trackingNumber} ${serializeError(error)}`,
          );
          addLogRow(trackingLogRows, {
            account: account.name,
            uid: account.uid,
            tracking: trackingNumber,
            nickname: watchDocument.data.nickname || "-",
            result: "error",
            notification: "-",
            previousStatus: watchDocument.data.lastStatus || "-",
            previousCode: watchDocument.data.lastStatusCode || "-",
            previousTime: "-",
            latestStatus: "-",
            latestCode: "-",
            latestTime: "-",
            detail: error.message || String(error),
          });
        }
      });

      report.tables.tracking = trackingLogRows;
      logTable(
        "TRACKING STATUS",
        [
          { key: "time", label: "TIME" },
          { key: "account", label: "ACCOUNT NAME" },
          { key: "uid", label: "ACCOUNT UID" },
          { key: "tracking", label: "TRACKING" },
          { key: "nickname", label: "NICKNAME" },
          { key: "result", label: "RESULT" },
          { key: "notification", label: "NOTIFY" },
          { key: "previousStatus", label: "OLD STATUS" },
          { key: "previousCode", label: "OLD CODE" },
          { key: "previousTime", label: "OLD TIME" },
          { key: "latestStatus", label: "NEW STATUS" },
          { key: "latestCode", label: "NEW CODE" },
          { key: "latestTime", label: "NEW TIME" },
          { key: "detail", label: "DETAIL" },
        ],
        trackingLogRows,
      );

      const notificationResult = await sendPendingNotifications(
        env,
        projectId,
        accountCache,
        tokenCache,
      );
      summary.notificationErrors = notificationResult.errors;
      report.tables.notifications = notificationResult.rows;
      addRunEvent(report, "info", "Notification queue processed", {
        scanned: notificationResult.scanned,
        pending: notificationResult.pending,
        errors: notificationResult.errors,
      });
      report.summary = { total: watchDocuments.length, ...summary };
      console.log("========== SPX POLLING SUMMARY ==========");
      console.log(JSON.stringify(report.summary));
      if (summary.errors > 0 || summary.notificationErrors > 0) {
        throw new Error(
          `${summary.errors} tracking checks and ${summary.notificationErrors} notification events failed`,
        );
      }
    }

    report.status = "success";
    report.finishedAt = new Date().toISOString();
    return report;
  } catch (error) {
    report.status = "error";
    report.finishedAt = new Date().toISOString();
    report.error = {
      name: error?.name || "Error",
      message: error?.message || String(error),
      stack: error?.stack || "",
    };
    addRunEvent(report, "error", report.error.message);
    const reportError =
      error && (typeof error === "object" || typeof error === "function")
        ? error
        : new Error(String(error));
    reportError.report = report;
    throw reportError;
  }
}
