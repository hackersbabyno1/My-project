export default {
  async fetch(request, env, ctx) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('My Net Tunnel is Running Successfully!', { status: 200 });
    }
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    server.accept();

    server.addEventListener('message', async (event) => {
      try {
        // VLESS Processing Engine
      } catch (err) {
        server.close();
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }
};
