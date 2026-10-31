import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(date) {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

// ─── LinkItem ────────────────────────────────────────────────────────────────

function LinkItem({ link, boxId }) {
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "boxes", boxId, "links", link.id));
    } catch (err) {
      console.error("Failed to delete link:", err);
      setDeleting(false);
    }
  }

  async function handleCopy() {
    if (copied) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  return (
    <div className={`link-item${deleting ? " link-item--deleting" : ""}`}>
      <div className="link-favicon">
        <img
          src={`https://www.google.com/s2/favicons?sz=32&domain=${getDomain(link.url)}`}
          alt=""
          width="16"
          height="16"
          onError={(e) => {
            e.target.style.display = "none";
          }}
        />
      </div>
      <div className="link-info">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="link-url"
          title={link.url}
        >
          {link.url}
        </a>
        {link.description && (
          <span className="link-desc">{link.description}</span>
        )}
      </div>
      <span className="link-time">{timeAgo(link.createdAt?.toDate())}</span>
      <button
        className="btn-icon"
        onClick={handleCopy}
        disabled={copied}
        title="Copy link"
        aria-label="Copy link"
      >
        {copied ? (
          <svg
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M2 8l4 4 8-8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect
              x="5"
              y="5"
              width="8"
              height="8"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M11 5V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        )}
      </button>
      <button
        className="btn-icon btn-danger"
        onClick={handleDelete}
        disabled={deleting}
        title="Delete link"
        aria-label="Delete link"
      >
        {deleting ? (
          <span className="spinner" aria-hidden="true" />
        ) : (
          <svg
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M3 4h10M6 4V3h4v1M5 4v8h6V4H5z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

// ─── Box ─────────────────────────────────────────────────────────────────────

function Box({ box, onDelete, isDeleting }) {
  const [links, setLinks] = useState([]);
  const [inputUrl, setInputUrl] = useState("");
  const [inputDesc, setInputDesc] = useState("");
  const [error, setError] = useState("");
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isRenamingName, setIsRenamingName] = useState(false);
  const [nameValue, setNameValue] = useState(box.name);
  const nameInputRef = useRef(null);

  // Real-time links listener
  useEffect(() => {
    const q = query(
      collection(db, "boxes", box.id, "links"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setLinks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [box.id]);

  useEffect(() => {
    if (isEditingName) nameInputRef.current?.focus();
  }, [isEditingName]);

  async function handleAddLink(e) {
    e.preventDefault();
    const url = inputUrl.trim();
    if (!url) return;
    if (!isValidUrl(url)) {
      setError(
        "Please enter a valid URL (must start with http:// or https://)",
      );
      return;
    }
    setError("");
    setIsAddingLink(true);
    try {
      await addDoc(collection(db, "boxes", box.id, "links"), {
        url,
        description: inputDesc.trim(),
        createdAt: serverTimestamp(),
      });
      setInputUrl("");
      setInputDesc("");
    } catch (err) {
      console.error("Failed to add link:", err);
      setError(`Error: ${err.message}`);
    } finally {
      setIsAddingLink(false);
    }
  }

  async function handleRename(e) {
    e.preventDefault();
    const trimmed = nameValue.trim();
    if (!trimmed) {
      setNameValue(box.name);
      setIsEditingName(false);
      return;
    }
    if (trimmed !== box.name) {
      setIsRenamingName(true);
      try {
        await updateDoc(doc(db, "boxes", box.id), { name: trimmed });
      } catch (err) {
        console.error("Failed to rename box:", err);
        setNameValue(box.name);
      } finally {
        setIsRenamingName(false);
      }
    }
    setIsEditingName(false);
  }

  return (
    <article className={`box${isDeleting ? " box--deleting" : ""}`}>
      <header className="box-header">
        {isEditingName ? (
          <form onSubmit={handleRename} className="rename-form">
            <input
              ref={nameInputRef}
              className="rename-input"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleRename}
              disabled={isRenamingName}
              maxLength={50}
            />
          </form>
        ) : (
          <button
            className="box-name-btn"
            onClick={() => setIsEditingName(true)}
            disabled={isDeleting}
            title="Click to rename"
          >
            <h2 className="box-name">{box.name}</h2>
            <svg
              className="edit-icon"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        <span className="link-count">
          {links.length} link{links.length !== 1 ? "s" : ""}
        </span>
        <button
          className="btn-icon btn-danger"
          onClick={() => onDelete(box.id)}
          disabled={isDeleting}
          title="Delete box"
          aria-label={`Delete box ${box.name}`}
        >
          {isDeleting ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <svg
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M3 4h10M6 4V3h4v1M5 4v8h6V4H5z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </header>

      <form className="add-link-form" onSubmit={handleAddLink}>
        <input
          type="url"
          className="link-input"
          placeholder="Paste a link…"
          value={inputUrl}
          onChange={(e) => {
            setInputUrl(e.target.value);
            setError("");
          }}
          disabled={isAddingLink || isDeleting}
          aria-label="Link URL"
        />
        <input
          type="text"
          className="link-input link-desc-input"
          placeholder="Description (optional)…"
          value={inputDesc}
          onChange={(e) => setInputDesc(e.target.value)}
          disabled={isAddingLink || isDeleting}
          maxLength={120}
          aria-label="Link description"
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={isAddingLink || isDeleting || !inputUrl.trim()}
        >
          {isAddingLink ? (
            <>
              <span className="spinner spinner--light" aria-hidden="true" />
              Adding…
            </>
          ) : (
            "Add"
          )}
        </button>
      </form>
      {error && <p className="error-msg">{error}</p>}

      <div className="links-list">
        {links.length === 0 ? (
          <p className="empty-state">No links yet. Paste one above!</p>
        ) : (
          links.map((link) => (
            <LinkItem key={link.id} link={link} boxId={box.id} />
          ))
        )}
      </div>
    </article>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [boxes, setBoxes] = useState([]);
  const [newBoxName, setNewBoxName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingBoxIds, setDeletingBoxIds] = useState(new Set());

  // Real-time boxes listener
  useEffect(() => {
    const q = query(collection(db, "boxes"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setBoxes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  async function handleCreateBox(e) {
    e.preventDefault();
    const name = newBoxName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await addDoc(collection(db, "boxes"), {
        name,
        createdAt: serverTimestamp(),
      });
      setNewBoxName("");
    } catch (err) {
      console.error("Failed to create box:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteBox(boxId) {
    setDeletingBoxIds((prev) => new Set(prev).add(boxId));
    try {
      const linksSnap = await getDocs(collection(db, "boxes", boxId, "links"));
      const batch = writeBatch(db);
      linksSnap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, "boxes", boxId));
      await batch.commit();
    } catch (err) {
      console.error("Failed to delete box:", err);
      alert(`Error: ${err.message}`);
      setDeletingBoxIds((prev) => {
        const next = new Set(prev);
        next.delete(boxId);
        return next;
      });
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="logo">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>LinkShare</span>
          </div>
          <p className="app-tagline">
            Real-time link sharing — no login required
          </p>
          <button
            className="btn-icon btn-reload"
            onClick={() => window.location.reload()}
            title="Reload page"
            aria-label="Reload page"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M13.5 2.5v4h-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12.83 9.5A5.5 5.5 0 1 1 11 4.17l2.5 2.33"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <main className="app-main">
        <form className="create-box-form" onSubmit={handleCreateBox}>
          <input
            type="text"
            className="box-name-input"
            placeholder="New box name…"
            value={newBoxName}
            onChange={(e) => setNewBoxName(e.target.value)}
            disabled={creating}
            maxLength={50}
            aria-label="New box name"
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={creating || !newBoxName.trim()}
          >
            {creating ? (
              <>
                <span className="spinner spinner--light" aria-hidden="true" />
                Creating…
              </>
            ) : (
              "+ Create Box"
            )}
          </button>
        </form>

        {boxes.length === 0 ? (
          <div className="empty-boxes">
            <svg
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect
                x="8"
                y="14"
                width="32"
                height="26"
                rx="3"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M16 14V10a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M24 22v8M20 26h8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <p>No boxes yet. Create one to get started!</p>
          </div>
        ) : (
          <div className="boxes-grid">
            {boxes.map((box) => (
              <Box
                key={box.id}
                box={box}
                onDelete={handleDeleteBox}
                isDeleting={deletingBoxIds.has(box.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
