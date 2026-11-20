import { getLatestSPXStatus, fetchSPXResponse, parseSPXResponse } from "../src/utils/spx.js";

export async function getSPXTracking(trackingNumber) {
  const response = await fetchSPXResponse(trackingNumber);
  const tracking = await parseSPXResponse(response, trackingNumber);
  return getLatestSPXStatus(tracking);
}
