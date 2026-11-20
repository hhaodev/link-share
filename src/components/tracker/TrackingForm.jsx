import { useState } from "react";
import { Input, Button, Space } from "antd";
import { SearchOutlined } from "@ant-design/icons";

export default function TrackingForm({ onSearch, loading }) {
  const [input, setInput] = useState("");

  function handleSearch() {
    const tn = input.trim();
    if (!tn) return;
    onSearch(tn);
  }

  return (
    <Space.Compact style={{ width: "100%" }}>
      <Input
        prefix={<SearchOutlined />}
        placeholder="Mã vận đơn SPX"
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
}
