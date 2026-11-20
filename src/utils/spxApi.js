import { parseSPXResponse } from "./spx";

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

  return parseSPXResponse(res, tn);
}
