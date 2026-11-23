import { useState } from "react";
import { Switch, message } from "antd";
import {
  disableNotification,
  enableNotification,
} from "../../firebase/notification";
import { useUser } from "../../contexts/UserContext";

export default function NotificationSettings({
  enabled,
  onChange,
  loadingProps,
}) {
  const user = useUser();
  const [loading, setLoading] = useState(false);

  const handleToggle = async (checked) => {
    try {
      setLoading(true);

      if (checked) {
        await enableNotification(user.uid);
        onChange(true);
        message.success("Đã bật thông báo");
      } else {
        const revoked = await disableNotification(user.uid);
        onChange(false);

        if (!revoked) {
          message.warning(
            "Đã ngừng gửi thông báo nhưng chưa thu hồi được token trên thiết bị",
          );
          return;
        }

        message.success("Đã tắt thông báo");
      }
    } catch (error) {
      message.error(error.message || "Không thể thay đổi cài đặt thông báo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Switch
      checked={enabled}
      loading={loading || loadingProps}
      checkedChildren="Bật"
      unCheckedChildren="Tắt"
      aria-label="Cài đặt thông báo"
      onChange={handleToggle}
    />
  );
}
