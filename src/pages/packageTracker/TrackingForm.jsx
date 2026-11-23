import { useState, forwardRef, useImperativeHandle } from "react";
import { Input, Button, Space } from "antd";

const TrackingForm = forwardRef(function TrackingForm(
  { onSearch, loading },
  ref,
) {
  const [input, setInput] = useState("");

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

  function handleSearch() {
    const tn = input.trim();
    if (!tn) return;
    onSearch(tn);
  }

  return (
    <Space.Compact style={{ width: "100%" }}>
      <Input
        placeholder="Mã vận đơn"
        value={input}
        onChange={(e) => setInput(e.target.value.toUpperCase())}
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
  );
});

export default TrackingForm;
