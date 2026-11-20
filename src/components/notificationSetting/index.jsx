import { useState } from "react";
import { Button, message } from "antd";
import { BellFilled, BellOutlined } from "@ant-design/icons";
import {
  disableNotification,
  enableNotification,
} from "../../firebase/notification";
import { useUser } from "../../contexts/UserContext";

export default function NotificationSettings({ enabled, onChange }) {
  const user = useUser();
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    try {
      setLoading(true);

      if (enabled) {
        const revoked = await disableNotification(user.uid);
        onChange(false);
        if (!revoked) {
          message.warning(
            "Đã ngừng gửi thông báo nhưng chưa thu hồi được token trên thiết bị",
          );
          return;
        }
        message.success("Đã tắt thông báo");
      } else {
        await enableNotification(user.uid);
        onChange(true);
        message.success("Đã bật thông báo");
      }
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="small"
      type={enabled ? "primary" : "default"}
      icon={enabled ? <BellFilled /> : <BellOutlined />}
      loading={loading}
      aria-label={enabled ? "Tắt thông báo" : "Bật thông báo"}
      onClick={handleToggle}
    />
  );
}
