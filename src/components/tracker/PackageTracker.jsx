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
  Button,
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
import TrackingResult from "./TrackingResult";
import WatchList from "./WatchList";
import HistoryList from "./HistoryList";

const { Text } = Typography;

export default function PackageTracker() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [listTab, setListTab] = useState("watch");

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [result, setResult] = useState({ checkpoints: [] });
  const [openTrackingPanel, setOpenTrackingPanel] = useState(false);

  const watchlist = useUserCollection(user?.uid, "watchlist", "addedAt");
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

  async function handleSearch(trackingNumber) {
    setSearchLoading(true);
    setSearchError("");
    setResult({ checkpoints: [] });
    try {
      const data = await fetchTracking(trackingNumber);
      setResult(data);
      setOpenTrackingPanel(true);
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
            <Avatar src={user.photoURL} size={32} />
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
          <Button icon={<LogoutOutlined />} onClick={handleSignOut}>
            Đăng xuất
          </Button>
        </Space>

        {/* Search */}
        {profileError && <Alert message={profileError} type="error" showIcon />}
        <TrackingForm onSearch={handleSearch} loading={searchLoading} />
        {searchError && <Alert message={searchError} type="error" showIcon />}

        {/* Watch / History tabs */}
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
        <TrackingResult
          key={result.trackingNumber || "empty"}
          trackingPanelStatus={openTrackingPanel}
          onClose={() => setOpenTrackingPanel(false)}
          result={result}
          watchedItems={watchedItems}
          watchedMap={watchedMap}
          onWatchChange={handleWatchChange}
        />
      </Space>
    </UserContext.Provider>
  );
}
