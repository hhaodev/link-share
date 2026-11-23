import { pollSPX } from "./spx.js";

const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SPX Worker Admin</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      color: #172033;
      background: #f3f5f9;
      font: 14px/1.5 Arial, sans-serif;
    }
    .container { max-width: 1500px; margin: auto; }
    header, section {
      margin-bottom: 16px;
      padding: 20px;
      background: white;
      border: 1px solid #e5e9f0;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(20, 32, 54, .04);
    }
    h1 { margin: 0 0 4px; font-size: 22px; }
    h2 { margin: 0 0 12px; font-size: 16px; }
    .description, .muted { color: #667085; }
    .toolbar { display: grid; grid-template-columns: minmax(200px, 1fr) repeat(3, auto); gap: 8px; margin-top: 16px; }
    input, button { min-height: 40px; padding: 9px 12px; border-radius: 8px; font: inherit; }
    input { min-width: 0; border: 1px solid #cfd6e2; }
    button { border: 0; background: #2563eb; color: white; cursor: pointer; font-weight: 600; }
    button.secondary { background: #475467; }
    button.test { background: #16834a; }
    button:disabled { opacity: .55; cursor: not-allowed; }
    #notice { margin-top: 10px; min-height: 21px; color: #667085; }
    #notice.error { color: #b42318; }
    #notice.success { color: #067647; }
    #runMeta { margin-bottom: 12px; color: #475467; overflow-wrap: anywhere; }
    #summary { display: flex; flex-wrap: wrap; gap: 8px; }
    .metric { min-width: 115px; padding: 10px 12px; background: #f8fafc; border: 1px solid #eaecf0; border-radius: 8px; }
    .metric strong { display: block; font-size: 18px; }
    .metric span { color: #667085; font-size: 12px; }
    .table-wrap { overflow: auto; max-height: 520px; border: 1px solid #eaecf0; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; white-space: nowrap; }
    th, td { padding: 8px 10px; text-align: left; vertical-align: top; border-bottom: 1px solid #eaecf0; }
    th { position: sticky; top: 0; z-index: 1; background: #f8fafc; color: #475467; }
    td.detail { white-space: nowrap; }
    tr:last-child td { border-bottom: 0; }
    #events { margin: 0; padding-left: 22px; }
    #events li { margin: 5px 0; overflow-wrap: anywhere; }
    #events time { color: #667085; margin-right: 8px; }
    @media (max-width: 760px) {
      body { padding: 12px; }
      header, section { padding: 14px; }
      .toolbar { grid-template-columns: 1fr 1fr; }
      .toolbar input { grid-column: 1 / -1; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>SPX Worker Admin</h1>
      <div class="description">Detailed logs are shown for the run you start here and are not saved.</div>
      <div class="toolbar">
        <input id="secret" type="password" placeholder="Enter POLL_SECRET" autocomplete="current-password">
        <button id="pollBtn" onclick="run(false)">Run SPX Polling</button>
        <button id="testBtn" class="test" onclick="run(true)">Test Notification</button>
      </div>
      <div id="notice">Enter POLL_SECRET and start a run to see its detailed log.</div>
    </header>

    <section>
      <h2>Run details</h2>
      <div id="runMeta" class="muted">No report loaded.</div>
      <div id="summary"></div>
    </section>

    <section>
      <h2>Run events</h2>
      <ol id="events"><li class="muted">No events.</li></ol>
    </section>

    <section>
      <h2>Tracking status by account and package</h2>
      <div class="table-wrap"><table><thead><tr>
        <th>Time</th><th>Account</th><th>Account UID</th><th>Tracking</th><th>Nickname</th><th>Result</th><th>Notification</th>
        <th>Old status</th><th>Old code</th><th>Old time</th><th>New status</th><th>New code</th><th>New time</th><th>Detail</th>
      </tr></thead><tbody id="trackingRows"></tbody></table></div>
    </section>

    <section>
      <h2>Notification delivery by device</h2>
      <div class="table-wrap"><table><thead><tr>
        <th>Time</th><th>Account</th><th>Account UID</th><th>Tracking</th><th>SPX status</th><th>Device</th><th>Result</th><th>FCM message / error</th>
      </tr></thead><tbody id="notificationRows"></tbody></table></div>
    </section>

    <section>
      <h2>Test notification by device</h2>
      <div class="table-wrap"><table><thead><tr>
        <th>Time</th><th>Account</th><th>Account UID</th><th>Device</th><th>Result</th><th>FCM message / error</th>
      </tr></thead><tbody id="testRows"></tbody></table></div>
    </section>
  </div>
  <script>
    let running = false;

    function showNotice(message, type = '') {
      const notice = document.getElementById('notice');
      notice.textContent = message;
      notice.className = type;
    }

    function renderTable(bodyId, rows, columns) {
      const body = document.getElementById(bodyId);
      body.replaceChildren();
      if (!rows || rows.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = columns.length;
        cell.className = 'muted';
        cell.textContent = 'No rows in this run.';
        row.append(cell);
        body.append(row);
        return;
      }

      for (const values of rows) {
        const row = document.createElement('tr');
        for (const column of columns) {
          const cell = document.createElement('td');
          const value = values[column.key];
          cell.textContent = value == null || value === ''
            ? '-'
            : typeof value === 'object'
              ? JSON.stringify(value)
              : String(value);
          if (column.key === 'detail' || column.key === 'error') cell.className = 'detail';
          row.append(cell);
        }
        body.append(row);
      }
    }

    function renderReport(report) {
      if (!report) {
        document.getElementById('runMeta').textContent = 'No report has been saved yet.';
        document.getElementById('summary').replaceChildren();
        document.getElementById('events').replaceChildren();
        renderTable('trackingRows', [], Array(14).fill({ key: '' }));
        renderTable('notificationRows', [], Array(8).fill({ key: '' }));
        renderTable('testRows', [], Array(6).fill({ key: '' }));
        return;
      }

      document.getElementById('runMeta').textContent =
        report.mode + ' | ' + report.status + ' | Started: ' + report.startedAt +
        ' | Finished: ' + (report.finishedAt || 'in progress') +
        ' | Run ID: ' + report.runId;

      const summary = document.getElementById('summary');
      summary.replaceChildren();
      for (const [label, value] of Object.entries(report.summary || {})) {
        const metric = document.createElement('div');
        metric.className = 'metric';
        const number = document.createElement('strong');
        number.textContent = String(value);
        const caption = document.createElement('span');
        caption.textContent = label;
        metric.append(number, caption);
        summary.append(metric);
      }

      const events = document.getElementById('events');
      events.replaceChildren();
      for (const event of report.events || []) {
        const item = document.createElement('li');
        const time = document.createElement('time');
        time.textContent = event.time || '';
        const message = document.createElement('span');
        const details = Object.keys(event.details || {}).length
          ? ' ' + JSON.stringify(event.details)
          : '';
        message.textContent = (event.level ? '[' + event.level.toUpperCase() + '] ' : '') +
          event.message + details;
        item.append(time, message);
        events.append(item);
      }
      if (report.error) {
        const item = document.createElement('li');
        item.textContent = report.error.name + ': ' + report.error.message;
        events.append(item);
      }

      renderTable('trackingRows', report.tables?.tracking, [
        { key: 'time' }, { key: 'account' }, { key: 'uid' }, { key: 'tracking' },
        { key: 'nickname' }, { key: 'result' }, { key: 'notification' }, { key: 'previousStatus' },
        { key: 'previousCode' }, { key: 'previousTime' }, { key: 'latestStatus' },
        { key: 'latestCode' }, { key: 'latestTime' }, { key: 'detail' }
      ]);
      renderTable('notificationRows', report.tables?.notifications, [
        { key: 'time' }, { key: 'account' }, { key: 'uid' }, { key: 'tracking' },
        { key: 'status' }, { key: 'device' }, { key: 'result' }, { key: 'error' }
      ]);
      renderTable('testRows', report.tables?.testNotifications, [
        { key: 'time' }, { key: 'account' }, { key: 'uid' }, { key: 'device' },
        { key: 'result' }, { key: 'error' }
      ]);
    }

    function getSecret() {
      return document.getElementById('secret').value.trim();
    }

    async function run(testNotification) {
      const secret = getSecret();
      const buttons = document.querySelectorAll('button');

      if (!secret) {
        showNotice('Enter POLL_SECRET first.', 'error');
        return;
      }

      running = true;
      buttons.forEach(button => button.disabled = true);
      showNotice(testNotification ? 'Sending test notifications...' : 'Polling SPX and collecting detailed logs...');

      try {
        const response = await fetch('/run', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + secret,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            testNotification
          })
        });
        const data = await response.json();
        renderReport(data.report);
        if (!response.ok) throw new Error(data.report?.error?.message || data.message || 'HTTP ' + response.status);
        showNotice('Run finished. Detailed logs are shown for this run only.', 'success');
      } catch (error) {
        showNotice('Run failed: ' + error.message, 'error');
      } finally {
        running = false;
        buttons.forEach(button => button.disabled = false);
      }
    }
  </script>
</body>
</html>
`;

function isAuthorized(request, env) {
  return Boolean(
    env.POLL_SECRET &&
    request.headers.get("Authorization") === `Bearer ${env.POLL_SECRET}`,
  );
}

async function runForAdmin(env, testNotification = false) {
  try {
    return await pollSPX(env, testNotification);
  } catch (error) {
    console.error("FATAL SPX polling error:", error);
    return (
      error?.report || {
        runId: crypto.randomUUID(),
        mode: testNotification ? "test-notification" : "spx-poll",
        status: "error",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        summary: null,
        events: [],
        tables: { tracking: [], notifications: [], testNotifications: [] },
        error: {
          name: error?.name || "Error",
          message: error?.message || String(error),
          stack: error?.stack || "",
        },
      }
    );
  }
}

export default {
  async scheduled(_event, env, context) {
    context.waitUntil(
      pollSPX(env).catch((error) => {
        console.error("FATAL SPX polling error:", error);
      }),
    );
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }

    if (request.method === "GET" && url.pathname === "/admin") {
      return new Response(html, {
        headers: {
          "Content-Type": "text/html;charset=UTF-8",
          "Cache-Control": "no-store",
        },
      });
    }

    if (request.method !== "POST" || url.pathname !== "/run") {
      return Response.json({ message: "Not found" }, { status: 404 });
    }

    if (!isAuthorized(request, env)) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
      const body = await request.json().catch(() => ({}));
      const report = await runForAdmin(env, body.testNotification === true);
      return Response.json(
        { status: report.status, report },
        { status: report.status === "success" ? 200 : 500 },
      );
    } catch (error) {
      console.error("FATAL SPX polling error:", error);

      return Response.json(
        {
          status: "error",
          message: error.message,
        },
        { status: 500 },
      );
    }
  },
};
