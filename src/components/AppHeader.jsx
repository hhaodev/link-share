export default function AppHeader({ activeTab, onTabChange }) {
  function handleTabClick(tab) {
    if (tab === activeTab && tab === "links") {
      window.location.reload();
    } else {
      onTabChange(tab);
    }
  }

  return (
    <header className="app-header">
      <div className="app-header-inner">
        {/* Left — logo */}
        <div className="logo">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>LinkShare</span>
        </div>

        {/* Right — tab switcher */}
        <div className="header-right">
          <nav className="tab-switcher" role="tablist" aria-label="Chế độ">
            <button
              role="tab"
              aria-selected={activeTab === "links"}
              className={`tab-btn${activeTab === "links" ? " tab-btn--active" : ""}`}
              onClick={() => handleTabClick("links")}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M6.5 8.5a3.5 3.5 0 0 0 5.3.38l2-2a3.5 3.5 0 0 0-4.95-4.95l-1.2 1.2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M9.5 7.5a3.5 3.5 0 0 0-5.3-.38l-2 2a3.5 3.5 0 0 0 4.95 4.95l1.2-1.2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Link Sharing
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "tracker"}
              className={`tab-btn${activeTab === "tracker" ? " tab-btn--active" : ""}`}
              onClick={() => handleTabClick("tracker")}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <rect
                  x="2"
                  y="3"
                  width="12"
                  height="10"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M5 7h6M5 10h4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Package Tracker
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
