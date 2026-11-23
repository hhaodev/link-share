import {
  FCM_SCOPE_VALUE,
  getFirebaseProjectId,
  getGoogleAccessToken,
} from "./auth.js";

const FCM_URL = "https://fcm.googleapis.com/v1";

export { getFirebaseProjectId };

export async function sendFcmMessage(env, projectId, message) {
  const response = await fetch(
    `${FCM_URL}/projects/${encodeURIComponent(projectId)}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await getGoogleAccessToken(
          env,
          FCM_SCOPE_VALUE,
        )}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    },
  );
  const text = await response.text();
  let result;
  try {
    result = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`FCM returned invalid JSON (${response.status})`);
  }
  return { ok: response.ok, status: response.status, result };
}
