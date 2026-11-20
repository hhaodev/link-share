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
import {
  Avatar,
  Button,
  Space,
  Spin,
  Tabs,
  Typography,
  Alert,
  Badge,
} from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import { auth, db } from "../../firebase";
import { fetchTracking } from "../../utils/spxApi";
import LoginScreen from "./LoginScreen";
import TrackingForm from "./TrackingForm";
import TrackingResult from "./TrackingResult";
import WatchList from "./WatchList";
import HistoryList from "./HistoryList";

const { Text } = Typography;

export default function PackageTracker() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [listTab, setListTab] = useState("watch");

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [result, setResult] = useState({});
  const [openTrackingPanel, setOpenTrackingPanel] = useState(false);

  const [watchedItems, setWatchedItems] = useState([]);
  const [watchedMap, setWatchedMap] = useState({});
  const [loadingWatch, setLoadingWatch] = useState(false);

  const [historyItems, setHistoryItems] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

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
    setResult({});
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

  function handleWatchChange(tn, watching) {
    setWatchedMap((p) => ({ ...p, [tn]: watching }));
  }
  function handleRemoveWatch(tn) {
    setWatchedMap((p) => {
      const n = { ...p };
      delete n[tn];
      return n;
    });
  }
  function handleDeleteHistory(tn) {
    setHistoryItems((p) => p.filter((i) => i.trackingNumber !== tn));
  }

  if (authLoading)
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  if (!user) return <LoginScreen />;

  const tabItems = [
    {
      key: "watch",
      label: (
        <Space size={6}>
          Đang theo dõi
          {!loadingWatch && watchedItems.length > 0 && (
            <Badge count={watchedItems.length} color="purple" />
          )}
        </Space>
      ),
      children: loadingWatch ? (
        <div style={{ padding: 24, textAlign: "center" }}>
          <Spin />
        </div>
      ) : (
        <WatchList
          items={watchedItems}
          userId={user.uid}
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
          {!loadingHistory && historyItems.length > 0 && (
            <Badge count={historyItems.length} color="default" />
          )}
        </Space>
      ),
      children: loadingHistory ? (
        <div style={{ padding: 24, textAlign: "center" }}>
          <Spin />
        </div>
      ) : (
        <HistoryList
          items={historyItems}
          userId={user.uid}
          onSearch={handleSearch}
          onDelete={handleDeleteHistory}
        />
      ),
    },
  ];

  return (
    <Space vertical size={16} style={{ width: "100%" }}>
      {/* User bar */}
      <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
        <Space>
          <Avatar src={user.photoURL} size={32} />
          <div>
            <div>
              <Text strong>{user.displayName}</Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {user.email}
              </Text>
            </div>
          </div>
        </Space>
        <Button icon={<LogoutOutlined />} onClick={() => signOut(auth)}>
          Đăng xuất
        </Button>
      </Space>

      {/* Search */}
      <TrackingForm onSearch={handleSearch} loading={searchLoading} />
      {searchError && <Alert message={searchError} type="error" showIcon />}

      {/* Watch / History tabs */}
      <Tabs
        activeKey={listTab}
        onChange={setListTab}
        items={tabItems}
        size="small"
      />
      <TrackingResult
        trackingPanelStatus={openTrackingPanel}
        onClose={() => setOpenTrackingPanel(false)}
        result={result}
        userId={user.uid}
        watchedMap={watchedMap}
        onWatchChange={handleWatchChange}
      />
    </Space>
  );
}
