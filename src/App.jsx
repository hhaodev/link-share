import { Layout, Spin } from "antd";
import { lazy, Suspense, useEffect, useLayoutEffect } from "react";
import "./App.css";
import AppHeader from "./components/AppHeader";
import { GlobalContext } from "./contexts/GlobalContext";
import { useLocalState } from "./hooks/useLocalState";
import { useQueryState } from "./hooks/useQueryState";

const LinkShare = lazy(() => import("./pages/linkShare"));
const PackageTracker = lazy(() => import("./pages/packageTracker"));

const { Content } = Layout;

export default function App() {
  const [activeTab, setActiveTab] = useLocalState("platform", "packageTracker");
  const [trackingNumber, setTrackingNumber] = useQueryState("tracking", "");

  useLayoutEffect(() => {
    if (trackingNumber) setActiveTab("packageTracker");
  }, [setActiveTab, trackingNumber]);

  const renderContent = () => {
    switch (activeTab) {
      case "linkSharing":
        return <LinkShare />;
      case "packageTracker":
        return <PackageTracker />;
      default:
        return <PackageTracker />;
    }
  };

  return (
    <GlobalContext.Provider
      value={{ activeTab, setActiveTab, setTrackingNumber }}
    >
      <Layout className="app-layout">
        <AppHeader activeTab={activeTab} onTabChange={setActiveTab} />
        <Content className="app-content">
          <Suspense
            fallback={
              <div style={{ padding: 12, textAlign: "center" }}>
                <Spin />
              </div>
            }
          >
            {renderContent()}
          </Suspense>
        </Content>
      </Layout>
    </GlobalContext.Provider>
  );
}
