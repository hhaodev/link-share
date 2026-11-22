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
import { LogoutOutlined, SettingOutlined } from "@ant-design/icons";
import { useState } from "react";
import { auth } from "../../firebase";
import { useUser, useUserContext } from "../../contexts/UserContext";
import { disableNotification } from "../../firebase/notification";
import NotificationSettings from "../../components/notificationSetting";

export default function TrackerAccountBar({
  notificationsEnabled,
  notificationStatus,
  onNotificationsChange,
  onSignIn,
}) {
  const user = useUser();
  const { authLoading } = useUserContext();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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
                {notificationsEnabled === null ? (
                  notificationStatus?.userId === user.uid &&
                  notificationStatus.error ? (
                    <Tag color="red">Không rõ trạng thái</Tag>
                  ) : (
                    <Spin size="small" />
                  )
                ) : (
                  <Tag
                    style={{ fontSize: 10 }}
                    color={notificationsEnabled ? "green" : "default"}
                  >
                    {notificationsEnabled
                      ? "Đang nhận thông báo"
                      : "Không nhận thông báo"}
                  </Tag>
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
                enabled={notificationsEnabled}
                onChange={onNotificationsChange}
              />
            </Space>
            <Typography.Paragraph type="secondary">
              Nhận thông báo khi trạng thái đơn hàng được cập nhật.
            </Typography.Paragraph>
            {notificationsEnabled === null &&
              (notificationStatus?.userId === user?.uid &&
              notificationStatus.error ? (
                <Alert
                  type="error"
                  showIcon
                  message="Không tải được trạng thái thông báo."
                />
              ) : (
                <Spin size="small" />
              ))}
          </div>
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
