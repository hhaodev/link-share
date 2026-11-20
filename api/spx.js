import { fetchSPXResponse } from "../src/utils/spx.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      message: "Method not allowed",
    });
  }

  const { spx_tn, language_code = "vi" } = req.query;

  if (!spx_tn) {
    return res.status(400).json({
      message: "Missing tracking number",
    });
  }

  try {
    const response = await fetchSPXResponse(spx_tn, language_code);

    const data = await response.text();

    return res
      .status(response.status)
      .setHeader(
        "Content-Type",
        response.headers.get("content-type") || "application/json",
      )
      .setHeader("Cache-Control", "no-store")
      .send(data);
  } catch (error) {
    console.error("SPX Error:", error);

    return res.status(502).json({
      message: "Cannot connect to SPX",
      error: error.message,
    });
  }
}
