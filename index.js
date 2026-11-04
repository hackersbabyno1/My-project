export default {
  async fetch(request, env, ctx) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('VLESS Tunnel Active', { status: 200 });
    }

    const clientUUID = request.headers.get('sec-websocket-protocol');
    
    // ฐานข้อมูลกุญแจที่ได้รับอนุญาต (1-4 VIP ถาวร | 5 เทส 3 วัน)
    const allowedUUIDs = [
      "194dd8c8-19d5-4bfb-b435-78d4b952fcb5",
      "fca0ec12-bf1e-42ee-bc97-3c0b11be6a26",
      "ecd77ffc-59b1-429a-ab6a-f53693969f3a",
      "367ea5dd-1cea-4453-bda3-ca23cefadac3",
      "dcae7e65-8416-48a7-a856-a74aede47fa9"
    ];

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    server.accept();

    return new Response(null, { status: 101, webSocket: client });
  }
};
