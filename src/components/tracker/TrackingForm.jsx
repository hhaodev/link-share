import { useState } from "react";

export default function TrackingForm({ onSearch, loading }) {
  const [input, setInput] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const tn = input.trim();
    if (!tn) return;
    onSearch(tn);
  }

  return (
    <form className="tracking-form" onSubmit={handleSubmit}>
      <div className="tracking-input-wrap">
        <svg
          className="tracking-input-icon"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M3 5h14M3 10h14M3 15h8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <input
          type="text"
          className="tracking-input"
          placeholder="Nhập mã vận đơn SPX (vd: SPXVN...)"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          disabled={loading}
          aria-label="Mã vận đơn"
          spellCheck={false}
        />
      </div>
      <button
        type="submit"
        className="btn-primary"
        disabled={loading || !input.trim()}
      >
        {loading ? (
          <>
            <span className="spinner spinner--light" aria-hidden="true" />
            Đang tra…
          </>
        ) : (
          "Tra cứu"
        )}
      </button>
    </form>
  );
}
