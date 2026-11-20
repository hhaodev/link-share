# React + Vite

## SPX polling and push notifications

The `Poll SPX shipments` GitHub Actions workflow checks watched shipments every
five minutes and sends an FCM push notification when a shipment's latest status
or checkpoint time changes. Run it immediately from **Actions → Poll SPX
shipments → Run workflow**.

To configure the workflow:

1. Create a Firebase service account with access to this project's Firestore
   and Firebase Cloud Messaging.
2. In GitHub, go to **Settings → Secrets and variables → Actions** and add a
   repository secret named `FIREBASE_SERVICE_ACCOUNT`. Set its value to the
   complete service-account JSON. Never commit the key to the repository.
3. Ensure GitHub Actions are enabled. Scheduled workflows run from the default
   branch; GitHub may delay scheduled starts during busy periods.

The first poll initializes status fields for older watchlist entries without
sending a notification. Later changes are queued in Firestore before FCM sends.
Failed deliveries are retried by later runs, and invalid FCM tokens are removed.

For a local manual run, set `FIREBASE_SERVICE_ACCOUNT` to the service-account
JSON and run `npm run poll:spx`. This checks every active watchlist entry and
may send real notifications.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
