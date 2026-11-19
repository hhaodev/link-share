import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export default function CreateBoxForm() {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await addDoc(collection(db, "boxes"), {
        name: trimmed,
        createdAt: serverTimestamp(),
      });
      setName("");
    } catch (err) {
      console.error("Failed to create box:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <form className="create-box-form" onSubmit={handleSubmit}>
      <input
        type="text"
        className="box-name-input"
        placeholder="New box name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={creating}
        maxLength={50}
        aria-label="New box name"
      />
      <button
        type="submit"
        className="btn-primary"
        disabled={creating || !name.trim()}
      >
        {creating ? (
          <>
            <span className="spinner spinner--light" aria-hidden="true" />
            Creating…
          </>
        ) : (
          "+ Create Box"
        )}
      </button>
    </form>
  );
}
