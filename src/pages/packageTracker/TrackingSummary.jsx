import {
  ArrowLeftOutlined,
  BellFilled,
  BellOutlined,
  CopyOutlined,
  ShareAltOutlined,
} from "@ant-design/icons";
import { Button, Card, Space, Tag, Typography, message } from "antd";
import spxLogo from "../../assets/spx-logo.png";
import { timeAgo } from "../../utils/helpers";

const { Text } = Typography;

export default function TrackingSummary({
  trackingNumber,
  status,
  checkpoints,
  user,
  isWatching,
  toggling,
  watchlist,
  onToggleWatch,
  onSignIn,
  onBack,
  authLoading,
  error,
  searchLoading,
}) {
  async function handleCopyTrackingNumber() {
    try {
      await navigator.clipboard.writeText(trackingNumber);
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
        {!error && !searchLoading && (
          <>
            {authLoading || watchlist?.loading ? (
              <Button loading disabled>
                Đang kiểm tra...
              </Button>
            ) : user ? (
              <Button
                type={isWatching ? "primary" : "default"}
                loading={toggling || watchlist?.loading}
                icon={isWatching ? <BellFilled /> : <BellOutlined />}
                onClick={onToggleWatch}
              >
                {isWatching ? "Bỏ theo dõi" : "Theo dõi đơn này"}
              </Button>
            ) : (
              <Button type="primary" icon={<BellOutlined />} onClick={onSignIn}>
                Đăng nhập để theo dõi
              </Button>
            )}
          </>
        )}
      </Space>

      {!error && !searchLoading && (
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
                borderRadius: "var(--app-radius-control)",
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
              <Space size={4} vertical>
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
                  <Space wrap>
                    <Tag style={{ marginInlineEnd: 0 }}>
                      {checkpoints[0].milestoneName}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {timeAgo(checkpoints[0].time)}
                    </Text>
                  </Space>
                )}
              </Space>
              <Button
                style={{
                  borderColor: "var(--app-accent-subtle)",
                  borderRadius: "var(--app-radius-control)",
                  background: "var(--app-accent-subtle)",
                  color: "var(--app-accent-foreground)",
                }}
                icon={<ShareAltOutlined />}
                onClick={handleShare}
                aria-label="Chia sẻ thông tin vận đơn"
              />
            </Space>
          </div>
        </Card>
      )}
    </Space>
  );
}
