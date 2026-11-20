import { message } from "antd";
import { deleteDoc, doc } from "firebase/firestore";
import { useState } from "react";
import { useUser } from "../contexts/UserContext";
import { db } from "../firebase";

export default function useTrackingListActions({
  collectionName,
  trackingNumber,
  onSearch,
  onDelete,
}) {
  const user = useUser();
  const [deleting, setDeleting] = useState(false);
  const [searching, setSearching] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteDoc(
        doc(db, "users", user.uid, collectionName, trackingNumber),
      );
      onDelete(trackingNumber);
    } catch (error) {
      console.error(`Failed to delete ${collectionName} item:`, error);
      message.error("Không thể xóa mục này. Vui lòng thử lại.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSearch() {
    setSearching(true);
    try {
      await onSearch(trackingNumber);
    } finally {
      setSearching(false);
    }
  }

  return { deleting, searching, handleDelete, handleSearch };
}
