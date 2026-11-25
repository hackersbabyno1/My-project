import fs from "node:fs";
import path from "node:path";
import express from "express";

const app = express();
const PORT = Number(process.env.VAULT_PORT || 8080);
const VAULT_DIR = "/root/work_new/vault";
fs.mkdirSync(VAULT_DIR, { recursive: true });

app.get("/", (req, res) => {
	const files = fs
		.readdirSync(VAULT_DIR, { withFileTypes: true })
		.filter((d) => d.isFile())
		.map((d) => d.name)
		.sort();

	const rows = files.length
		? files
				.map((name) => {
					const stat = fs.statSync(path.join(VAULT_DIR, name));
					return `
					<li>
						<strong>${name}</strong> (${stat.size} bytes)
						<a href="/download/${encodeURIComponent(name)}" download="${name}">
							<button type="button">หยิบไฟล์ออก (ดาวน์โหลด)</button>
						</a>
					</li>`;
				})
				.join("")
		: "<li>ยังไม่มีไฟล์ในตู้ (/root/work_new/vault)</li>";

	res.send(`
		<h2>ตู้เก็บไฟล์บน VPS (162.35.47.89)</h2>
		<p>โฟลเดอร์ตู้: <code>${VAULT_DIR}</code></p>
		<ul>${rows}</ul>
	`);
});

app.get("/download/:filename", (req, res) => {
	const safeName = path.basename(req.params.filename);
	const filePath = path.join(VAULT_DIR, safeName);
	if (!filePath.startsWith(VAULT_DIR + path.sep) || !fs.existsSync(filePath)) {
		return res.status(404).send("ไม่พบไฟล์ในตู้");
	}
	res.download(filePath, safeName);
});

app.listen(PORT, "0.0.0.0", () => {
	console.log(`VPS Vault running on http://0.0.0.0:${PORT} -> ${VAULT_DIR}`);
});
