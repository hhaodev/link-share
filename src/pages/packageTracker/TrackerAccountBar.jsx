import { signOut } from "firebase/auth";
import {
  Alert,
  Avatar,
  Button,
  Modal,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import {
  BellFilled,
  BellOutlined,
  DownloadOutlined,
  LogoutOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { auth } from "../../firebase";
import { useUser, useUserContext } from "../../contexts/UserContext";
import { disableNotification } from "../../firebase/notification";
import NotificationSettings from "../../components/notificationSetting";
import { useGlobal } from "../../contexts/GlobalContext";

export default function TrackerAccountBar({ onSignIn }) {
  const user = useUser();
  const { installPrompt, setInstallPrompt, isAppInstalled, markAppInstalled } =
    useGlobal();
  const {
    authLoading,
    notificationStatus,
    notificationData,
    setNotificationsEnabled,
  } = useUserContext();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);

  async function handleInstallApp() {
    if (!installPrompt) {
      setShowInstallInstructions(true);
      return;
    }

    try {
      const promptEvent = installPrompt;
      setInstallPrompt(null);
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") {
        markAppInstalled();
      }
    } catch (error) {
      message.error(error.message || "Không thể cài đặt ứng dụng");
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const tokenRevoked = await disableNotification(user.uid);
      if (!tokenRevoked) {
        message.warning(
          "Đã đăng xuất thiết bị khỏi nhận thông báo, nhưng chưa thu hồi được token cục bộ",
        );
      }
      await signOut(auth);
      setSettingsOpen(false);
    } catch (error) {
      message.error(error.message || "Không thể đăng xuất");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <div className="tracker-account-card">
        {authLoading ? (
          <div className="tracker-account-loading">
            <Spin />
          </div>
        ) : user ? (
          <>
            <Avatar
              src={user.photoURL}
              size={42}
              className="tracker-account-avatar"
            />
            <div className="tracker-account-copy">
              <div className="tracker-account-name">
                <Typography.Text strong>{user.displayName}</Typography.Text>
                {notificationData === null ? (
                  notificationStatus?.error ? (
                    <Tag color="red">Không rõ trạng thái</Tag>
                  ) : (
                    <Spin size="small" />
                  )
                ) : !notificationData?.enabled ? (
                  <BellOutlined />
                ) : (
                  <BellFilled />
                )}
              </div>
              <Typography.Text type="secondary">{user.email}</Typography.Text>
            </div>
            <Button
              className="tracker-settings-button"
              icon={<SettingOutlined />}
              aria-label="Cài đặt tài khoản"
              onClick={() => setSettingsOpen(true)}
            />
          </>
        ) : (
          <>
            <div className="tracker-account-copy">
              <Typography.Text strong>
                Lưu đơn và nhận thông báo
              </Typography.Text>
              <Typography.Text type="secondary">
                Đăng nhập để quản lý danh sách theo dõi.
              </Typography.Text>
            </div>
            <Button className="tracker-login-button" onClick={onSignIn}>
              Đăng nhập
            </Button>
          </>
        )}
      </div>

      <Modal
        title="Cài đặt"
        open={settingsOpen}
        footer={null}
        onCancel={() => setSettingsOpen(false)}
        destroyOnClose
        centered
        width={300}
      >
        <Space vertical style={{ width: "100%", padding: "16px 0px" }}>
          <div>
            <Space
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Typography.Text strong>Thông báo đơn hàng</Typography.Text>
              <NotificationSettings
                enabled={notificationData?.enabled}
                onChange={setNotificationsEnabled}
                loadingProps={notificationData === null}
              />
            </Space>
            <Typography.Paragraph type="secondary">
              Nhận thông báo khi trạng thái đơn hàng được cập nhật.
            </Typography.Paragraph>
            {notificationData?.enabled === null &&
              (notificationData?.error ? (
                <Alert
                  type="error"
                  showIcon
                  message="Không tải được trạng thái thông báo."
                />
              ) : (
                <Spin size="small" />
              ))}
          </div>
          {!isAppInstalled && (
            <div>
              <Button
                block
                icon={<DownloadOutlined />}
                onClick={handleInstallApp}
                style={{ padding: "20px 0px" }}
              >
                Thêm vào màn hình chính
              </Button>
              {showInstallInstructions && (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginTop: 12 }}
                  closable
                  onClose={() => setShowInstallInstructions(false)}
                  description={
                    /iPhone|iPad|iPod/i.test(navigator.userAgent)
                      ? 'Trong Safari, nhấn nút Chia sẻ rồi chọn "Thêm vào màn hình chính".'
                      : 'Mở menu của trình duyệt rồi chọn "Cài đặt ứng dụng" hoặc "Thêm vào màn hình chính".'
                  }
                />
              )}
            </div>
          )}
          <Button
            danger
            block
            icon={<LogoutOutlined />}
            loading={signingOut}
            onClick={handleSignOut}
            style={{ padding: "20px 0px" }}
          >
            Đăng xuất
          </Button>
        </Space>
      </Modal>
    </>
  );
}
