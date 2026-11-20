import { useEffect, useState } from "react";
import { Layout, Button, Empty, Skeleton } from "antd";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import AppHeader from "./components/AppHeader";
import CreateBoxForm from "./components/CreateBoxForm";
import Box from "./components/Box";
import PackageTracker from "./components/tracker/PackageTracker";
import "./App.css";

const { Content } = Layout;

export default function App() {
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem("activeTab") ?? "links",
  );

  function handleTabChange(tab) {
    localStorage.setItem("activeTab", tab);
    setActiveTab(tab);
  }

  const [boxes, setBoxes] = useState([]);
  const [loadingBoxes, setLoadingBoxes] = useState(true);
  const [deletingBoxIds, setDeletingBoxIds] = useState(new Set());

  useEffect(() => {
    const q = query(collection(db, "boxes"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setBoxes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingBoxes(false);
    });
    return unsub;
  }, []);

  async function handleDeleteBox(boxId) {
    setDeletingBoxIds((prev) => new Set(prev).add(boxId));
    try {
      const linksSnap = await getDocs(collection(db, "boxes", boxId, "links"));
      const batch = writeBatch(db);
      linksSnap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, "boxes", boxId));
      await batch.commit();
    } catch (err) {
      console.error("Failed to delete box:", err);
      setDeletingBoxIds((prev) => {
        const n = new Set(prev);
        n.delete(boxId);
        return n;
      });
    }
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
          backgroundColor: "#000"
        }}
      >
        {activeTab === "links" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <CreateBoxForm />
            {loadingBoxes ? (
              <div className="boxes-grid">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} active paragraph={{ rows: 3 }} />
                ))}
              </div>
            ) : boxes.length === 0 ? (
              <Empty
                description="Chưa có box nào. Tạo một box để bắt đầu!"
                style={{ marginTop: 60 }}
              />
            ) : (
              <div className="boxes-grid">
                {boxes.map((box) => (
                  <Box
                    key={box.id}
                    box={box}
                    onDelete={handleDeleteBox}
                    isDeleting={deletingBoxIds.has(box.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <PackageTracker />
        )}
      </Content>
    </Layout>
  );
}
