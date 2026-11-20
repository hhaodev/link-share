import { useState } from "react";
import { Card, Tag, Button, Timeline, Typography, Space, Tooltip } from "antd";
import { EyeOutlined, EyeInvisibleOutlined } from "@ant-design/icons";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
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
  result,
  userId,
  watchedMap,
  onWatchChange,
}) {
  const { trackingNumber, status, checkpoints } = result;
  const isWatching = !!watchedMap[trackingNumber];
  const [toggling, setToggling] = useState(false);
  const statusClass = getStatusClass(status);
  const tagStatus = STATUS_TAG[statusClass] ?? "default";

  async function handleToggleWatch() {
    setToggling(true);
    try {
      const ref = doc(db, "users", userId, "watchlist", trackingNumber);
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
      children: (
        <div>
          <Space
            style={{ width: "100%", justifyContent: "space-between" }}
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
    <Card
      size="small"
      title={
        <Space vertical style={{ paddingBottom: "10px", paddingTop: "10px" }}>
          <Space>
            <Text
              style={{
                fontSize: 12,
                opacity: 0.5,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Mã vận đơn
            </Text>
            <Text strong style={{ letterSpacing: "0.5px" }}>
              {trackingNumber}
            </Text>
          </Space>
          <Tag color={tagStatus}>{status}</Tag>
        </Space>
      }
      extra={
        <Space>
          <Tooltip title={isWatching ? "Dừng theo dõi" : "Theo dõi đơn này"}>
            <Button
              type={isWatching ? "primary" : "default"}
              size="small"
              loading={toggling}
              icon={isWatching ? <EyeOutlined /> : <EyeInvisibleOutlined />}
              onClick={handleToggleWatch}
            >
              {isWatching ? "Đang theo dõi" : "Theo dõi"}
            </Button>
          </Tooltip>
        </Space>
      }
    >
      {checkpoints.length === 0 ? (
        <Text type="secondary">Chưa có thông tin hành trình.</Text>
      ) : (
        <Timeline items={timelineItems} style={{ marginTop: 8 }} />
      )}
    </Card>
  );
}
