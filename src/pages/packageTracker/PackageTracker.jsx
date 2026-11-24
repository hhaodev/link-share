import { useEffect, useRef, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Alert, message, Modal, Space, Typography } from "antd";
import { db } from "../../firebase";
import { useUser, useUserContext } from "../../contexts/UserContext";
import useUserCollection from "../../hooks/useUserCollection";
import { fetchTracking } from "../../utils/spxApi";
import LoginScreen from "./LoginScreen";
import TrackingForm from "./TrackingForm";
import TrackingDetail from "./TrackingDetail";
import TrackerAccountBar from "./TrackerAccountBar";
import TrackerLists from "./TrackerLists";
import { useGlobal } from "../../contexts/GlobalContext";

const VITE_INTERVAL_REFRESH_DETAIL = 60 * 1000; // 60 seconds

function saveSearchHistory(userId, data) {
  return setDoc(doc(db, "users", userId, "history", data.trackingNumber), {
    trackingNumber: data.trackingNumber,
    lastStatus: data.status,
    searchedAt: serverTimestamp(),
  });
}

export default function PackageTracker() {
  const user = useUser();
  const { authLoading } = useUserContext();
  const { trackingNumber, setTrackingNumber } = useGlobal();
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [result, setResult] = useState({ checkpoints: [] });
  const [activeView, setActiveView] = useState("list");

  const watchList = useUserCollection(user?.uid, "watchlist", "updatedAt");
  const history = useUserCollection(user?.uid, "history", "searchedAt");
  const watchedItems = watchList.items;
  const historyItems = history.items;
  const watchedMap = Object.fromEntries(
    watchedItems.map((item) => [item.trackingNumber, true]),
  );

  const trackingFormRef = useRef();
  const userRef = useRef(user);
  const pendingHistoryRef = useRef(new Map());

  const isFirstVisit = useRef(true);
  const [isPolling, setIsPolling] = useState(true);
  const [isPageVisible, setIsPageVisible] = useState(
    () => document.visibilityState === "visible",
  );
  const refreshOpenDetailRef = useRef(null);

  async function handleSearch(trackingNumber, options = {}) {
    const { updateUrl = true } = options;
    const normalizedTrackingNumber = trackingNumber.trim().toUpperCase();

    if (updateUrl) {
      setTrackingNumber(normalizedTrackingNumber);
    }
    trackingFormRef.current.setValue(normalizedTrackingNumber);
    setActiveView("detail");
    setSearchLoading(true);
    setSearchError("");
    setResult({ trackingNumber: normalizedTrackingNumber, checkpoints: [] });
    try {
      const data = await fetchTracking(normalizedTrackingNumber);
      setResult(data);
      const currentUser = userRef.current;
      if (currentUser?.uid) {
        await saveSearchHistory(currentUser.uid, data);
      } else {
        pendingHistoryRef.current.set(data.trackingNumber, data);
      }
    } catch (err) {
      console.error("Failed to search tracking or save history:", err);
      setSearchError(
        err.message || "Không thể tra cứu. Kiểm tra lại mã vận đơn.",
      );
    } finally {
      setSearchLoading(false);
    }
  }

  useEffect(() => {
    userRef.current = user;
    if (!user?.uid || pendingHistoryRef.current.size === 0) {
      return undefined;
    }

    let active = true;
    async function flushPendingHistory() {
      while (active && pendingHistoryRef.current.size > 0) {
        const [trackingNumber, data] =
          pendingHistoryRef.current.entries().next().value;
        try {
          await saveSearchHistory(user.uid, data);
          if (pendingHistoryRef.current.get(trackingNumber) === data) {
            pendingHistoryRef.current.delete(trackingNumber);
          }
        } catch (error) {
          console.error("Failed to save pending tracking history:", error);
          message.error("Không thể lưu lịch sử tra cứu.");
          return;
        }
      }
    }

    flushPendingHistory();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    const syncTrackingFromUrl = () => {
      if (trackingNumber) {
        handleSearch(trackingNumber, {
          updateUrl: false,
        });
      } else {
        setActiveView("list");
      }
    };

    syncTrackingFromUrl();
    window.addEventListener("popstate", syncTrackingFromUrl);
    return () => window.removeEventListener("popstate", syncTrackingFromUrl);
  }, []);

  async function refreshOpenDetail(trackingNumber) {
    if (document.visibilityState !== "visible") return;

    try {
      const data = await fetchTracking(trackingNumber);
      setResult((current) =>
        current.trackingNumber === data.trackingNumber ? data : current,
      );
      setSearchError("");
    } catch (error) {
      console.error("Failed to refresh tracking detail:", error);
    }
  }

  async function refreshwatchList() {
    if (document.visibilityState !== "visible") return;

    if (!user || watchedItems.length === 0) {
      setIsPolling(false);
      return;
    }
    if (isFirstVisit.current) {
      setIsPolling(true);
    }
    await Promise.allSettled(
      watchedItems.map(async (item) => {
        const data = await fetchTracking(item.trackingNumber);
        const latestCheckpoint = data.checkpoints?.[0] ?? null;
        const latestCheckpointTime = latestCheckpoint?.time ?? "";
        const latestStatus =
          latestCheckpoint?.description || data.status || "Đang cập nhật";

        const hasChanged =
          item.lastCheckpointTime !== latestCheckpointTime ||
          item.lastStatus !== latestStatus;

        if (!hasChanged) return;

        const updates = {
          trackingNumber: data.trackingNumber,
          lastCheckpointTime: latestCheckpointTime,
          lastStatus: latestStatus,
          updatedAt: serverTimestamp(),
        };

        const localUpdates = {
          ...updates,
          updatedAt: new Date(),
        };

        await setDoc(
          doc(db, "users", user.uid, "watchlist", data.trackingNumber),
          updates,
          { merge: true },
        );

        watchList.updateItems((items) =>
          items
            .map((watchedItem) =>
              watchedItem.trackingNumber === data.trackingNumber
                ? { ...watchedItem, ...localUpdates }
                : watchedItem,
            )
            .sort((a, b) => {
              const aTime =
                a.updatedAt?.toMillis?.() ?? a.updatedAt?.getTime?.() ?? 0;
              const bTime =
                b.updatedAt?.toMillis?.() ?? b.updatedAt?.getTime?.() ?? 0;
              return bTime - aTime;
            }),
        );
      }),
    );
    setIsPolling(false);
    isFirstVisit.current = false;
  }

  useEffect(() => {
    refreshOpenDetailRef.current =
      activeView === "detail" && result.trackingNumber
        ? () => refreshOpenDetail(result.trackingNumber)
        : null;
  });

  useEffect(() => {
    let wasHidden = document.visibilityState !== "visible";
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === "visible";
      setIsPageVisible(visible);
      if (!visible) {
        wasHidden = true;
      } else if (wasHidden) {
        wasHidden = false;
        refreshOpenDetailRef.current?.();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (
      !isPageVisible ||
      activeView !== "detail" ||
      !result.trackingNumber
    ) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      refreshOpenDetail(result.trackingNumber);
    }, VITE_INTERVAL_REFRESH_DETAIL);

    return () => window.clearInterval(intervalId);
  }, [isPageVisible, activeView, result.trackingNumber]);

  useEffect(() => {
    if (!isPageVisible || !user) return undefined;

    refreshwatchList();
    const intervalId = window.setInterval(
      refreshwatchList,
      VITE_INTERVAL_REFRESH_DETAIL,
    );
    return () => window.clearInterval(intervalId);
  }, [
    isPageVisible,
    user?.uid,
    watchedItems.map((item) => item.trackingNumber).join(","),
  ]);

  function handleWatchChange(trackingNumber, watching) {
    watchList.updateItems((items) => {
      if (!watching) {
        return items.filter((item) => item.trackingNumber !== trackingNumber);
      }
      if (items.some((item) => item.trackingNumber === trackingNumber)) {
        return items;
      }
      return [...items, { trackingNumber }];
    });
  }

  function handleRemoveWatch(trackingNumber) {
    watchList.updateItems((items) =>
      items.filter((item) => item.trackingNumber !== trackingNumber),
    );
  }

  function handleDeleteHistory(trackingNumber) {
    history.updateItems((items) =>
      items.filter((item) => item.trackingNumber !== trackingNumber),
    );
  }

  return (
    <div className="tracker-page">
      <TrackerAccountBar onSignIn={() => setLoginModalOpen(true)} />
      <section>
        <div className="tracker-search-panel">
          <div className="tracker-search-heading">
            <div>
              <Typography.Text className="tracker-search-label">
                TRA CỨU VẬN ĐƠN
              </Typography.Text>
            </div>
          </div>
          <TrackingForm
            ref={trackingFormRef}
            onSearch={handleSearch}
            loading={searchLoading}
          />
        </div>
      </section>

      {activeView === "detail" && (
        <TrackingDetail
          key={result.trackingNumber || "empty"}
          result={result}
          watchedItems={watchedItems}
          watchedMap={watchedMap}
          onWatchChange={handleWatchChange}
          onSignIn={() => setLoginModalOpen(true)}
          onBack={() => {
            setTrackingNumber("");
            setActiveView("list");
            trackingFormRef.current.clear();
          }}
          authLoading={authLoading}
          loading={searchLoading}
          error={searchError}
          watchList={watchList}
        />
      )}

      {activeView === "list" && user && (
        <TrackerLists
          watchList={watchList}
          history={history}
          watchedItems={watchedItems}
          historyItems={historyItems}
          onSearch={handleSearch}
          onRemoveWatch={handleRemoveWatch}
          onDeleteHistory={handleDeleteHistory}
          isPolling={isPolling}
        />
      )}

      <Modal
        open={loginModalOpen}
        footer={null}
        onCancel={() => setLoginModalOpen(false)}
        destroy
        centered
        width={300}
      >
        <LoginScreen onSuccess={() => setLoginModalOpen(false)} />
      </Modal>
    </div>
  );
}
