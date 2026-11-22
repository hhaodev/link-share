import { useState } from "react";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { message, Space } from "antd";
import { useUser } from "../../contexts/UserContext";
import { db } from "../../firebase";
import TrackingNickname from "./TrackingNickname";
import TrackingSummary from "./TrackingSummary";
import TrackingTimeline from "./TrackingTimeline";

export default function TrackingDetail({
  result,
  watchedItems,
  watchedMap,
  onWatchChange,
  onSignIn,
  onBack,
  authLoading,
  loading,
  error,
  watchlist,
}) {
  const user = useUser();
  const { trackingNumber, status } = result;
  const checkpoints = result.checkpoints ?? [];
  const isWatching = !!watchedMap[trackingNumber];
  const watchedItem = watchedItems.find(
    (item) => item.trackingNumber === trackingNumber,
  );
  const [toggling, setToggling] = useState(false);

  async function handleToggleWatch() {
    setToggling(true);
    try {
      const ref = doc(db, "users", user.uid, "watchlist", trackingNumber);
      if (isWatching) {
        await deleteDoc(ref);
        onWatchChange(trackingNumber, false);
      } else {
        const latest = checkpoints[0] ?? null;
        await setDoc(ref, {
          trackingNumber,
          lastCheckpointTime: latest?.time ?? "",
          lastStatus: latest?.description ?? "",
          addedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        onWatchChange(trackingNumber, true);
      }
    } catch (error) {
      console.error("Failed to toggle watch:", error);
      message.error(
        "Không thể cập nhật trạng thái theo dõi. Vui lòng thử lại.",
      );
    } finally {
      setToggling(false);
    }
  }

  return (
    <Space vertical size={16} style={{ width: "100%" }}>
      <TrackingSummary
        trackingNumber={trackingNumber}
        status={status}
        checkpoints={checkpoints}
        user={user}
        isWatching={isWatching}
        toggling={toggling}
        watchlist={watchlist}
        onToggleWatch={handleToggleWatch}
        onSignIn={onSignIn}
        onBack={onBack}
        authLoading={authLoading}
        error={error}
        searchLoading={loading}
      />
      {isWatching && !loading && (
        <TrackingNickname
          trackingNumber={trackingNumber}
          nickname={watchedItem?.nickname}
        />
      )}
      <TrackingTimeline
        checkpoints={checkpoints}
        loading={loading}
        error={error}
      />
    </Space>
  );
}
