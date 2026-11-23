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
  listenForForegroundNotifications,
  syncNotificationToken,
} from "../../firebase/notification";
import PackageTracker from "./PackageTracker";

export default function PackageTrackerPage() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [notificationData, setNotificationData] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (authenticatedUser) => {
      setUser(authenticatedUser);
      setAuthLoading(false);

      if (!authenticatedUser) {
        setNotificationData(null);
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
        setNotificationData({
          userId,
          enabled: !snapshot.empty,
          error: null,
        });
      },
      (error) => {
        console.error("Failed to load notification status:", error);
        setNotificationData({ userId, enabled: null, error });
      },
    );

    let active = true;
    let unsubscribeForeground;
    listenForForegroundNotifications()
      .then((unsubscribe) => {
        if (active) {
          unsubscribeForeground = unsubscribe;
        } else {
          unsubscribe();
        }
      })
      .catch((error) => {
        console.error("Failed to listen for foreground notifications:", error);
      });

    syncNotificationToken(userId).catch((error) => {
      console.error("Failed to synchronize the FCM token:", error);
    });

    return () => {
      active = false;
      unsubscribe();
      unsubscribeForeground?.();
    };
  }, [user]);

  const contextValue = {
    user,
    setUser,
    authLoading,
    setNotificationsEnabled: (enabled) =>
      setNotificationData({ userId: user?.uid, enabled }),
    notificationData,
    profileError,
  };

  return (
    <UserContext.Provider value={contextValue}>
      <PackageTracker />
    </UserContext.Provider>
  );
}
