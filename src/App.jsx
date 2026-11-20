import { Layout, Spin } from "antd";
import { lazy, Suspense, useState } from "react";
import "./App.css";
import AppHeader from "./components/AppHeader";

const LinkShare = lazy(() => import("./components/linkshare"));
const PackageTracker = lazy(
  () => import("./components/tracker/PackageTracker"),
);

const { Content } = Layout;

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    const trackingNumber = new URLSearchParams(window.location.search).get(
      "tracking",
    );
    return trackingNumber
      ? "tracker"
      : (localStorage.getItem("activeTab") ?? "links");
  });

  function handleTabChange(tab) {
    localStorage.setItem("activeTab", tab);
    setActiveTab(tab);
  }

  return (
    <Layout style={{ minHeight: "100svh" }}>
      <AppHeader activeTab={activeTab} onTabChange={handleTabChange} />
      <Content
        style={{
          maxWidth: 1100,
          width: "100%",
          margin: "0 auto",
          padding: "12px 24px 36px",
          backgroundColor: "#000",
        }}
      >
        <Suspense
          fallback={
            <div style={{ padding: 24, textAlign: "center" }}>
              <Spin />
            </div>
          }
        >
          {activeTab === "links" ? <LinkShare /> : <PackageTracker />}
        </Suspense>
      </Content>
    </Layout>
  );
}
