import { DeleteOutlined, EyeOutlined } from "@ant-design/icons";
import { Button, List, Space, Tooltip, Typography } from "antd";
import useTrackingListActions from "../../hooks/useTrackingListActions";

const { Text } = Typography;

function HistoryItem({ item, onSearch, onDelete }) {
  const { deleting, searching, handleDelete, handleSearch } =
    useTrackingListActions({
      collectionName: "history",
      trackingNumber: item.trackingNumber,
      onSearch,
      onDelete,
    });

  return (
    <List.Item
      extra={
        <Space vertical>
          <Tooltip title="Tra cứu lại" key="search">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              loading={searching}
              onClick={handleSearch}
            />
          </Tooltip>
          <Tooltip title="Xóa khỏi lịch sử" key="delete">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={deleting}
              onClick={handleDelete}
            />
          </Tooltip>
        </Space>
      }
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
      </div>
    </List.Item>
  );
}

export default function HistoryList({ items, onSearch, onDelete }) {
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
          onSearch={onSearch}
          onDelete={onDelete}
        />
      )}
    />
  );
}
