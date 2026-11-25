import { Button, Input, message, Modal, Space, Typography } from "antd";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";

function findTrackingNumber(text) {
  return text.match(/\bSPX[A-Z0-9]{8,}\b/i)?.[0].toUpperCase() ?? "";
}

const TrackingForm = forwardRef(function TrackingForm(
  { onSearch, loading },
  ref,
) {
  const [input, setInput] = useState("");
  const [clipboardTrackingNumber, setClipboardTrackingNumber] = useState("");
  const [readingClipboard, setReadingClipboard] = useState(false);
  const lastAutoDetectedRef = useRef("");

  useImperativeHandle(
    ref,
    () => ({
      setValue(value) {
        setInput((value || "").toUpperCase());
      },
      getValue() {
        return input;
      },
      clear() {
        setInput("");
      },
    }),
    [input],
  );

  async function handleReadClipboard() {
    setReadingClipboard(true);
    try {
      if (!navigator.clipboard?.readText) {
        message.error("Trình duyệt không hỗ trợ đọc clipboard.");
        return;
      }

      const trackingNumber = findTrackingNumber(
        await navigator.clipboard.readText(),
      );
      if (!trackingNumber) {
        message.info("Không tìm thấy mã SPX trong clipboard.");
        return;
      }

      lastAutoDetectedRef.current = trackingNumber;
      setClipboardTrackingNumber(trackingNumber);
    } finally {
      setReadingClipboard(false);
    }
  }

  function handlePaste(event) {
    const trackingNumber = findTrackingNumber(
      event.clipboardData.getData("text"),
    );
    if (!trackingNumber) return;

    event.preventDefault();
    lastAutoDetectedRef.current = trackingNumber;
    setInput(trackingNumber);
    setClipboardTrackingNumber(trackingNumber);
  }

  function handleSearch() {
    const tn = input.trim();
    if (!tn) return;
    onSearch(tn);
  }

  function handleClipboardSearch() {
    const trackingNumber = clipboardTrackingNumber;
    setInput(trackingNumber);
    setClipboardTrackingNumber("");
    onSearch(trackingNumber);
  }

  return (
    <>
      <Space.Compact style={{ width: "100%" }}>
        <Input
          placeholder="Mã vận đơn"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onPaste={handlePaste}
          onPressEnter={handleSearch}
          disabled={loading}
          spellCheck={false}
          allowClear
          size="large"
        />

        <Button
          type="primary"
          size="large"
          loading={loading}
          disabled={!input.trim()}
          onClick={handleSearch}
        >
          Tra cứu
        </Button>
      </Space.Compact>
      <Button
        type="link"
        size="small"
        loading={readingClipboard}
        disabled={loading}
        onClick={handleReadClipboard}
        style={{ paddingInline: 0, marginTop: 6 }}
      >
        Dán từ clipboard
      </Button>
      <Modal
        centered
        width={300}
        title="Mã vận đơn trong clipboard"
        open={Boolean(clipboardTrackingNumber)}
        onCancel={() => setClipboardTrackingNumber("")}
        footer={[
          <Button key="dismiss" onClick={() => setClipboardTrackingNumber("")}>
            Để sau
          </Button>,
          <Button key="search" type="primary" onClick={handleClipboardSearch}>
            Tra cứu ngay
          </Button>,
        ]}
      >
        <Typography.Text>
          Tìm thấy mã{" "}
          <Typography.Text strong>{clipboardTrackingNumber}</Typography.Text>.
          Tra cứu ngay?
        </Typography.Text>
      </Modal>
    </>
  );
});

export default TrackingForm;
