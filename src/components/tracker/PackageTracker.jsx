import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import {
  Avatar,
  Dropdown,
  Space,
  Spin,
  Tabs,
  Typography,
  Alert,
  Badge,
  message,
} from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import { auth, db } from "../../firebase";
import { UserContext } from "../../contexts/UserContext";
import useUserCollection from "../../hooks/useUserCollection";
import {
  disableNotification,
  getNotificationDeviceId,
  syncNotificationToken,
} from "../../firebase/notification";
import { fetchTracking } from "../../utils/spxApi";
import NotificationSettings from "../notificationSetting";
import LoginScreen from "./LoginScreen";
import TrackingForm from "./TrackingForm";
import WatchList from "./WatchList";
import HistoryList from "./HistoryList";
import TrackingDetail from "./TrackingDetail";

const { Text } = Typography;

const VITE_INTERVAL_REFRESH_DETAIL = 60 * 1000; // 60 seconds

export default function PackageTracker() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [listTab, setListTab] = useState("watch");

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [result, setResult] = useState({ checkpoints: [] });
  const [activeView, setActiveView] = useState("list");

  const watchlist = useUserCollection(user?.uid, "watchlist", "updatedAt");
  const history = useUserCollection(user?.uid, "history", "searchedAt");
  const watchedItems = watchlist.items;
  const historyItems = history.items;
  const watchedMap = Object.fromEntries(
    watchedItems.map((item) => [item.trackingNumber, true]),
  );
  const [notificationStatus, setNotificationStatus] = useState(null);
  const notificationsEnabled =
    notificationStatus?.userId === user?.uid
      ? notificationStatus?.enabled
      : null;
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      setProfileError("");
      if (u) {
        setDoc(
          doc(db, "users", u.uid),
          {
            uid: u.uid,
            displayName: u.displayName || "",
            email: u.email || "",
            photoURL: u.photoURL || "",
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        ).catch((error) => {
          console.error("Failed to save user profile:", error);
          setProfileError("Không thể lưu hồ sơ người dùng vào Firestore.");
        });
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;

    const userId = user.uid;
    const unsubscribe = onSnapshot(
      query(
        collection(db, "users", userId, "fcmTokens"),
        where("deviceId", "==", getNotificationDeviceId()),
      ),
      (snapshot) => {
        setNotificationStatus({
          userId,
          enabled: !snapshot.empty,
          error: null,
        });
      },
      (error) => {
        console.error("Failed to load notification status:", error);
        setNotificationStatus({ userId, enabled: null, error });
      },
    );
    syncNotificationToken(userId).catch((error) => {
      console.error("Failed to synchronize the FCM token:", error);
    });
    return unsubscribe;
  }, [user]);

  async function handleSignOut() {
    try {
      const tokenRevoked = await disableNotification(user.uid);
      if (!tokenRevoked) {
        message.warning(
          "Đã đăng xuất thiết bị khỏi nhận thông báo, nhưng chưa thu hồi được token cục bộ",
        );
      }
      await signOut(auth);
    } catch (error) {
      message.error(error.message || "Không thể đăng xuất");
    }
  }

  async function handleSearch(trackingNumber, options = {}) {
    const { updateUrl = true, saveHistory = true } = options;
    const normalizedTrackingNumber = trackingNumber.trim().toUpperCase();

    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("tracking", normalizedTrackingNumber);
      window.history.pushState({}, "", url);
    }

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
      setSearchError(
        err.message || "Không thể tra cứu. Kiểm tra lại mã vận đơn.",
      );
    } finally {
      setSearchLoading(false);
    }
  }

  useEffect(() => {
    const syncTrackingFromUrl = () => {
      const trackingNumber = new URLSearchParams(window.location.search).get(
        "tracking",
      );
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

  async function refreshWatchlist() {
    if (!user || watchedItems.length === 0) return;

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

        watchlist.updateItems((items) =>
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

    refreshWatchlist();
    const intervalId = window.setInterval(
      refreshWatchlist,
      VITE_INTERVAL_REFRESH_DETAIL,
    );
    return () => window.clearInterval(intervalId);
  }, [user?.uid, watchedItems.map((item) => item.trackingNumber).join(",")]);

  function handleWatchChange(trackingNumber, watching) {
    watchlist.updateItems((items) => {
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
    watchlist.updateItems((items) =>
      items.filter((item) => item.trackingNumber !== trackingNumber),
    );
  }

  function handleDeleteHistory(trackingNumber) {
    history.updateItems((items) =>
      items.filter((item) => item.trackingNumber !== trackingNumber),
    );
  }

  if (authLoading)
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spin />
      </div>
    );
  if (!user) return <LoginScreen />;

  const tabItems = [
    {
      key: "watch",
      label: (
        <Space size={6}>
          Đang theo dõi
          {!watchlist.loading && watchedItems.length > 0 && (
            <Badge count={watchedItems.length} color="purple" />
          )}
        </Space>
      ),
      children: watchlist.loading ? (
        <div style={{ padding: 24, textAlign: "center" }}>
          <Spin />
        </div>
      ) : (
        <WatchList
          items={watchedItems}
          onSearch={handleSearch}
          onRemove={handleRemoveWatch}
        />
      ),
    },
    {
      key: "history",
      label: (
        <Space size={6}>
          Lịch sử
          {!history.loading && historyItems.length > 0 && (
            <Badge count={historyItems.length} color="purple" />
          )}
        </Space>
      ),
      children: history.loading ? (
        <div style={{ padding: 24, textAlign: "center" }}>
          <Spin />
        </div>
      ) : (
        <HistoryList
          items={historyItems}
          watchedItems={watchedItems}
          onSearch={handleSearch}
          onDelete={handleDeleteHistory}
        />
      ),
    },
  ];

  return (
    <UserContext.Provider value={user}>
      <Space vertical size={16} style={{ width: "100%" }}>
        {/* User bar */}
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Space>
            <Dropdown
              trigger={["click"]}
              placement="bottomLeft"
              menu={{
                items: [
                  {
                    key: "sign-out",
                    icon: <LogoutOutlined />,
                    label: "Đăng xuất",
                    danger: true,
                  },
                ],
                onClick: ({ key }) => {
                  if (key === "sign-out") handleSignOut();
                },
              }}
            >
              <Avatar
                src={user.photoURL}
                size={32}
                style={{ cursor: "pointer" }}
              />
            </Dropdown>
            <div>
              <Space size={8} wrap>
                <Text strong>{user.displayName}</Text>
                {notificationsEnabled === null ? (
                  notificationStatus?.userId === user.uid &&
                  notificationStatus.error ? (
                    <Text type="danger" style={{ fontSize: 12 }}>
                      Không tải được trạng thái thông báo
                    </Text>
                  ) : (
                    <Spin size="small" />
                  )
                ) : (
                  <NotificationSettings
                    enabled={notificationsEnabled}
                    onChange={(enabled) =>
                      setNotificationStatus({ userId: user.uid, enabled })
                    }
                  />
                )}
              </Space>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {user.email}
                </Text>
              </div>
            </div>
          </Space>
        </Space>

        {/* Search / list or detail page */}
        {activeView === "detail" ? (
          <TrackingDetail
            key={result.trackingNumber || "empty"}
            result={result}
            watchedItems={watchedItems}
            watchedMap={watchedMap}
            onWatchChange={handleWatchChange}
            onBack={() => {
              const url = new URL(window.location.href);
              url.searchParams.delete("tracking");
              window.history.pushState({}, "", url);
              setActiveView("list");
            }}
            loading={searchLoading}
            error={searchError}
            watchlist={watchlist}
          />
        ) : (
          <>
            {profileError && (
              <Alert message={profileError} type="error" showIcon />
            )}
            <TrackingForm onSearch={handleSearch} loading={searchLoading} />
            {searchError && (
              <Alert message={searchError} type="error" showIcon />
            )}

            {watchlist.error && (
              <Alert
                type="error"
                showIcon
                message="Không thể tải danh sách theo dõi."
              />
            )}
            {history.error && (
              <Alert
                type="error"
                showIcon
                message="Không thể tải lịch sử tra cứu."
              />
            )}
            <Tabs
              activeKey={listTab}
              onChange={setListTab}
              items={tabItems}
              size="small"
            />
          </>
        )}
      </Space>
    </UserContext.Provider>
  );
}
