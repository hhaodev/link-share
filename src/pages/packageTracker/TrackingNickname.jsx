import { CheckOutlined, CloseOutlined, EditOutlined } from "@ant-design/icons";
import { Button, Card, Input, Space, Typography } from "antd";
import useTrackingNickname from "../../hooks/useTrackingNickname";

const { Text } = Typography;

export default function TrackingNickname({ trackingNumber, nickname }) {
  const nicknameEditor = useTrackingNickname(trackingNumber, nickname);

  return (
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
          <Text type={nicknameEditor.nickname || nickname ? undefined : "secondary"}>
            {nicknameEditor.nickname || nickname || "Đặt tên gợi nhớ"}
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
  );
}
