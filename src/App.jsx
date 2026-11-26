import { Layout } from "antd";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import "./App.css";

import AppHeader from "./components/AppHeader";
import { GlobalContext } from "./contexts/GlobalContext";
import { useLocalState } from "./hooks/useLocalState";
import { useQueryState } from "./hooks/useQueryState";

const LinkShare = lazy(() => import("./pages/linkShare"));
const PackageTracker = lazy(() => import("./pages/packageTracker"));

const { Content } = Layout;

function LoadingFallbackMarker({ onShow }) {
  useEffect(() => {
    onShow();
  }, [onShow]);

  return null;
}

function LoadedContentMarker({ onLoad }) {
  useEffect(() => {
    onLoad();
  }, [onLoad]);

  return null;
}

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
  const [, startTransition] = useTransition();

  const [trackingNumber, setTrackingNumber] = useQueryState("tracking", "");

  const [installPrompt, setInstallPrompt] = useState(null);
  const [isAppInstalled, setIsAppInstalled] = useState(isStandaloneApp);
  const [isLoadingVisible, setIsLoadingVisible] = useState(false);
  const [isLoadingExiting, setIsLoadingExiting] = useState(false);
  const [hasInitialContentLoaded, setHasInitialContentLoaded] = useState(false);
  const hasInitializedRef = useRef(false);
  const loadingStartedAtRef = useRef(null);

  const isIOS = isIOSDevice();

  const showLoading = useCallback(() => {
    if (hasInitializedRef.current) {
      return;
    }

    if (loadingStartedAtRef.current === null) {
      loadingStartedAtRef.current = performance.now();
    }

    setIsLoadingExiting(false);
    setIsLoadingVisible(true);
  }, []);

  const finishLoading = useCallback(() => {
    if (hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;
    setHasInitialContentLoaded(true);
  }, []);

  const handleTabChange = useCallback(
    (tab) => {
      startTransition(() => {
        setTrackingNumber();
        setActiveTab(tab);
      });
    },
    [setActiveTab, startTransition],
  );

  useEffect(() => {
    if (!hasInitialContentLoaded || !isLoadingVisible) {
      return;
    }

    const elapsed = performance.now() - loadingStartedAtRef.current;
    const remaining = Math.max(0, 1000 - elapsed);
    const timeoutId = window.setTimeout(
      () => setIsLoadingExiting(true),
      remaining,
    );

    return () => window.clearTimeout(timeoutId);
  }, [hasInitialContentLoaded, isLoadingVisible]);

  useEffect(() => {
    if (!isLoadingExiting) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsLoadingVisible(false);
      setIsLoadingExiting(false);
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [isLoadingExiting]);

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
        <AppHeader activeTab={activeTab} onTabChange={handleTabChange} />
        <Content className="app-content">
          <Suspense fallback={<LoadingFallbackMarker onShow={showLoading} />}>
            {renderContent()}
            <LoadedContentMarker onLoad={finishLoading} />
          </Suspense>
        </Content>
      </Layout>
      {isLoadingVisible && (
        <div
          className={`app-loading-fallback${isLoadingExiting ? " app-loading-fallback--exiting" : ""}`}
          aria-hidden="true"
        >
          <img src="/icon-512.png" alt="" width="100" height="100" />
          <div className="app-loading-credit">dev by HaoDev</div>
        </div>
      )}
    </GlobalContext.Provider>
  );
}
