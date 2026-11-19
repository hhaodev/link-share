// ─── Time ─────────────────────────────────────────────────────────────────────

export function timeAgo(date) {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Format a raw timestamp (number = unix seconds, string = ISO) to vi-VN locale.
 * @param {number|string} raw
 * @param {boolean} includeYear
 */
export function formatTime(raw, includeYear = true) {
  if (!raw) return "";
  const d = new Date(typeof raw === "number" ? raw * 1000 : raw);
  if (isNaN(d)) return String(raw);
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    ...(includeYear ? { year: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── URL ──────────────────────────────────────────────────────────────────────

export function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Map các subdomain / shortlink về domain gốc để lấy favicon đúng
const DOMAIN_MAP = {
  "s.shopee.vn": "shopee.vn",
  "shp.ee": "shopee.vn",
  "s.lazada.vn": "lazada.vn",
  "s.tiki.vn": "tiki.vn",
  "bit.ly": null,
  "t.co": null,
};

export function getDomain(url) {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    return DOMAIN_MAP[hostname] ?? hostname;
  } catch {
    return url;
  }
}

// ─── SPX tracking ─────────────────────────────────────────────────────────────

const STATUS_COLOR = {
  delivered: "status--green",
  success: "status--green",
  failed: "status--red",
  cancelled: "status--red",
  pickup: "status--blue",
  intransit: "status--blue",
  default: "status--gray",
};

export function getStatusClass(description = "") {
  const d = description.toLowerCase();
  if (d.includes("giao thành công") || d.includes("delivered"))
    return STATUS_COLOR.delivered;
  if (d.includes("thất bại") || d.includes("hoàn")) return STATUS_COLOR.failed;
  if (d.includes("đang giao") || d.includes("vận chuyển"))
    return STATUS_COLOR.intransit;
  if (d.includes("lấy hàng") || d.includes("pickup"))
    return STATUS_COLOR.pickup;
  return STATUS_COLOR.default;
}

export function normalizeTracking(trackingNumber, records) {
  const checkpoints = records.map((item) => {
    const cur = item.current_location ?? {};
    const nxt = item.next_location ?? {};

    return {
      time: item.actual_time ?? "",
      description: item.buyer_description ?? item.tracking_name ?? "",
      trackingName: item.tracking_name ?? "",
      milestoneCode: item.milestone_code ?? null,
      milestoneName: item.milestone_name ?? "",
      currentLocation: {
        name: cur.location_name ?? "",
        address: cur.full_address ?? "",
        lat: cur.lat ?? "",
        lng: cur.lng ?? "",
      },
      nextLocation: {
        name: nxt.location_name ?? "",
        address: nxt.full_address ?? "",
        lat: nxt.lat ?? "",
        lng: nxt.lng ?? "",
      },
    };
  });

  const latest = checkpoints[0] ?? null;

  return {
    trackingNumber,
    status: latest?.description ?? "Đang cập nhật",
    checkpoints,
  };
}
