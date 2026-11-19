import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../../firebase";
import { fetchTracking } from "../../utils/spxApi";
import LoginScreen from "./LoginScreen";
import TrackingForm from "./TrackingForm";
import TrackingResult from "./TrackingResult";
import WatchList from "./WatchList";
import HistoryList from "./HistoryList";

function CollectionSkeleton({ title }) {
  return (
    <div className="watchlist">
      <div className="watchlist-title-row" style={{ marginBottom: 10 }}>
        <div
          className="skel"
          style={{ height: 15, width: 160, borderRadius: 6 }}
        />
      </div>
      <div className="watchlist-items">
        {[1, 2, 3].map((i) => (
          <div key={i} className="watch-item">
            <div className="watch-item-info">
              <div
                className="skel"
                style={{ height: 14, width: "55%", borderRadius: 4 }}
              />
              <div
                className="skel"
                style={{
                  height: 12,
                  width: "40%",
                  borderRadius: 4,
                  marginTop: 4,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PackageTracker() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [listTab, setListTab] = useState("watch"); // "watch" | "history"

  // Tracking state
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [result, setResult] = useState(null);

  // Watchlist
  const [watchedItems, setWatchedItems] = useState([]);
  const [watchedMap, setWatchedMap] = useState({});
  const [loadingWatch, setLoadingWatch] = useState(false);

  // History
  const [historyItems, setHistoryItems] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // Watchlist listener
  useEffect(() => {
    if (!user) {
      setWatchedItems([]);
      setWatchedMap({});
      return;
    }
    setLoadingWatch(true);
    const q = query(
      collection(db, "users", user.uid, "watchlist"),
      orderBy("addedAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setWatchedItems(items);
      const map = {};
      items.forEach((i) => {
        map[i.trackingNumber] = true;
      });
      setWatchedMap(map);
      setLoadingWatch(false);
    });
    return unsub;
  }, [user]);

  // History listener
  useEffect(() => {
    if (!user) {
      setHistoryItems([]);
      return;
    }
    setLoadingHistory(true);
    const q = query(
      collection(db, "users", user.uid, "history"),
      orderBy("searchedAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setHistoryItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingHistory(false);
    });
    return unsub;
  }, [user]);

  async function handleSearch(trackingNumber) {
    setSearchLoading(true);
    setSearchError("");
    setResult(null);
    try {
      const data = await fetchTracking(trackingNumber);
      setResult(data);

      // Lưu vào history (upsert — dùng tn làm doc id để tránh trùng)
      if (user) {
        await setDoc(
          doc(db, "users", user.uid, "history", data.trackingNumber),
          {
            trackingNumber: data.trackingNumber,
            lastStatus: data.status,
            searchedAt: serverTimestamp(),
          },
        );
      }
    } catch (err) {
      setSearchError(
        err.message || "Không thể tra cứu. Kiểm tra lại mã vận đơn.",
      );
    } finally {
      setSearchLoading(false);
    }
  }

  function handleWatchChange(trackingNumber, watching) {
    setWatchedMap((prev) => ({ ...prev, [trackingNumber]: watching }));
  }

  function handleRemoveWatch(trackingNumber) {
    setWatchedMap((prev) => {
      const n = { ...prev };
      delete n[trackingNumber];
      return n;
    });
  }

  function handleDeleteHistory(trackingNumber) {
    setHistoryItems((prev) =>
      prev.filter((i) => i.trackingNumber !== trackingNumber),
    );
  }

  if (authLoading) {
    return (
      <div className="tracker-loading">
        <span className="spinner" aria-hidden="true" />
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <div className="tracker-page">
      {/* User bar */}
      <div className="tracker-user-bar">
        <img
          src={user.photoURL}
          alt={user.displayName}
          className="user-avatar"
          width="28"
          height="28"
        />
        <div className="tracker-user-name-info">
          <span className="user-name">{user.displayName}</span>
          <span className="user-email">{user.email}</span>
        </div>
        <button className="btn-signout" onClick={() => signOut(auth)}>
          Đăng xuất
        </button>
      </div>

      {/* Search */}
      <section className="tracker-section">
        <TrackingForm onSearch={handleSearch} loading={searchLoading} />
        {searchError && <p className="tracker-error">{searchError}</p>}
        {result && (
          <TrackingResult
            result={result}
            userId={user.uid}
            watchedMap={watchedMap}
            onWatchChange={handleWatchChange}
          />
        )}
      </section>

      {/* Watchlist + History tabs */}
      <section className="tracker-section">
        <div className="list-tabs">
          <button
            className={`list-tab-btn${listTab === "watch" ? " list-tab-btn--active" : ""}`}
            onClick={() => setListTab("watch")}
          >
            Đang theo dõi
            {!loadingWatch && watchedItems.length > 0 && (
              <span className="list-tab-badge">{watchedItems.length}</span>
            )}
          </button>
          <button
            className={`list-tab-btn${listTab === "history" ? " list-tab-btn--active" : ""}`}
            onClick={() => setListTab("history")}
          >
            Lịch sử
            {!loadingHistory && historyItems.length > 0 && (
              <span className="list-tab-badge">{historyItems.length}</span>
            )}
          </button>
        </div>

        {listTab === "watch" ? (
          loadingWatch ? (
            <CollectionSkeleton />
          ) : (
            <WatchList
              items={watchedItems}
              userId={user.uid}
              onSearch={handleSearch}
              onRemove={handleRemoveWatch}
            />
          )
        ) : loadingHistory ? (
          <CollectionSkeleton />
        ) : (
          <HistoryList
            items={historyItems}
            userId={user.uid}
            onSearch={handleSearch}
            onDelete={handleDeleteHistory}
          />
        )}
      </section>
    </div>
  );
}
