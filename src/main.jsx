import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConfigProvider, theme } from "antd";
import viVN from "antd/locale/vi_VN";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <ConfigProvider
    locale={viVN}
    theme={{
      algorithm: theme.darkAlgorithm,
      token: {
        colorPrimary: "#aa3bff",
        borderRadius: 8,
        fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif",
      },
    }}
  >
    <App />
  </ConfigProvider>,
);
