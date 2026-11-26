import base64, hashlib, os, socket, struct, threading

WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

def compute_accept_key(sec_ws_key: str) -> str:
    raw = (sec_ws_key.strip() + WS_GUID).encode("utf-8")
    return base64.b64encode(hashlib.sha1(raw).digest()).decode("ascii")

def encode_text_frame(text: str, mask: bool = False) -> bytes:
    payload = text.encode("utf-8")
    n = len(payload)
    first_byte = 0x80 | 0x1  # FIN=1, opcode=1 (text)
    mask_bit = 0x80 if mask else 0x00
    if n < 126:
        header = struct.pack("!BB", first_byte, mask_bit | n)
    elif n < 65536:
        header = struct.pack("!BBH", first_byte, mask_bit | 126, n)
    else:
        header = struct.pack("!BBQ", first_byte, mask_bit | 127, n)
    if not mask:
        return header + payload
    mask_key = os.urandom(4)
    masked = bytes(b ^ mask_key[i % 4] for i, b in enumerate(payload))
    return header + mask_key + masked

def recv_exact(conn: socket.socket, size: int) -> bytes:
    buf = bytearray()
    while len(buf) < size:
        chunk = conn.recv(size - len(buf))
        if not chunk:
            raise ConnectionError("socket closed")
        buf.extend(chunk)
    return bytes(buf)

def read_frame(conn: socket.socket):
    hdr = recv_exact(conn, 2)
    b1, b2 = hdr[0], hdr[1]
    opcode = b1 & 0x0F
    masked = bool(b2 & 0x80)
    length = b2 & 0x7F
    if length == 126:
        length = struct.unpack("!H", recv_exact(conn, 2))[0]
    elif length == 127:
        length = struct.unpack("!Q", recv_exact(conn, 8))[0]
    mask_key = recv_exact(conn, 4) if masked else b""
    data = recv_exact(conn, length) if length > 0 else b""
    if masked and data:
        data = bytes(b ^ mask_key[i % 4] for i, b in enumerate(data))
    return opcode, data

def ws_client_exchange(host: str, port: int, message: str, timeout: float = 4.0) -> str:
    sec_key = base64.b64encode(os.urandom(16)).decode("ascii")
    req = (
        f"GET /ws HTTP/1.1\r\n"
        f"Host: {host}:{port}\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {sec_key}\r\n"
        f"Sec-WebSocket-Version: 13\r\n\r\n"
    ).encode("ascii")
    with socket.create_connection((host, port), timeout=timeout) as s:
        s.settimeout(timeout)
        s.sendall(req)
        resp = b""
        while b"\r\n\r\n" not in resp:
            chunk = s.recv(1024)
            if not chunk:
                raise ConnectionError("handshake closed")
            resp += chunk
        if b"101 " not in resp.splitlines()[0]:
            raise RuntimeError(f"bad handshake: {resp.splitlines()[0]!r}")
        s.sendall(encode_text_frame(message, mask=True))
        opcode, payload = read_frame(s)
        s.sendall(struct.pack("!BB", 0x88, 0x80) + os.urandom(4))
        return payload.decode("utf-8", errors="ignore") if opcode == 0x1 else ""
