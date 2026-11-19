import { normalizeTracking } from "./helpers";

// Dev  → Vite proxy /api/spx → https://spx.vn/shipment/order/open/order/get_order_info
// Prod → set VITE_SPX_PROXY_URL trỏ tới Cloudflare Worker / Cloud Function
const BASE = import.meta.env.VITE_SPX_PROXY_URL ?? "/api/spx";

export async function fetchTracking(trackingNumber) {
  const tn = trackingNumber.trim().toUpperCase();
  const url = `${BASE}?spx_tn=${encodeURIComponent(tn)}&language_code=vi`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();

  if (data.retcode !== 0) {
    throw new Error(data.message || "Không tìm thấy thông tin đơn hàng");
  }

  const records = data?.data?.sls_tracking_info?.records ?? null;
  if (!records) throw new Error("Không tìm thấy thông tin đơn hàng");

  return normalizeTracking(tn, records);
}
