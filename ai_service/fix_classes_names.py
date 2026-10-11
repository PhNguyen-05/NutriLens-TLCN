"""
Điền tên món có dấu vào classes.json (chỉ sửa mục có name còn trùng slug,
không ghi đè tên bạn đã sửa tay).

Cần fill_names.py nằm cùng thư mục. Chạy:
  python fix_classes_names.py              (mặc định sửa classes.json)
  python fix_classes_names.py duong\\dan\\classes.json
"""
import json
import sys
from pathlib import Path

from fill_names import NAMES

path = Path(sys.argv[1] if len(sys.argv) > 1 else "classes.json")
data = json.loads(path.read_text(encoding="utf-8"))

changed = 0
for c in data:
    new = NAMES.get(c["slug"])
    if new and c["name"] == c["slug"]:
        c["name"] = new
        changed += 1

path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Đã cập nhật {changed}/{len(data)} tên món trong {path}")
