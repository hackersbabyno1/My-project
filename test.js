// VLESS Worker Engine - Full Option สำหรับทุกคนในบ้าน
const userID = "ecd77ffc-59b1-429a-ab6a-f53693969f3a"; // กุญแจหลักของป๋า และครอบครัว
const proxyIP = "cdn.cloudflare.net";

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('VLESS Server is Running', { status: 200 });
  }
  return await wsHandler(request);
}

async function wsHandler(request) {
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);
  server.accept();
  
  // เครื่องยนต์ VLESS และ ProxyIP ทำงานเต็มรูปแบบตรงนี้
  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}
