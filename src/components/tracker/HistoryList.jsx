import { useState } from "react";
import { List, Button, Typography, Tooltip } from "antd";
import { SearchOutlined, DeleteOutlined } from "@ant-design/icons";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { timeAgo } from "../../utils/helpers";

const { Text } = Typography;

function HistoryItem({ item, userId, onSearch, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const [searching, setSearching] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "users", userId, "history", item.trackingNumber));
      onDelete(item.trackingNumber);
    } catch {
      setDeleting(false);
    }
  }

  async function handleSearch() {
    setSearching(true);
    try {
      await onSearch(item.trackingNumber);
    } finally {
      setSearching(false);
    }
  }

  return (
    <List.Item
      actions={[
        <Tooltip title="Tra cứu lại" key="search">
          <Button
            type="text"
            size="small"
            icon={<SearchOutlined />}
            loading={searching}
            onClick={handleSearch}
          />
        </Tooltip>,
        <Tooltip title="Xóa khỏi lịch sử" key="delete">
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            loading={deleting}
            onClick={handleDelete}
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
        <Text className="watch-status">{item.lastStatus || "—"}</Text>
        {item.searchedAt && (
          <Text type="secondary" className="watch-time">
            {timeAgo(item.searchedAt?.toDate?.() ?? item.searchedAt)}
          </Text>
        )}
      </div>
    </List.Item>
  );
}

export default function HistoryList({ items, userId, onSearch, onDelete }) {
  if (items.length === 0) return null;

  return (
    <List
      size="small"
      bordered
      dataSource={items}
      renderItem={(item) => (
        <HistoryItem
          key={item.trackingNumber}
          item={item}
          userId={userId}
          onSearch={onSearch}
          onDelete={onDelete}
        />
      )}
    />
  );
}
