import { normalizeTracking } from "./helpers";

const BASE = "/api/spx";

export async function fetchTracking(trackingNumber) {
  if (!trackingNumber || !trackingNumber.trim()) {
    throw new Error("Vui lòng nhập mã vận đơn");
  }

  const tn = trackingNumber.trim().toUpperCase();

  const url = new URL(BASE, window.location.origin);
  url.searchParams.set("spx_tn", tn);
  url.searchParams.set("language_code", "vi");

  let res;

  try {
    res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    throw new Error(`Không thể kết nối SPX Proxy: ${error.message}`);
  }

  if (!res.ok) {
    const errorText = await res.text();

    throw new Error(
      `SPX Proxy HTTP ${res.status}: ${errorText || res.statusText}`,
    );
  }

  let data;

  try {
    data = await res.json();
  } catch {
    throw new Error("SPX Proxy trả về dữ liệu JSON không hợp lệ");
  }

  if (data.retcode !== 0) {
    throw new Error(data.message || "Không tìm thấy thông tin đơn hàng");
  }

  const records = data?.data?.sls_tracking_info?.records;

  if (!records || !Array.isArray(records)) {
    throw new Error("Không tìm thấy lịch sử vận chuyển");
  }

  return normalizeTracking(tn, records);
}
