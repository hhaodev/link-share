import {
  ArrowLeftOutlined,
  BellFilled,
  BellOutlined,
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  EditOutlined,
  ShareAltOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Input,
  Space,
  Spin,
  Tag,
  Timeline,
  Typography,
  message,
} from "antd";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useState } from "react";
import { useUser } from "../../contexts/UserContext";
import { db } from "../../firebase";
import useTrackingNickname from "../../hooks/useTrackingNickname";
import { formatTime, timeAgo } from "../../utils/helpers";
import spxLogo from "../../assets/spx-logo.png";

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
  watchlist,
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

  async function handleShare() {
    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set("tracking", trackingNumber);

    const shareData = {
      title: `Theo dõi đơn ${trackingNumber}`,
      text: status ? `${trackingNumber} - ${status}` : trackingNumber,
      url: shareUrl.toString(),
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(shareUrl.toString());
      message.success("Đã sao chép liên kết chia sẻ");
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Failed to share tracking detail:", error);
        message.error("Không thể chia sẻ thông tin đơn hàng");
      }
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
          loading={toggling || watchlist?.loading}
          icon={isWatching ? <BellFilled /> : <BellOutlined />}
          onClick={handleToggleWatch}
        >
          {isWatching ? "Bỏ theo dõi" : "Theo dõi đơn này"}
        </Button>
      </Space>
      <Card>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            width: "100%",
          }}
        >
          <div
            style={{
              height: 50,
              width: 50,
              flexShrink: 0,
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <img
              src={spxLogo}
              alt="SPX Express"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
          <Space
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              width: "100%",
            }}
          >
            <Space size={6} vertical>
              <Space size={4} wrap>
                <Text style={{ fontWeight: 700 }} className="watch-tn">
                  {trackingNumber}
                </Text>
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={handleCopyTrackingNumber}
                  aria-label="Sao chép mã vận đơn"
                />
              </Space>

              {checkpoints[0]?.milestoneName && (
                <Space size={2} wrap>
                  <Tag style={{ marginInlineEnd: 0 }}>
                    {checkpoints[0].milestoneName}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {timeAgo(checkpoints[0].time)}
                  </Text>
                </Space>
              )}
            </Space>
            <Space>
              <Button
                icon={<ShareAltOutlined />}
                onClick={handleShare}
                aria-label="Chia sẻ thông tin vận đơn"
              />
            </Space>
          </Space>
        </div>
      </Card>
      {isWatching && (
        <Card>
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
                style={{ width: 220, fontWeight: 600 }}
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
            <Space size={4}>
              <Text
                type={
                  nicknameEditor.nickname || watchedItem?.nickname
                    ? undefined
                    : "secondary"
                }
              >
                {nicknameEditor.nickname ||
                  watchedItem?.nickname ||
                  "Đặt tên gợi nhớ"}
              </Text>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={nicknameEditor.startEditing}
                aria-label="Sửa tên gợi nhớ"
              />
            </Space>
          )}
        </Card>
      )}
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
