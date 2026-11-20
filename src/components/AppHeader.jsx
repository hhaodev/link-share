import { Layout, Segmented } from "antd";
import { LinkOutlined, InboxOutlined } from "@ant-design/icons";

const { Header } = Layout;

export default function AppHeader({ activeTab, onTabChange }) {
  return (
    <Header
      style={{
        background: "#000",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 56,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div className="app-logo">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        LinkShare
      </div>

      <Segmented
        value={activeTab}
        onChange={onTabChange}
        options={[
          { value: "links", label: "Link Sharing", icon: <LinkOutlined /> },
          {
            value: "tracker",
            label: "Package Tracker",
            icon: <InboxOutlined />,
          },
        ]}
      />
    </Header>
  );
}
