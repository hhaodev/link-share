import { useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { formatTime } from "../../utils/helpers";

function WatchItem({ item, userId, onSearch, onRemove }) {
  const [removing, setRemoving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    try {
      await deleteDoc(
        doc(db, "users", userId, "watchlist", item.trackingNumber),
      );
      onRemove(item.trackingNumber);
    } catch (err) {
      console.error("Failed to remove:", err);
      setRemoving(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onSearch(item.trackingNumber);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className={`watch-item${removing ? " link-item--deleting" : ""}`}>
      <div className="watch-item-info">
        <span className="watch-tn">{item.trackingNumber}</span>
        <span className="watch-status">
          {item.lastStatus || "Đang cập nhật"}
        </span>
        {item.lastCheckpointTime && (
          <span className="watch-time">
            Cập nhật: {formatTime(item.lastCheckpointTime, false)}
          </span>
        )}
      </div>
      <div className="watch-item-actions">
        <button
          className="btn-icon"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Tra cứu ngay"
          aria-label="Tra cứu ngay"
        >
          {refreshing ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
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
          )}
        </button>
        <button
          className="btn-icon btn-danger"
          onClick={handleRemove}
          disabled={removing}
          title="Dừng theo dõi"
          aria-label="Dừng theo dõi"
        >
          {removing ? (
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

export default function WatchList({ items, userId, onSearch, onRemove }) {
  if (items.length === 0) {
    return (
      <div className="watchlist-empty">
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M24 6C14 6 6 14.5 4 24c2 9.5 10 18 20 18s18-8.5 20-18C42 14.5 34 6 24 6z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="24" cy="24" r="6" stroke="currentColor" strokeWidth="2" />
        </svg>
        <p>
          Chưa theo dõi đơn nào. Tra cứu và bấm "Theo dõi" để nhận thông báo.
        </p>
      </div>
    );
  }

  return (
    <div className="watchlist">
      <h3 className="watchlist-title">Đang theo dõi ({items.length})</h3>
      <div className="watchlist-items">
        {items.map((item) => (
          <WatchItem
            key={item.trackingNumber}
            item={item}
            userId={userId}
            onSearch={onSearch}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
}
