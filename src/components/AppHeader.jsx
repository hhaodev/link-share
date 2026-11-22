import { Layout, Segmented } from "antd";

const { Header } = Layout;

const PackageIcon = ({ style, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    {...props}
    style={{
      width: 20,
      height: 20,
      ...style,
    }}
  >
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
);

const LinkIcon = ({ style, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    {...props}
    style={{
      width: 20,
      height: 20,
      ...style,
    }}
  >
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
);

export default function AppHeader({ activeTab, onTabChange }) {
  const iconStyle = {
    width: 22,
    height: 22,
    flexShrink: 0,
    color: "var(--app-accent)",
  };

  const icons = {
    linkSharing: <LinkIcon style={iconStyle} />,
    packageTracker: <PackageIcon style={iconStyle} />,
  };

  return (
    <Header
      className="app-header"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="app-header-inner"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div className="app-brand">
          <div className="app-brand-mark">{icons[activeTab]}</div>
          <div>
            <div className="app-logo">
              {activeTab === "linkSharing" ? "Link Sharing" : "Package Tracker"}
            </div>
          </div>
        </div>

        <Segmented
          className="app-navigation"
          value={activeTab}
          onChange={onTabChange}
          options={[
            {
              value: "linkSharing",
              icon: (
                <LinkIcon
                  style={{
                    width: 18,
                    height: 18,
                    color:
                      activeTab === "linkSharing"
                        ? "var(--app-accent)"
                        : undefined,
                  }}
                />
              ),
            },
            {
              value: "packageTracker",
              icon: (
                <PackageIcon
                  style={{
                    width: 18,
                    height: 18,
                    color:
                      activeTab === "packageTracker"
                        ? "var(--app-accent)"
                        : undefined,
                  }}
                />
              ),
            },
          ]}
        />
      </div>
    </Header>
  );
}
