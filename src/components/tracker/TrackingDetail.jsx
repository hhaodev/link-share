import { useState } from "react";
import {
  Button,
  Card,
  Input,
  Space,
  Tag,
  Timeline,
  Typography,
  Alert,
  Spin,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  BellFilled,
  BellOutlined,
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useUser } from "../../contexts/UserContext";
import useTrackingNickname from "../../hooks/useTrackingNickname";
import { formatTime } from "../../utils/helpers";

const { Text, Link } = Typography;

function LocationBlock({ label, loc }) {
  if (!loc?.name && !loc?.address) return null;
  return (
    <div className="timeline-location-block">
      <span className="timeline-location-label">{label}</span>
      {loc.name && <span className="timeline-location-name">{loc.name}</span>}
      {loc.address && (
        <span className="timeline-location-addr">{loc.address}</span>
      )}
      {loc.lat && loc.lng && (
        <Link
          className="timeline-location-map"
          href={`https://maps.google.com/?q=${loc.lat},${loc.lng}`}
          target="_blank"
        >
          Xem bản đồ ↗
        </Link>
      )}
    </div>
  );
}

export default function TrackingDetail({
  result,
  watchedItems,
  watchedMap,
  onWatchChange,
  onBack,
  loading,
  error,
}) {
  const user = useUser();
  const { trackingNumber, status } = result;
  const checkpoints = result.checkpoints ?? [];
  const isWatching = !!watchedMap[trackingNumber];
  const watchedItem = watchedItems.find(
    (item) => item.trackingNumber === trackingNumber,
  );
  const nicknameEditor = useTrackingNickname(
    trackingNumber,
    watchedItem?.nickname,
  );
  const [toggling, setToggling] = useState(false);

  async function handleToggleWatch() {
    setToggling(true);
    try {
      const ref = doc(db, "users", user.uid, "watchlist", trackingNumber);
      if (isWatching) {
        await deleteDoc(ref);
        onWatchChange(trackingNumber, false);
      } else {
        const latest = checkpoints[0] ?? null;
        await setDoc(ref, {
          trackingNumber,
          lastCheckpointTime: latest?.time ?? "",
          lastStatus: latest?.description ?? "",
          addedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        onWatchChange(trackingNumber, true);
      }
    } catch (error) {
      console.error("Failed to toggle watch:", error);
      message.error(
        "Không thể cập nhật trạng thái theo dõi. Vui lòng thử lại.",
      );
    } finally {
      setToggling(false);
    }
  }

  async function handleCopyTrackingNumber() {
    try {
      await navigator?.clipboard?.writeText(trackingNumber);
      message.success("Đã sao chép mã vận đơn");
    } catch (error) {
      console.error("Failed to copy tracking number:", error);
      message.error("Không thể sao chép mã vận đơn");
    }
  }

  const timelineItems = checkpoints.map((checkpoint, index) => {
    const currentLocation = checkpoint.currentLocation;
    const nextLocation = checkpoint.nextLocation;
    const hasCurrentLocation =
      currentLocation?.name || currentLocation?.address;
    const hasNextLocation = nextLocation?.name || nextLocation?.address;

    return {
      color: index === 0 ? "purple" : "gray",
      content: (
        <Space vertical style={{ width: "100%" }}>
          <Text strong={index === 0} style={{ wordBreak: "break-word" }}>
            {checkpoint.description}
          </Text>
          <Space style={{ marginTop: 4 }}>
            {checkpoint.milestoneName && <Tag>{checkpoint.milestoneName}</Tag>}
            <Text type="secondary" style={{ fontSize: 12 }}>
              {formatTime(checkpoint.time)}
            </Text>
          </Space>
          {(hasCurrentLocation || hasNextLocation) && (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flex: 1,
                flexDirection: "column",
                gap: 8,
                background: "#000",
                border: "1px solid rgb(85, 85, 85)",
                borderRadius: 6,
                padding: "8px 10px",
              }}
            >
              {hasCurrentLocation && (
                <LocationBlock label="Vị trí hiện tại" loc={currentLocation} />
              )}
              {hasNextLocation && (
                <LocationBlock label="Điểm tiếp theo" loc={nextLocation} />
              )}
            </div>
          )}
        </Space>
      ),
    };
  });

  return (
    <Space vertical size={16} style={{ width: "100%" }}>
      <Space
        style={{
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
          Quay lại
        </Button>
        <Button
          type={isWatching ? "primary" : "default"}
          loading={toggling}
          icon={isWatching ? <BellFilled /> : <BellOutlined />}
          onClick={handleToggleWatch}
        >
          {isWatching ? "Bỏ theo dõi" : "Theo dõi đơn này"}
        </Button>
      </Space>
      <Card
        title={
          <Space
            vertical
            size={6}
            style={{
              paddingTop: 10,
              paddingBottom: 10,
            }}
          >
            {nicknameEditor.editing ? (
              <Space>
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
                  disabled={nicknameEditor.saving}
                  style={{ width: 180, fontWeight: 600 }}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<CheckOutlined />}
                  loading={nicknameEditor.saving}
                  onClick={nicknameEditor.saveNickname}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  disabled={nicknameEditor.saving}
                  onClick={nicknameEditor.cancelEditing}
                />
              </Space>
            ) : (
              <Space size={4} vertical>
                {watchedItem?.nickname && (
                  <Space size={2}>
                    <Text strong>{watchedItem.nickname}</Text>
                    {isWatching && (
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={nicknameEditor.startEditing}
                        aria-label="Đặt tên gợi nhớ"
                      />
                    )}
                  </Space>
                )}
                <Space>
                  <Text type="secondary" className="watch-tn">
                    <Button
                      type="link"
                      size="small"
                      className="watch-tn"
                      style={{ padding: 0, height: "auto" }}
                    >
                      {trackingNumber}
                    </Button>
                  </Text>
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={handleCopyTrackingNumber}
                    aria-label="Sao chép mã vận đơn"
                  />
                  {!watchedItem?.nickname && isWatching && (
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={nicknameEditor.startEditing}
                      aria-label="Đặt tên gợi nhớ"
                    />
                  )}
                </Space>
              </Space>
            )}
            {status && (
              <Tag
                style={{
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  maxWidth: "100%",
                  display: "inline-block",
                }}
              >
                {status}
              </Tag>
            )}
          </Space>
        }
      >
        {loading ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            <Spin />
          </div>
        ) : error ? (
          <Alert message={error} type="error" showIcon />
        ) : checkpoints.length === 0 ? (
          <Text type="secondary">Chưa có thông tin hành trình.</Text>
        ) : (
          <Timeline items={timelineItems} />
        )}
      </Card>
    </Space>
  );
}
