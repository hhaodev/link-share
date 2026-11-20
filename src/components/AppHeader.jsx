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
        {activeTab === "links" ? (
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
        ) : (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="m3.3 7 8.7 5 8.7-5M12 22V12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="m7.5 4.5 9 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {activeTab === "links" ? "LinkSharing" : "Package Tracker"}
      </div>

      <Segmented
        value={activeTab}
        onChange={onTabChange}
        options={[
          { value: "links", icon: <LinkOutlined /> },
          {
            value: "tracker",
            icon: <InboxOutlined />,
          },
        ]}
      />
    </Header>
  );
}
