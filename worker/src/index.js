import { pollSPX } from "./spx.js";

function getErrorDetails(error) {
  return {
    name: error?.name || "Error",
    message: error?.message || String(error),
    stack: error?.stack || "",
  };
}

export default {
  async scheduled(_event, env, context) {
    context.waitUntil(
      pollSPX(env).catch((error) => {
        console.error(
          "FATAL SPX polling error:",
          JSON.stringify(getErrorDetails(error)),
        );
        throw error;
      }),
    );
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }

    if (request.method !== "POST" || url.pathname !== "/run") {
      return Response.json({ message: "Not found" }, { status: 404 });
    }
    if (!env.POLL_SECRET) {
      return Response.json(
        { message: "POLL_SECRET is not configured" },
        { status: 503 },
      );
    }
    if (request.headers.get("Authorization") !== `Bearer ${env.POLL_SECRET}`) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    let options = {};
    const body = await request.text();
    if (body) {
      try {
        options = JSON.parse(body);
      } catch {
        return Response.json({ message: "Invalid JSON body" }, { status: 400 });
      }
    }

    try {
      const summary = await pollSPX(env, options.testNotification === true);
      return Response.json({ status: "ok", summary });
    } catch (error) {
      const details = getErrorDetails(error);
      console.error("FATAL SPX polling error:", JSON.stringify(details));
      return Response.json(
        { status: "error", message: details.message },
        { status: 500 },
      );
    }
  },
};
