import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { db } from "../firebase";

export default function useUserCollection(userId, collectionName, orderField) {
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    if (!userId) return undefined;

    const userCollection = collection(db, "users", userId, collectionName);
    const collectionQuery = query(userCollection, orderBy(orderField, "desc"));
    return onSnapshot(
      collectionQuery,
      (result) => {
        setSnapshot({
          userId,
          items: result.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })),
          error: null,
        });
      },
      (error) => {
        console.error(`Failed to load ${collectionName}:`, error);
        setSnapshot((previous) => ({
          userId,
          items: previous?.userId === userId ? previous.items : [],
          error,
        }));
      },
    );
  }, [collectionName, orderField, userId]);

  const updateItems = useCallback(
    (update) => {
      setSnapshot((previous) => {
        if (previous?.userId !== userId) return previous;
        return { ...previous, items: update(previous.items) };
      });
    },
    [userId],
  );

  const isCurrentUser = Boolean(userId && snapshot?.userId === userId);
  return {
    items: isCurrentUser ? snapshot.items : [],
    loading: Boolean(userId) && !isCurrentUser,
    error: isCurrentUser ? snapshot?.error : null,
    updateItems,
  };
}
