import urllib.request
import json

ACCOUNT_ID = "ca9e360ba94ab541e9c6147bd9aec42e"
API_TOKEN = "cfat_WS7NHCBQeyEYbHXbjJwdZAQpPjqrwkJ83ti4NX9Zx79c3247e"
WORKER_NAME = "empty-wave-7ca3"

WORKER_CODE = """
import { connect } from 'cloudflare:sockets';

const ADMIN_UUID = '36ad7e5a-f6b3-4971-bc60-e0a2a3a1938e';
const WORKER_TOKEN = 'ca9e360ba94ab541e9c6147bd9aec42e';

export default {
  async fetch(request, env, ctx) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response(JSON.stringify({ status: "VLESS Worker Running", token: WORKER_TOKEN }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    server.accept();

    let isAuthorized = false;

    server.addEventListener('message', async (event) => {
      try {
        const data = new Uint8Array(event.data);
        if (!isAuthorized) {
          if (data.length < 18) {
            server.close();
            return;
          }
          const version = data[0];
          const receivedUuid = [...data.slice(1, 17)]
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          
          const formattedUuid = `${receivedUuid.slice(0, 8)}-${receivedUuid.slice(8, 12)}-${receivedUuid.slice(12, 16)}-${receivedUuid.slice(16, 20)}-${receivedUuid.slice(20)}`;

          if (formattedUuid === ADMIN_UUID) {
            isAuthorized = true;
            const responseHeader = new Uint8Array([version, 0]);
            server.send(responseHeader);
          } else {
            server.close();
          }
          return;
        }
      } catch (err) {
        server.close();
      }
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  },
};
"""

url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/scripts/{WORKER_NAME}"

req = urllib.request.Request(
    url,
    data=WORKER_CODE.encode('utf-8'),
    headers={
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/javascript"
    },
    method="PUT"
)

try:
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        if result.get("success"):
            print("🚀 อัปเดต Cloudflare Worker สำเร็จเรียบร้อย ลื่นปื๊ดๆ แล้วครับป๋า!")
        else:
            print(f"⚠️ มีข้อผิดพลาด: {result}")
except Exception as e:
    print(f"❌ เชื่อมต่อ API ไม่สำเร็จ: {e}")
