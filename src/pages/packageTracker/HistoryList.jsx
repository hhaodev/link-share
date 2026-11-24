import { Button, List, Space, Typography } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import useTrackingListActions from "../../hooks/useTrackingListActions";

const { Text } = Typography;

function HistoryItem({ item, watchedItems, onSearch, onDelete }) {
  const watchedItem = watchedItems.find(
    (watched) => watched.trackingNumber === item.trackingNumber,
  );
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
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            loading={deleting}
            onClick={handleDelete}
            aria-label="Xóa khỏi lịch sử"
            style={{
              background: "#2b2b2b34",
              flexShrink: 0,
            }}
          />
        </Space>
      }
    >
      <Text className="watch-tn" onClick={handleSearch}>
        {item.trackingNumber}
        {`${watchedItem?.nickname ? ` - ${watchedItem.nickname}` : ""}`}
      </Text>
    </List.Item>
  );
}

export default function HistoryList({
  items,
  watchedItems = [],
  onSearch,
  onDelete,
}) {
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
          watchedItems={watchedItems}
          onSearch={onSearch}
          onDelete={onDelete}
        />
      )}
    />
  );
}
