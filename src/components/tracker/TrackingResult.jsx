import { useState } from "react";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { formatTime, getStatusClass } from "../../utils/helpers";

function LocationBlock({ label, loc }) {
  if (!loc?.name && !loc?.address) return null;
  return (
    <div className="timeline-location-block">
      <span className="timeline-location-label">{label}</span>
      {loc.name && <span className="timeline-location-name">{loc.name}</span>}
      {loc.address && (
        <span className="timeline-location-addr">{loc.address}</span>
      )}
      {loc.lat && loc.lng && (
        <a
          className="timeline-location-map"
          href={`https://maps.google.com/?q=${loc.lat},${loc.lng}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Xem bản đồ ↗
        </a>
      )}
    </div>
  );
}

function CheckpointItem({ cp, isLatest }) {
  const hasCurrentLoc = cp.currentLocation?.name || cp.currentLocation?.address;
  const hasNextLoc = cp.nextLocation?.name || cp.nextLocation?.address;
  const hasDetail = hasCurrentLoc || hasNextLoc;

  return (
    <div className={`timeline-item${isLatest ? " timeline-item--latest" : ""}`}>
      <div className="timeline-dot" />
      <div className="timeline-content">
        <div className="timeline-main">
          <p className="timeline-desc">{cp.description}</p>
          <p className="timeline-time">{formatTime(cp.time)}</p>
        </div>

        {cp.milestoneName && (
          <span
            className={`timeline-milestone ${getStatusClass(cp.description)}`}
          >
            {cp.milestoneName}
          </span>
        )}

        {hasDetail && (
          <div className="timeline-detail">
            {hasCurrentLoc && (
              <LocationBlock label="Vị trí hiện tại" loc={cp.currentLocation} />
            )}
            {hasNextLoc && (
              <LocationBlock label="Điểm tiếp theo" loc={cp.nextLocation} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrackingResult({
  result,
  userId,
  watchedMap,
  onWatchChange,
}) {
  const { trackingNumber, status, checkpoints } = result;
  const isWatching = !!watchedMap[trackingNumber];
  const [toggling, setToggling] = useState(false);

  async function handleToggleWatch() {
    setToggling(true);
    try {
      const ref = doc(db, "users", userId, "watchlist", trackingNumber);
      if (isWatching) {
        await deleteDoc(ref);
        onWatchChange(trackingNumber, false);
      } else {
        const latest = checkpoints[0] ?? null;
        await setDoc(ref, {
          trackingNumber,
          lastCheckpointTime: latest?.time ?? "",
          lastStatus: latest?.description ?? "",
          addedAt: serverTimestamp(),
        });
        onWatchChange(trackingNumber, true);
      }
    } catch (err) {
      console.error("Failed to toggle watch:", err);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="tracking-result">
      <div className="result-header">
        <div className="result-tn">
          <span className="result-tn-label">Mã vận đơn</span>
          <span className="result-tn-value">{trackingNumber}</span>
        </div>
        <div className={`result-status ${getStatusClass(status)}`}>
          {status}
        </div>
        <button
          className={`btn-watch${isWatching ? " btn-watch--active" : ""}`}
          onClick={handleToggleWatch}
          disabled={toggling}
          title={isWatching ? "Dừng theo dõi" : "Theo dõi đơn này"}
        >
          {toggling ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <svg
              viewBox="0 0 20 20"
              fill={isWatching ? "currentColor" : "none"}
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M10 2C6.5 2 3.5 4.5 2.1 8c-.2.5-.2 1 0 1.5C3.5 13.5 6.5 16 10 16s6.5-2.5 7.9-6.5c.2-.5.2-1 0-1.5C16.5 4.5 13.5 2 10 2z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle
                cx="10"
                cy="9.5"
                r="2.5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          )}
          {isWatching ? "Đang theo dõi" : "Theo dõi"}
        </button>
      </div>

      <div className="timeline">
        {checkpoints.length === 0 ? (
          <p className="empty-state">Chưa có thông tin hành trình.</p>
        ) : (
          checkpoints.map((cp, i) => (
            <CheckpointItem key={i} cp={cp} isLatest={i === 0} />
          ))
        )}
      </div>
    </div>
  );
}
