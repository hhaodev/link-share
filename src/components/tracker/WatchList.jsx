import { DeleteOutlined, EyeOutlined } from "@ant-design/icons";
import { Button, Empty, List, Tooltip, Typography } from "antd";
import { deleteDoc, doc } from "firebase/firestore";
import { useState } from "react";
import { db } from "../../firebase";
import { timeAgo } from "../../utils/helpers";

const { Text } = Typography;

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
    } catch {
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
    <List.Item
      actions={[
        <Tooltip title="Tra cứu ngay" key="refresh">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            loading={refreshing}
            onClick={handleRefresh}
          />
        </Tooltip>,
        <Tooltip title="Dừng theo dõi" key="remove">
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            loading={removing}
            onClick={handleRemove}
          />
        </Tooltip>,
      ]}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          minWidth: 0,
        }}
      >
        <Text strong className="watch-tn">
          {item.trackingNumber}
        </Text>
        <Text className="watch-status">
          {item.lastStatus || "Đang cập nhật"}
        </Text>
        {item.lastCheckpointTime && (
          <Text type="secondary" className="watch-time">
            Cập nhật: {timeAgo(item.lastCheckpointTime)}
          </Text>
        )}
      </div>
    </List.Item>
  );
}

export default function WatchList({ items, userId, onSearch, onRemove }) {
  if (items.length === 0) {
    return (
      <Empty
        description='Chưa theo dõi đơn nào. Tra cứu và bấm "Theo dõi" để nhận thông báo.'
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <List
      size="small"
      bordered
      dataSource={items}
      renderItem={(item) => (
        <WatchItem
          key={item.trackingNumber}
          item={item}
          userId={userId}
          onSearch={onSearch}
          onRemove={onRemove}
        />
      )}
    />
  );
}
