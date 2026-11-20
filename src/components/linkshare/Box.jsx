import { useEffect, useRef, useState } from "react";
import {
  Card,
  Input,
  Button,
  Space,
  Typography,
  Skeleton,
  Empty,
  Badge,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import { isValidUrl } from "../../utils/helpers";
import LinkItem from "./LinkItem";

export default function Box({ box, onDelete, isDeleting }) {
  const [links, setLinks] = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [inputUrl, setInputUrl] = useState("");
  const [inputDesc, setInputDesc] = useState("");
  const [urlError, setUrlError] = useState("");
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isRenamingName, setIsRenamingName] = useState(false);
  const [nameValue, setNameValue] = useState(box.name);
  const nameInputRef = useRef(null);

  useEffect(() => {
    const q = query(
      collection(db, "boxes", box.id, "links"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setLinks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingLinks(false);
    });
    return unsub;
  }, [box.id]);

  useEffect(() => {
    if (isEditingName) nameInputRef.current?.focus();
  }, [isEditingName]);

  async function handleAddLink() {
    const url = inputUrl.trim();
    if (!url) return;
    if (!isValidUrl(url)) {
      setUrlError("URL không hợp lệ (cần bắt đầu bằng http/https)");
      return;
    }
    setUrlError("");
    setIsAddingLink(true);
    try {
      await addDoc(collection(db, "boxes", box.id, "links"), {
        url,
        description: inputDesc.trim(),
        createdAt: serverTimestamp(),
      });
      setInputUrl("");
      setInputDesc("");
    } catch (err) {
      console.error("Failed to add link:", err);
    } finally {
      setIsAddingLink(false);
    }
  }

  async function handleRename() {
    const trimmed = nameValue.trim();
    if (!trimmed) {
      setNameValue(box.name);
      setIsEditingName(false);
      return;
    }
    if (trimmed !== box.name) {
      setIsRenamingName(true);
      try {
        await updateDoc(doc(db, "boxes", box.id), { name: trimmed });
      } catch {
        setNameValue(box.name);
      } finally {
        setIsRenamingName(false);
      }
    }
    setIsEditingName(false);
  }

  const titleNode = isEditingName ? (
    <Input
      ref={nameInputRef}
      value={nameValue}
      size="small"
      style={{ maxWidth: 200, fontWeight: 600 }}
      onChange={(e) => setNameValue(e.target.value)}
      onBlur={handleRename}
      onPressEnter={handleRename}
      disabled={isRenamingName}
      maxLength={50}
    />
  ) : (
    <Space size={4}>
      <Typography.Text strong style={{ fontSize: 14 }}>
        {box.name}
      </Typography.Text>
      <Button
        type="text"
        size="small"
        icon={<EditOutlined />}
        disabled={isDeleting}
        onClick={() => setIsEditingName(true)}
      />
      <Badge count={links.length} color="purple" style={{ fontSize: 11 }} />
    </Space>
  );

  return (
    <Card
      size="small"
      style={{
        opacity: isDeleting ? 0.5 : 1,
        transition: "opacity 0.2s",
        pointerEvents: isDeleting ? "none" : undefined,
      }}
      title={titleNode}
      extra={
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          loading={isDeleting}
          onClick={() => onDelete(box.id)}
        />
      }
    >
      {/* Add link form */}
      <Space vertical style={{ width: "100%", marginBottom: 8 }} size={6}>
        <Input
          placeholder="Dán link vào đây…"
          value={inputUrl}
          onChange={(e) => {
            setInputUrl(e.target.value);
            setUrlError("");
          }}
          onPressEnter={handleAddLink}
          disabled={isAddingLink || isDeleting}
          status={urlError ? "error" : ""}
          allowClear
        />
        {urlError && (
          <Typography.Text type="danger" style={{ fontSize: 12 }}>
            {urlError}
          </Typography.Text>
        )}
        <Space.Compact style={{ width: "100%" }}>
          <Input
            placeholder="Mô tả (tuỳ chọn)…"
            value={inputDesc}
            onChange={(e) => setInputDesc(e.target.value)}
            disabled={isAddingLink || isDeleting}
            maxLength={120}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={isAddingLink}
            disabled={!inputUrl.trim() || isDeleting}
            onClick={handleAddLink}
          >
            Thêm
          </Button>
        </Space.Compact>
      </Space>

      {/* Links list */}
      {loadingLinks ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : links.length === 0 ? (
        <Empty
          description="Chưa có link nào"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ margin: "12px 0" }}
        />
      ) : (
        <div>
          {links.map((link) => (
            <LinkItem key={link.id} link={link} boxId={box.id} />
          ))}
        </div>
      )}
    </Card>
  );
}
