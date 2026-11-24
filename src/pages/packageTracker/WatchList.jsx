import {
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { Button, Empty, Input, List, message, Space, Typography } from "antd";
import useTrackingListActions from "../../hooks/useTrackingListActions";
import useTrackingNickname from "../../hooks/useTrackingNickname";
import { timeAgo } from "../../utils/helpers";

const { Text } = Typography;

function WatchItem({ item, onSearch, onRemove }) {
  const { deleting, searching, handleDelete, handleSearch } =
    useTrackingListActions({
      collectionName: "watchlist",
      trackingNumber: item.trackingNumber,
      onSearch,
      onDelete: onRemove,
    });
  const nicknameEditor = useTrackingNickname(
    item.trackingNumber,
    item.nickname,
  );

  async function handleCopyTrackingNumber() {
    try {
      await navigator?.clipboard?.writeText(item.trackingNumber);
      message.success("Đã sao chép mã vận đơn");
    } catch (error) {
      console.error("Failed to copy tracking number:", error);
      message.error("Không thể sao chép mã vận đơn");
    }
  }

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
            aria-label="Dừng theo dõi"
            style={{
              background: "#2b2b2b34",
            }}
          />
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
        {nicknameEditor.editing ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Input
              autoFocus
              size="small"
              maxLength={60}
              placeholder="Tên gợi nhớ"
              value={nicknameEditor.nickname}
              onChange={(event) =>
                nicknameEditor.setNickname(event.target.value)
              }
              onPressEnter={nicknameEditor.saveNickname}
              onKeyDown={(event) => {
                if (event.key === "Escape") nicknameEditor.cancelEditing();
              }}
              disabled={nicknameEditor.saving}
              style={{ width: 180, fontWeight: 600 }}
            />
            <Button
              type="text"
              size="small"
              icon={<CheckOutlined />}
              loading={nicknameEditor.saving}
              aria-label="Lưu tên gợi nhớ"
              onClick={nicknameEditor.saveNickname}
            />
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              disabled={nicknameEditor.saving}
              aria-label="Hủy đổi tên"
              onClick={nicknameEditor.cancelEditing}
            />
          </div>
        ) : (
          item.nickname && (
            <Space size={2}>
              <Text
                strong
                ellipsis
                onClick={handleSearch}
                style={{ cursor: "pointer" }}
              >
                {item.nickname}
              </Text>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={nicknameEditor.startEditing}
                aria-label="Đặt tên gợi nhớ"
              />
            </Space>
          )
        )}
        <Space size={2}>
          <Text className="watch-tn" onClick={handleSearch}>
            {item.trackingNumber}
          </Text>
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={handleCopyTrackingNumber}
            aria-label="Sao chép mã vận đơn"
          />
          {!nicknameEditor.editing && !item.nickname && (
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={nicknameEditor.startEditing}
              aria-label="Đặt tên gợi nhớ"
            />
          )}
        </Space>
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

export default function WatchList({ items, onSearch, onRemove }) {
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
          onSearch={onSearch}
          onRemove={onRemove}
        />
      )}
    />
  );
}
