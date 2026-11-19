import { useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { timeAgo, getDomain } from "../utils/helpers";

export default function LinkItem({ link, boxId }) {
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
