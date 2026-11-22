import { useState } from "react";
import { Button, message, Space, Typography } from "antd";
import { CopyOutlined, DeleteOutlined } from "@ant-design/icons";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { timeAgo, getDomain } from "../../utils/helpers";

export default function LinkItem({ link, boxId }) {
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "boxes", boxId, "links", link.id));
    } catch (err) {
      console.error("Failed to delete link:", err);
      setDeleting(false);
    }
  }

  async function handleCopy() {
    if (copied) return;
    try {
      await navigator?.clipboard?.writeText(link.url);
      message.success("Đã sao chép link");
    } catch (error) {
      console.error("Failed to copy link:", error);
      message.error("Không thể sao chép link");
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 12px",
        opacity: deleting ? 0.4 : 1,
        transition: "opacity 0.2s",
      }}
    >
      <div className="link-favicon">
        <img
          src={`https://www.google.com/s2/favicons?sz=32&domain=${getDomain(link.url)}`}
          alt=""
          width="16"
          height="16"
          onError={(e) => {
            e.target.style.display = "none";
          }}
        />
      </div>

      <div className="link-info">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="link-url"
          onClick={(e) => e.stopPropagation()}
        >
          {link.url}
        </a>
        {link.description && (
          <span className="link-desc">{link.description}</span>
        )}
      </div>

      <Typography.Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
        {timeAgo(link.createdAt?.toDate())}
      </Typography.Text>

      <Space size={2}>
        <Button
          type="text"
          size="small"
          icon={<CopyOutlined />}
          onClick={handleCopy}
          aria-label="Sao chép link"
        />
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          loading={deleting}
          onClick={handleDelete}
          aria-label="Xóa"
        />
      </Space>
    </div>
  );
}
