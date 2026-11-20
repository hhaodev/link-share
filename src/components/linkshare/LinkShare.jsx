import { Empty, message, Spin } from "antd";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import Box from "./Box";
import CreateBoxForm from "./CreateBoxForm";
import { db } from "../../firebase";

const LinkShare = () => {
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
      message.error("Không thể xóa box. Vui lòng thử lại.");
      setDeletingBoxIds((prev) => {
        const n = new Set(prev);
        n.delete(boxId);
        return n;
      });
    }
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <CreateBoxForm />
      {loadingBoxes ? (
        <div style={{ padding: 24, textAlign: "center" }}>
          <Spin />
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
  );
};

export default LinkShare;
