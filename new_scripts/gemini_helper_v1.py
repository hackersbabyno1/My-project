import json, os, urllib.error, urllib.request

DEFAULT_MODEL = "gemini-flash-lite-latest"

def ask_gemini(prompt, api_key=None, model=None, timeout=20):
    key = (api_key if api_key is not None else os.environ.get("GEMINI_API_KEY") or "").strip()
    mdl = ((model if model is not None else os.environ.get("GEMINI_MODEL")) or DEFAULT_MODEL).strip()
    text = (prompt or "").strip()
    if not text:
        return {"ok": False, "model": mdl, "error": "empty_prompt", "text": None}
    if not key:
        return {"ok": False, "model": mdl, "error": "missing_api_key", "text": None}

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{mdl}:generateContent?key={key}"
    payload = {
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {"maxOutputTokens": 256, "temperature": 0.7},
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
            data = json.loads(raw) if raw else {}
            cands = data.get("candidates") or []
            parts = ((cands[0].get("content") or {}).get("parts") or []) if cands else []
            out_txt = "".join(p.get("text", "") for p in parts if isinstance(p, dict)).strip()
            if out_txt:
                return {"ok": True, "model": mdl, "error": None, "text": out_txt}
            return {"ok": False, "model": mdl, "error": "empty_response", "text": None}
    except urllib.error.HTTPError as e:
        eb = e.read().decode("utf-8", errors="ignore") if e.fp else ""
        return {"ok": False, "model": mdl, "error": f"http_{e.code}:{eb[:160]}", "text": None}
    except Exception as e:
        return {"ok": False, "model": mdl, "error": str(e)[:160], "text": None}

def generate_with_fallback(prompt, fallback_reply, api_key=None, model=None):
    res = ask_gemini(prompt, api_key=api_key, model=model)
    if res.get("ok") and res.get("text"):
        return res["text"], True, res.get("model")
    return fallback_reply, False, res.get("model")
