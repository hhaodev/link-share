import { Layout, Spin } from "antd";
import { lazy, Suspense, useEffect, useState } from "react";
import "./App.css";

import AppHeader from "./components/AppHeader";
import { GlobalContext } from "./contexts/GlobalContext";
import { useLocalState } from "./hooks/useLocalState";
import { useQueryState } from "./hooks/useQueryState";

const LinkShare = lazy(() => import("./pages/linkShare"));
const PackageTracker = lazy(() => import("./pages/packageTracker"));

const { Content } = Layout;

function isStandaloneApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIOSDevice() {
  return (
    /iPhone|iPad|iPod/.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" &&
      window.navigator.maxTouchPoints > 1)
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useLocalState("platform", "packageTracker");

  const [trackingNumber, setTrackingNumber] = useQueryState("tracking", "");

  const [installPrompt, setInstallPrompt] = useState(null);
  const [isAppInstalled, setIsAppInstalled] = useState(isStandaloneApp);

  const isIOS = isIOSDevice();

  // iPhone/iPad cần hướng dẫn cài đặt thủ công.
  const shouldShowInstallGuide = isIOS && !isAppInstalled;

  function markAppInstalled() {
    setIsAppInstalled(true);
    setInstallPrompt(null);
  }

  useEffect(() => {
    if (trackingNumber) {
      setActiveTab("packageTracker");
    }
  }, [trackingNumber, setActiveTab]);

  useEffect(() => {
    function updateStandaloneState() {
      setIsAppInstalled(isStandaloneApp());
    }

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    function handleAppInstalled() {
      markAppInstalled();
    }

    const displayMode = window.matchMedia("(display-mode: standalone)");

    displayMode.addEventListener("change", updateStandaloneState);

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    window.addEventListener("appinstalled", handleAppInstalled);

    updateStandaloneState();

    return () => {
      displayMode.removeEventListener("change", updateStandaloneState);

      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );

      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case "linkSharing":
        return <LinkShare />;
      case "packageTracker":
      default:
        return <PackageTracker />;
    }
  };

  return (
    <GlobalContext.Provider
      value={{
        activeTab,
        setActiveTab,

        trackingNumber,
        setTrackingNumber,

        installPrompt,
        setInstallPrompt,

        isAppInstalled,
        markAppInstalled,

        isIOS,
        shouldShowInstallGuide,
      }}
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
