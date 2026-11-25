import {
  BellOutlined,
  DownloadOutlined,
  LogoutOutlined,
  SettingOutlined
} from "@ant-design/icons";
import {
  Alert,
  Avatar,
  Button,
  Modal,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
  message,
} from "antd";
import { signOut } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import NotificationSettings from "../../components/notificationSetting";
import { useGlobal } from "../../contexts/GlobalContext";
import { useUser, useUserContext } from "../../contexts/UserContext";
import { auth, db } from "../../firebase";
import { disableNotification } from "../../firebase/notification";

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
  const [trackingSettings, setTrackingSettings] = useState(null);
  const [savingTrackingSettings, setSavingTrackingSettings] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    const userId = user.uid;
    return onSnapshot(
      doc(db, "users", userId, "accountSettings", "tracking"),
      (snapshot) => {
        const settings = snapshot.data();
        const deleteWhenDone = settings?.deleteWhenDone !== false;
        setTrackingSettings({
          userId,
          deleteWhenDone,
          error: null,
        });

        if (typeof settings?.deleteWhenDone !== "boolean") {
          setDoc(
            doc(db, "users", userId, "accountSettings", "tracking"),
            { deleteWhenDone: true },
            { merge: true },
          ).catch((error) => {
            console.error("Failed to initialize tracking settings:", error);
            setTrackingSettings({
              userId,
              deleteWhenDone: true,
              error,
            });
          });
        }
      },
      (error) => {
        console.error("Failed to load tracking settings:", error);
        setTrackingSettings({ userId, deleteWhenDone: false, error });
      },
    );
  }, [user?.uid]);

  async function handleDeleteWhenDoneChange(checked) {
    setSavingTrackingSettings(true);
    try {
      await setDoc(
        doc(db, "users", user.uid, "accountSettings", "tracking"),
        { deleteWhenDone: checked },
        { merge: true },
      );
      message.success(checked ? "Bật thành công" : "Tắt thành công");
    } catch (error) {
      console.error("Failed to update tracking settings:", error);
      message.error("Không thể lưu cài đặt.");
    } finally {
      setSavingTrackingSettings(false);
    }
  }

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
                ) : (
                  notificationData?.enabled && <BellOutlined />
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
                Đăng nhập để sử nhận thông báo.
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
              <Typography.Text strong>Thông báo</Typography.Text>
              <NotificationSettings
                enabled={notificationData?.enabled}
                onChange={setNotificationsEnabled}
                loadingProps={notificationData === null}
              />
            </Space>
            <Typography.Paragraph type="secondary">
              Nhận thông báo khi trạng thái đơn hàng được cập nhật.
            </Typography.Paragraph>
            <Space
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Typography.Text strong>
                Ngưng theo dõi khi hoàn tất
              </Typography.Text>
              <Switch
                checked={
                  trackingSettings?.userId === user?.uid &&
                  trackingSettings?.deleteWhenDone
                }
                loading={
                  savingTrackingSettings ||
                  trackingSettings?.userId !== user?.uid
                }
                disabled={Boolean(trackingSettings?.error)}
                checkedChildren="Bật"
                unCheckedChildren="Tắt"
                aria-label="Cài đặt ngưng theo dõi khi hoàn tất đơn hàng"
                onChange={handleDeleteWhenDoneChange}
              />
            </Space>
            <Typography.Paragraph type="secondary">
              Tự động bỏ đơn khỏi danh sách theo dõi khi đơn hàng giao thành
              công.
            </Typography.Paragraph>
            {trackingSettings?.userId === user?.uid &&
              trackingSettings?.error && (
                <Typography.Text type="danger">
                  Không thể tải cài đặt theo dõi.
                </Typography.Text>
              )}
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
