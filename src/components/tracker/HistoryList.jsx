import { useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { formatTime } from "../../utils/helpers";

function HistoryItem({ item, userId, onSearch, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const [searching, setSearching] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "users", userId, "history", item.trackingNumber));
      onDelete(item.trackingNumber);
    } catch (err) {
      console.error("Failed to delete history:", err);
      setDeleting(false);
    }
  }

  async function handleSearch() {
    setSearching(true);
    try {
      await onSearch(item.trackingNumber);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className={`watch-item${deleting ? " link-item--deleting" : ""}`}>
      <div className="watch-item-info">
        <span className="watch-tn">{item.trackingNumber}</span>
        <span className="watch-status">{item.lastStatus || "—"}</span>
        {item.searchedAt && (
          <span className="watch-time">
            Tìm lúc:{" "}
            {formatTime(item.searchedAt?.toDate?.() ?? item.searchedAt, false)}
          </span>
        )}
      </div>
      <div className="watch-item-actions">
        <button
          className="btn-icon"
          onClick={handleSearch}
          disabled={searching}
          title="Tra cứu lại"
          aria-label="Tra cứu lại"
        >
          {searching ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <svg
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle
                cx="7"
                cy="7"
                r="4.5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M11 11l2.5 2.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
        <button
          className="btn-icon btn-danger"
          onClick={handleDelete}
          disabled={deleting}
          title="Xóa khỏi lịch sử"
          aria-label="Xóa khỏi lịch sử"
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
    </div>
  );
}

export default function HistoryList({ items, userId, onSearch, onDelete }) {
  if (items.length === 0) return null;

  return (
    <div className="watchlist">
      <h3 className="watchlist-title">Lịch sử tra cứu ({items.length})</h3>
      <div className="watchlist-items">
        {items.map((item) => (
          <HistoryItem
            key={item.trackingNumber}
            item={item}
            userId={userId}
            onSearch={onSearch}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
