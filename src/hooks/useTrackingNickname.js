import { message } from "antd";
import { doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { useUser } from "../contexts/UserContext";
import { db } from "../firebase";

export default function useTrackingNickname(trackingNumber, currentNickname) {
  const user = useUser();
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setNickname(currentNickname || "");
    setEditing(true);
  }

  function cancelEditing() {
    setNickname(currentNickname || "");
    setEditing(false);
  }

  async function saveNickname() {
    const trimmedNickname = nickname.trim();
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid, "watchlist", trackingNumber), {
        nickname: trimmedNickname,
      });
      setNickname(trimmedNickname);
      setEditing(false);
    } catch (error) {
      console.error("Failed to update tracking nickname:", error);
      message.error("Không thể lưu tên gợi nhớ. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  return {
    editing,
    nickname,
    saving,
    setNickname,
    startEditing,
    cancelEditing,
    saveNickname,
  };
}
