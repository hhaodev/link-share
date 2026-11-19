import { useEffect, useState } from "react";
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
import { BoxSkeleton } from "./components/Skeletons";
import PackageTracker from "./components/tracker/PackageTracker";
import "./App.css";

export default function App() {
  const [activeTab, setActiveTab] = useState(
    () => sessionStorage.getItem("activeTab") ?? "links",
  );

  function handleTabChange(tab) {
    sessionStorage.setItem("activeTab", tab);
    setActiveTab(tab);
  }

  // ── Link sharing state ──────────────────────────────────────────────────
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
      alert(`Error: ${err.message}`);
      setDeletingBoxIds((prev) => {
        const next = new Set(prev);
        next.delete(boxId);
        return next;
      });
    }
  }

  return (
    <div className="app">
      <AppHeader activeTab={activeTab} onTabChange={handleTabChange} />

      <main className="app-main">
        {activeTab === "links" ? (
          <>
            <CreateBoxForm />
            {loadingBoxes ? (
              <div className="boxes-grid">
                <BoxSkeleton />
                <BoxSkeleton />
                <BoxSkeleton />
              </div>
            ) : boxes.length === 0 ? (
              <div className="empty-boxes">
                <svg
                  viewBox="0 0 48 48"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <rect
                    x="8"
                    y="14"
                    width="32"
                    height="26"
                    rx="3"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M16 14V10a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M24 22v8M20 26h8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <p>No boxes yet. Create one to get started!</p>
              </div>
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
          </>
        ) : (
          <PackageTracker />
        )}
      </main>
    </div>
  );
}
