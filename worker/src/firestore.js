const FIRESTORE_URL = "https://firestore.googleapis.com/v1";
import {
  FIRESTORE_SCOPE_VALUE,
  getGoogleAccessToken,
  getFirebaseProjectId,
} from "./auth.js";

function encodeDocumentPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function toFirestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  return {
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          toFirestoreValue(item),
        ]),
      ),
    },
  };
}

function fromFirestoreValue(value) {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) {
    return (value.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ("mapValue" in value) return decodeFields(value.mapValue.fields || {});
  return undefined;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      fromFirestoreValue(value),
    ]),
  );
}

export async function firebaseRequest(env, url, options = {}) {
  const accessToken = await getGoogleAccessToken(
    env,
    FIRESTORE_SCOPE_VALUE,
  );
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  let result;
  try {
    result = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Firebase returned invalid JSON (${response.status})`);
  }
  if (!response.ok) {
    throw new Error(
      `Firebase request failed (${response.status}): ${JSON.stringify(result)}`,
    );
  }
  return result;
}

export function firestoreRoot(env) {
  return `${FIRESTORE_URL}/projects/${encodeURIComponent(getFirebaseProjectId(env))}/databases/(default)/documents`;
}

export function firestoreDocumentUrl(env, path) {
  return `${firestoreRoot(env)}/${encodeDocumentPath(path)}`;
}

export function firestoreDocumentName(env, path) {
  return `projects/${getFirebaseProjectId(env)}/databases/(default)/documents/${path}`;
}

export async function getDocument(env, path) {
  const response = await fetch(firestoreDocumentUrl(env, path), {
    headers: {
      Authorization: `Bearer ${await getGoogleAccessToken(
        env,
        FIRESTORE_SCOPE_VALUE,
      )}`,
    },
  });
  if (response.status === 404) return null;
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Firestore document read failed (${response.status}): ${text}`,
    );
  }
  const document = JSON.parse(text);
  return { ...document, data: decodeFields(document.fields) };
}

export async function listCollectionGroup(
  env,
  collectionId,
  { field, equals } = {},
) {
  const where = field
    ? {
        fieldFilter: {
          field: { fieldPath: field },
          op: "EQUAL",
          value: toFirestoreValue(equals),
        },
      }
    : undefined;
  const result = await firebaseRequest(
    env,
    `${firestoreRoot(env)}:runQuery`,
    {
      method: "POST",
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId, allDescendants: true }],
          ...(where ? { where } : {}),
        },
      }),
    },
  );
  return result
    .filter((entry) => entry.document)
    .map((entry) => ({
      ...entry.document,
      data: decodeFields(entry.document.fields),
    }));
}

export async function listSubcollection(env, parentPath, collectionId) {
  const result = await firebaseRequest(
    env,
    `${firestoreDocumentUrl(env, parentPath)}:runQuery`,
    {
      method: "POST",
      body: JSON.stringify({
        structuredQuery: { from: [{ collectionId }] },
      }),
    },
  );
  return result
    .filter((entry) => entry.document)
    .map((entry) => ({
      ...entry.document,
      data: decodeFields(entry.document.fields),
    }));
}

export async function commitWrites(env, writes) {
  return firebaseRequest(
    env,
    `${firestoreRoot(env)}:commit`,
    {
      method: "POST",
      body: JSON.stringify({ writes }),
    },
  );
}

export function updateWrite(document, values, fields, transforms = []) {
  return {
    update: {
      name: document.name,
      fields: Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          key,
          toFirestoreValue(value),
        ]),
      ),
    },
    updateMask: { fieldPaths: fields },
    currentDocument: { updateTime: document.updateTime },
    ...(transforms.length
      ? {
          updateTransforms: transforms.map((fieldPath) => ({
            fieldPath,
            setToServerValue: "REQUEST_TIME",
          })),
        }
      : {}),
  };
}

export function createWrite(path, values, transforms = []) {
  return {
    update: {
      name: path,
      fields: Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          key,
          toFirestoreValue(value),
        ]),
      ),
    },
    currentDocument: { exists: false },
    ...(transforms.length
      ? {
          updateTransforms: transforms.map((fieldPath) => ({
            fieldPath,
            setToServerValue: "REQUEST_TIME",
          })),
        }
      : {}),
  };
}

export function deleteWrite(document) {
  return {
    delete: document.name,
    currentDocument: { updateTime: document.updateTime },
  };
}

export function getDocumentPath(document) {
  return document.name.split("/documents/")[1];
}

