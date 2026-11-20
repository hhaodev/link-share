import { Layout, Spin } from "antd";
import { lazy, Suspense, useState } from "react";
import "./App.css";
import AppHeader from "./components/AppHeader";

const LinkShare = lazy(() => import("./components/linkshare/LinkShare"));
const PackageTracker = lazy(
  () => import("./components/tracker/PackageTracker"),
);

const { Content } = Layout;

export default function App() {
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem("activeTab") ?? "links",
  );

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
          padding: "28px 24px 64px",
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
