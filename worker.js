export default {
  async fetch(request, env, ctx) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("VLESS Proxy Running", { status: 200 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = [webSocketPair[0], webSocketPair[1]];
    server.accept();

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  },
};
