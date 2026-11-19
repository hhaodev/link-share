import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/spx": {
        target: "https://spx.vn",
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(
            /^\/api\/spx/,
            "/shipment/order/open/order/get_order_info",
          ),
      },
    },
  },
});
