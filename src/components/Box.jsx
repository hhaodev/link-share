import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { isValidUrl } from "../utils/helpers";
import LinkItem from "./LinkItem";
import { LinkSkeleton } from "./Skeletons";

export default function Box({ box, onDelete, isDeleting }) {
  const [links, setLinks] = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [inputUrl, setInputUrl] = useState("");
  const [inputDesc, setInputDesc] = useState("");
  const [error, setError] = useState("");
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isRenamingName, setIsRenamingName] = useState(false);
  const [nameValue, setNameValue] = useState(box.name);
  const nameInputRef = useRef(null);

  useEffect(() => {
    const q = query(
      collection(db, "boxes", box.id, "links"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setLinks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingLinks(false);
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
        {loadingLinks ? (
          <>
            <LinkSkeleton />
            <LinkSkeleton />
          </>
        ) : links.length === 0 ? (
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
