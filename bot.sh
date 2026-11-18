#!/usr/bin/env bash
MASTER_MAIN="/data/data/com.termux/files/home/ai_girl_bot/main.py"
DEV_MAIN="/storage/emulated/0/Dev/ai_girl_bot/main.py"
TARGET_MAIN="$MASTER_MAIN"
[ ! -f "$TARGET_MAIN" ] && TARGET_MAIN="$DEV_MAIN"

python3 "$TARGET_MAIN"
while read -p "ป๋า > " user_input; do
    [ -z "$user_input" ] && continue
    if [[ "$user_input" == "exit" ]] || [[ "$user_input" == "ออก" ]]; then
        echo "👋 ปิดหน้าต่างคุยแล้วค่ะป๋า"
        break
    elif [[ "$user_input" == !* ]] || [[ "$user_input" == \$* ]] || [[ "$user_input" == git* ]]; then
        eval "${user_input#[\!\$]}"
    elif [[ "$user_input" == *"กี่โมง"* ]]; then
        echo "⏰ $(date +%H:%M:%S)"
    else
        python3 "$TARGET_MAIN" "$user_input"
    fi
done
