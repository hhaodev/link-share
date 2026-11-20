import { useState } from "react";
import { Button, Input, message, Space } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

export default function CreateBoxForm() {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await addDoc(collection(db, "boxes"), {
        name: trimmed,
        createdAt: serverTimestamp(),
      });
      setName("");
    } catch (err) {
      console.error("Failed to create box:", err);
      message.error("Không thể tạo box. Vui lòng thử lại.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Space.Compact>
      <Input
        placeholder="Tên box mới…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onPressEnter={handleSubmit}
        disabled={creating}
        maxLength={50}
        allowClear
      />
      <Button
        type="primary"
        icon={<PlusOutlined />}
        loading={creating}
        disabled={!name.trim()}
        onClick={handleSubmit}
      >
        Tạo Box
      </Button>
    </Space.Compact>
  );
}
