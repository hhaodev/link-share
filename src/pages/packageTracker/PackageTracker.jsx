import { useEffect, useRef, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Alert, Modal, Space, Typography } from "antd";
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

  const isFirstVisit = useRef(true);
  const [isPolling, setIsPolling] = useState(true);

  async function handleSearch(trackingNumber, options = {}) {
    const { updateUrl = true, saveHistory = true } = options;
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
      if (user && saveHistory) {
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
      console.log("🚀 ~ handleSearch ~ err:", err);
      setSearchError(
        err.message || "Không thể tra cứu. Kiểm tra lại mã vận đơn.",
      );
    } finally {
      setSearchLoading(false);
    }
  }

  useEffect(() => {
    const syncTrackingFromUrl = () => {
      if (trackingNumber) {
        handleSearch(trackingNumber, {
          updateUrl: false,
          saveHistory: false,
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
    if (activeView !== "detail" || !result.trackingNumber) return undefined;

    const intervalId = window.setInterval(() => {
      refreshOpenDetail(result.trackingNumber);
    }, VITE_INTERVAL_REFRESH_DETAIL);

    return () => window.clearInterval(intervalId);
  }, [activeView, result.trackingNumber]);

  useEffect(() => {
    if (!user) return undefined;

    refreshwatchList();
    const intervalId = window.setInterval(
      refreshwatchList,
      VITE_INTERVAL_REFRESH_DETAIL,
    );
    return () => window.clearInterval(intervalId);
  }, [user?.uid, watchedItems.map((item) => item.trackingNumber).join(",")]);

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
