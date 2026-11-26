import uuid

WORKER_DOMAIN = "empty-wave-7ca3.hackersbabyno1.workers.dev"
PORT = 443
PATH = "/vless"

USERS = [
    {"name": "Admin-Key", "uuid": "36ad7e5a-f6b3-4971-bc60-e0a2a3a1938e"},
    {"name": "Family-Key-01", "uuid": str(uuid.uuid4())},
    {"name": "Family-Key-02", "uuid": str(uuid.uuid4())},
    {"name": "Family-Key-03", "uuid": str(uuid.uuid4())},
    {"name": "Family-Key-04", "uuid": str(uuid.uuid4())}
]

def generate_multi_keys():
    print("=" * 60)
    print(" 🔑 รายการลิงก์ Multi-Key สำหรับ Cloudflare Worker")
    print("=" * 60)
    
    for user in USERS:
        remark = f"VLESS-{user['name']}"
        link = f"vless://{user['uuid']}@{WORKER_DOMAIN}:{PORT}?encryption=none&security=tls&type=ws&host={WORKER_DOMAIN}&path={PATH}#{remark.replace(' ', '%20')}"
        
        print(f"\n[ชื่อผู้ใช้]: {user['name']}")
        print(f"UUID : {user['uuid']}")
        print(f"Link : {link}")
        print("-" * 60)

if __name__ == "__main__":
    generate_multi_keys()
