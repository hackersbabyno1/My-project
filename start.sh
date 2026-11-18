#!/bin/bash
echo "🧹 กำลังเคลียร์พอร์ตและกระบวนการเก่าให้เกลี้ยง..."
pkill -f python
sleep 1
echo "🚀 กำลังสตาร์ทระบบใหม่แบบไร้รอยต่อ..."
python /storage/emulated/0/Dev/ai_girl_bot/main.py
