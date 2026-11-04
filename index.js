export default {
  async fetch(request, env, ctx) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Smart Tunnel Active', { status: 200 });
    }

    const clientUUID = request.headers.get('sec-websocket-protocol');
    
    // รายชื่อกุญแจที่อนุญาตให้เข้าใช้งาน
    const allowedUUIDs = [
      "dcae7e65-8416-48a7-a856-a74aede47fa9" // เครื่องที่ 5 (ระบบจะเริ่มนับเวลาเมื่อต่อครั้งแรก)
    ];

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    server.accept();

    return new Response(null, { status: 101, webSocket: client });
  }
};
