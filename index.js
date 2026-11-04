import { connect } from 'cloudflare:sockets';

export default {
  async fetch(request, env, ctx) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('VLESS Proxy Active', { status: 200 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    server.accept();

    const address = "";
    const port = 443;

    server.addEventListener('message', async event => {
      let data = event.data;
      // จัดการรับส่งข้อมูลผ่าน WebSocket ทะลุไปปลายทาง
      try {
        const writer = server;
        // ส่งข้อมูลเบื้องต้นเพื่อเปิดท่อ
      } catch (err) {
        console.error(err);
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }
};
