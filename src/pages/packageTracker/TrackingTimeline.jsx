import { Alert, Card, Space, Spin, Tag, Timeline, Typography } from "antd";
import { formatTime } from "../../utils/helpers";

const { Text, Link } = Typography;

function LocationBlock({ label, location }) {
  if (!location?.name && !location?.address) return null;

  return (
    <div className="timeline-location-block">
      <span className="timeline-location-label">{label}</span>
      {location.name && (
        <span className="timeline-location-name">{location.name}</span>
      )}
      {location.address && (
        <span className="timeline-location-addr">{location.address}</span>
      )}
      {location.lat && location.lng && (
        <Link
          className="timeline-location-map"
          href={`https://maps.google.com/?q=${location.lat},${location.lng}`}
          target="_blank"
        >
          Xem bản đồ ↗
        </Link>
      )}
    </div>
  );
}

export default function TrackingTimeline({ checkpoints, loading, error }) {
  const items = checkpoints.map((checkpoint, index) => {
    const currentLocation = checkpoint.currentLocation;
    const nextLocation = checkpoint.nextLocation;
    const hasCurrentLocation =
      currentLocation?.name || currentLocation?.address;
    const hasNextLocation = nextLocation?.name || nextLocation?.address;

    return {
      color:
        index === 0 ? "var(--app-accent)" : "var(--app-text-secondary)",
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
            <div className="timeline-location-panel">
              {hasCurrentLocation && (
                <LocationBlock
                  label="Vị trí hiện tại"
                  location={currentLocation}
                />
              )}
              {hasNextLocation && (
                <LocationBlock label="Điểm tiếp theo" location={nextLocation} />
              )}
            </div>
          )}
        </Space>
      ),
    };
  });

  return (
    <Card
      title={
        <Space>
          <Text strong>Hành trình vận chuyển</Text>
        </Space>
      }
      style={{ width: "100%" }}
    >
      {loading ? (
        <div style={{ padding: 24, textAlign: "center" }}>
          <Spin />
        </div>
      ) : error ? (
        <Alert message="Có lỗi xảy ra khi tải thông tin." type="error" showIcon />
      ) : checkpoints.length === 0 ? (
        <Text type="secondary">Chưa có thông tin hành trình.</Text>
      ) : (
        <Timeline items={items} />
      )}
    </Card>
  );
}
