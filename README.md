# React + Vite

## SPX polling and push notifications

Cloudflare Workers runs the SPX poller on the schedule in
the repository-root `wrangler.toml` (currently every five minutes). It preserves the
existing watchlist baseline, status-change detection, completed-shipment
cleanup, Firestore notification queue, and per-device FCM retries. The worker
uses Firebase REST APIs and does not require the Node.js Firebase Admin SDK.

Worker code is organized under `worker/`:

- `worker/src/index.js`: scheduled trigger and authenticated manual endpoint.
- `worker/src/auth.js`: Google service-account JWT and OAuth access tokens.
- `worker/src/firestore.js`: Firestore REST reads and writes.
- `worker/src/fcm.js`: FCM HTTP v1 delivery.
- `worker/src/spx.js`: SPX polling and notification queue workflow.
- `wrangler.toml` and `worker/package.json`: Cloudflare configuration.

### Deploy the worker

1. Create a Firebase service account with Firestore and Firebase Cloud
   Messaging access. Keep its JSON key private.
2. Install and authenticate Wrangler with your Cloudflare account.
3. From the repository root, enter the worker directory, add the service
   account as a Worker secret, and deploy:

   ```sh
   cd worker
   npm install
   npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
   npx wrangler secret put POLL_SECRET
   npx wrangler deploy
   ```

   `POLL_SECRET` protects the optional manual endpoint. The worker automatically
   gets its Firebase project ID from the service-account JSON.
4. Deploy the Firestore collection-group index:

   ```sh
   npx firebase-tools deploy --only firestore:indexes --project YOUR_PROJECT_ID
   ```

The worker scans `notificationQueue` without a server-side `state` filter and
selects pending events in the worker, so routine queue delivery does not depend
on the `state` index being ready. `firestore.indexes.json` also declares the
collection-group ascending index needed by any existing query that filters
`notificationQueue` on `state`.

The first poll initializes status fields for older watchlist entries without
sending a notification. Later changes are queued in Firestore before FCM sends.
Failed deliveries are retried by later runs, and invalid FCM tokens are removed.
Terminal queue events (`sent`, `no_tokens`, `completed`) older than seven days
are deleted on each poll; `pending` events are retained for retry. Worker logs
include account display name and UID, tracking number, old/new status, and
per-device FCM results, including test notifications; raw FCM tokens are never
logged. Status changes are queued only when the account has an FCM token.
transitioning to completed still sends a notification when the status changed;
a package first seen as completed does not. Use `npx wrangler tail` to follow
raw runtime logs.

### View detailed run logs in Admin

Open `/admin`, enter `POLL_SECRET`, then start SPX polling or a test
notification. The page shows the detailed report returned by that run:
tracking results per account/package, old and new status and timestamps,
notification delivery per device, test-notification results, run events, and
the summary. The report is returned directly to the page and is not saved;
scheduled runs continue to be viewed with `npx wrangler tail`.

An `accepted by FCM` result means the FCM API accepted the request; it does not
confirm that the device displayed it. Foreground notifications are displayed by
the app's `onMessage` handler, while background notifications are handled by
the Firebase messaging service worker.
Use `POST /run` with `Authorization: Bearer <POLL_SECRET>` to trigger a manual
poll; send `{"testNotification":true}` to send a test notification to all
registered devices. `GET /health` checks that the worker is reachable.

For a local run using the Firebase Admin SDK, set `FIREBASE_SERVICE_ACCOUNT`
and run `npm run poll:spx`. This checks every active watchlist entry and may
send real notifications.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
