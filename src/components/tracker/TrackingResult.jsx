import { useState } from "react";
import {
  Card,
  Tag,
  Button,
  Input,
  Timeline,
  Typography,
  Space,
  Tooltip,
  Drawer,
  message,
} from "antd";
import {
  CheckOutlined,
  EditOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useUser } from "../../contexts/UserContext";
import useTrackingNickname from "../../hooks/useTrackingNickname";
import { formatTime, getStatusClass } from "../../utils/helpers";

const { Text, Link } = Typography;

const STATUS_TAG = {
  "status--green": "success",
  "status--blue": "processing",
  "status--red": "error",
  "status--gray": "default",
};

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

export default function TrackingResult({
  trackingPanelStatus,
  onClose,
  result,
  watchedItems,
  watchedMap,
  onWatchChange,
}) {
  const user = useUser();
  const { trackingNumber, status } = result;
  const checkpoints = result.checkpoints ?? [];
  const isWatching = !!watchedMap[trackingNumber];
  const watchedItem = watchedItems.find(
    (item) => item.trackingNumber === trackingNumber,
  );
  const [toggling, setToggling] = useState(false);
  const nicknameEditor = useTrackingNickname(
    trackingNumber,
    watchedItem?.nickname,
  );
  const statusClass = getStatusClass(status);
  const tagStatus = STATUS_TAG[statusClass] ?? "default";

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
        });
        onWatchChange(trackingNumber, true);
      }
    } catch (err) {
      console.error("Failed to toggle watch:", err);
      message.error("Không thể cập nhật trạng thái theo dõi. Vui lòng thử lại.");
    } finally {
      setToggling(false);
    }
  }

  const timelineItems = checkpoints.map((cp, i) => {
    const hasCurrentLoc =
      cp.currentLocation?.name || cp.currentLocation?.address;
    const hasNextLoc = cp.nextLocation?.name || cp.nextLocation?.address;

    return {
      color: i === 0 ? "purple" : "gray",
      content: (
        <div>
          <Space
            style={{
              width: "100%",
              maxWidth: "100%",
              justifyContent: "space-between",
            }}
            align="start"
          >
            <Text strong={i === 0}>{cp.description}</Text>
            <Text
              type="secondary"
              style={{ fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}
            >
              {formatTime(cp.time)}
            </Text>
          </Space>
          {cp.milestoneName && (
            <div style={{ marginTop: 4 }}>
              <Tag color={tagStatus}>{cp.milestoneName}</Tag>
            </div>
          )}
          {(hasCurrentLoc || hasNextLoc) && (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                background: "#000",
                border: "1px solid rgb(85, 85, 85)",
                borderRadius: 6,
                padding: "8px 10px",
              }}
            >
              {hasCurrentLoc && (
                <LocationBlock
                  label="Vị trí hiện tại"
                  loc={cp.currentLocation}
                />
              )}
              {hasNextLoc && (
                <LocationBlock label="Điểm tiếp theo" loc={cp.nextLocation} />
              )}
            </div>
          )}
        </div>
      ),
    };
  });

  return (
    <Drawer
      size={"100%"}
      open={trackingPanelStatus}
      onClose={onClose}
      mask={false}
      closable={false}
      title={
        <Space vertical size={6}>
          <Space size={4} vertical>
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
                    if (event.key === "Escape") {
                      nicknameEditor.cancelEditing();
                    }
                  }}
                  disabled={nicknameEditor.saving}
                  style={{ width: 180 }}
                />
                <div>
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
                    onClick={() => {
                      nicknameEditor.cancelEditing();
                    }}
                  />
                </div>
              </div>
            ) : (
              <div>
                {watchedItem?.nickname && (
                  <Text strong>{watchedItem.nickname}</Text>
                )}
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Mã vận đơn: {trackingNumber}
                  </Text>
                  {isWatching && (
                    <Tooltip title="Đặt tên gợi nhớ">
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        aria-label="Đặt tên gợi nhớ"
                        onClick={nicknameEditor.startEditing}
                      />
                    </Tooltip>
                  )}
                </div>
              </div>
            )}
          </Space>
          <Tag color={tagStatus}>{status}</Tag>
        </Space>
      }
      extra={
        <Space vertical>
          <Button size="small" icon={<CloseOutlined />} onClick={onClose} />
          <Tooltip title={isWatching ? "Dừng theo dõi" : "Theo dõi đơn này"}>
            <Button
              type={isWatching ? "primary" : "default"}
              size="small"
              loading={toggling}
              icon={isWatching ? <EyeOutlined /> : <EyeInvisibleOutlined />}
              onClick={handleToggleWatch}
            />
          </Tooltip>
        </Space>
      }
    >
      <Card size="small">
        {checkpoints.length === 0 ? (
          <Text type="secondary">Chưa có thông tin hành trình.</Text>
        ) : (
          <Timeline items={timelineItems} style={{ marginTop: 8 }} />
        )}
      </Card>
    </Drawer>
  );
}
