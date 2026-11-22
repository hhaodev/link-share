import { useState } from "react";
import { Badge, Space, Spin, Tabs } from "antd";
import WatchList from "./WatchList";
import HistoryList from "./HistoryList";

export default function TrackerLists({
  watchlist,
  history,
  watchedItems,
  historyItems,
  onSearch,
  onRemoveWatch,
  onDeleteHistory,
}) {
  const [activeTab, setActiveTab] = useState("watch");

  const items = [
    {
      key: "watch",
      label: (
        <Space size={6}>
          Đang theo dõi
          {!watchlist.loading && watchedItems.length > 0 && (
            <Badge count={watchedItems.length} color="var(--app-accent)" />
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
          onSearch={onSearch}
          onRemove={onRemoveWatch}
        />
      ),
    },
    {
      key: "history",
      label: (
        <Space size={6}>
          Lịch sử
          {!history.loading && historyItems.length > 0 && (
            <Badge count={historyItems.length} color="var(--app-accent)" />
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
          onSearch={onSearch}
          onDelete={onDeleteHistory}
        />
      ),
    },
  ];

  return (
    <Tabs
      className="tracker-tabs"
      activeKey={activeTab}
      onChange={setActiveTab}
      items={items}
    />
  );
}
