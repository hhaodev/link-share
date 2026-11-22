import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { UserContext } from "../../contexts/UserContext";
import { auth, db } from "../../firebase";
import {
  getNotificationDeviceId,
  syncNotificationToken,
} from "../../firebase/notification";
import PackageTracker from "./PackageTracker";

export default function PackageTrackerPage() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [notificationStatus, setNotificationStatus] = useState(null);

  const notificationsEnabled =
    notificationStatus?.userId === user?.uid
      ? notificationStatus?.enabled
      : null;

  useEffect(() => {
    return onAuthStateChanged(auth, (authenticatedUser) => {
      setUser(authenticatedUser);
      setAuthLoading(false);

      if (!authenticatedUser) {
        setNotificationStatus(null);
        return;
      }

      setProfileError("");
      setDoc(
        doc(db, "users", authenticatedUser.uid),
        {
          uid: authenticatedUser.uid,
          displayName: authenticatedUser.displayName || "",
          email: authenticatedUser.email || "",
          photoURL: authenticatedUser.photoURL || "",
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ).catch((error) => {
        console.error("Failed to update user profile:", error);
        setProfileError("Không thể cập nhật hồ sơ người dùng.");
      });
    });
  }, []);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const userId = user.uid;
    const tokensQuery = query(
      collection(db, "users", userId, "fcmTokens"),
      where("deviceId", "==", getNotificationDeviceId()),
    );
    const unsubscribe = onSnapshot(
      tokensQuery,
      (snapshot) => {
        setNotificationStatus({
          userId,
          enabled: !snapshot.empty,
          error: null,
        });
      },
      (error) => {
        console.error("Failed to load notification status:", error);
        setNotificationStatus({ userId, enabled: null, error });
      },
    );

    syncNotificationToken(userId).catch((error) => {
      console.error("Failed to synchronize the FCM token:", error);
    });

    return unsubscribe;
  }, [user]);

  const contextValue = {
    user,
    setUser,
    authLoading,
    notificationsEnabled,
    setNotificationsEnabled: (enabled) =>
      setNotificationStatus({ userId: user?.uid, enabled }),
    notificationStatus,
    profileError,
  };

  return (
    <UserContext.Provider value={contextValue}>
      <PackageTracker />
    </UserContext.Provider>
  );
}
