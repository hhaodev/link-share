export const SPX_TRACKING_ENDPOINT =
  "https://spx.vn/shipment/order/open/order/get_order_info";

export const SPX_REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json",
  Referer: "https://spx.vn/",
};

export function createSPXTrackingUrl(trackingNumber, languageCode = "vi") {
  const url = new URL(SPX_TRACKING_ENDPOINT);
  url.searchParams.set("spx_tn", trackingNumber);
  url.searchParams.set("language_code", languageCode);
  return url;
}

export async function fetchSPXResponse(trackingNumber, languageCode = "vi") {
  return fetch(createSPXTrackingUrl(trackingNumber, languageCode), {
    headers: SPX_REQUEST_HEADERS,
    signal: AbortSignal.timeout(20000),
  });
}

export async function parseSPXResponse(response, trackingNumber) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`SPX HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("SPX trả về dữ liệu JSON không hợp lệ");
  }

  if (!payload || payload.retcode !== 0) {
    throw new Error(payload.message || "Không tìm thấy thông tin đơn hàng");
  }

  const records = payload?.data?.sls_tracking_info?.records;
  if (!Array.isArray(records)) {
    throw new Error("Không tìm thấy lịch sử vận chuyển");
  }

  const checkpoints = records.map((item) => {
    const currentLocation = item.current_location ?? {};
    const nextLocation = item.next_location ?? {};
    const description = item.buyer_description ?? item.tracking_name ?? "";
    const status =
      item.buyer_description ||
      item.tracking_name ||
      item.milestone_name ||
      "";

    return {
      time: item.actual_time ?? "",
      description,
      status,
      statusCode: String(
        item.milestone_code ??
          item.tracking_code ??
          item.tracking_name ??
          status,
      ),
      trackingName: item.tracking_name ?? "",
      milestoneCode: item.milestone_code ?? null,
      milestoneName: item.milestone_name ?? "",
      currentLocation: {
        name: currentLocation.location_name ?? "",
        address: currentLocation.full_address ?? "",
        lat: currentLocation.lat ?? "",
        lng: currentLocation.lng ?? "",
      },
      nextLocation: {
        name: nextLocation.location_name ?? "",
        address: nextLocation.full_address ?? "",
        lat: nextLocation.lat ?? "",
        lng: nextLocation.lng ?? "",
      },
    };
  });

  const latest = checkpoints[0] ?? null;
  if (latest && (!latest.status || !latest.statusCode)) {
    throw new Error("SPX không trả về trạng thái vận chuyển mới nhất");
  }

  return {
    trackingNumber,
    status: latest?.status ?? "Đang cập nhật",
    checkpoints,
  };
}

export function getLatestSPXStatus(tracking) {
  const latest = tracking.checkpoints[0];
  if (!latest) return null;

  return {
    status: latest.status,
    statusCode: latest.statusCode,
    timestamp: latest.time,
  };
}
