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
    const target = new URL(
      "https://spx.vn/shipment/order/open/order/get_order_info",
    );

    target.searchParams.set("spx_tn", spx_tn);
    target.searchParams.set("language_code", language_code);

    const response = await fetch(target.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
        Referer: "https://spx.vn/",
      },
    });

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
