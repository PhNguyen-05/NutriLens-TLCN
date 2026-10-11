"""
Tự điền cột 'ten_hien_thi (co dau)' trong class_mapping.csv.
Chỉ điền ô đang trống, không ghi đè tên bạn đã sửa tay.

Chạy (trong thư mục chứa class_mapping.csv):
  python fill_names.py
"""
import csv
import sys

COL = "ten_hien_thi (co dau)"

NAMES = {
    # VinaFood21
    "thit-kho-trung": "Thịt kho trứng",
    "pha-lau": "Phá lấu",
    "tau-hu": "Tàu hũ",
    "ha-cao": "Há cảo",
    "hoanh-thanh-nuoc": "Hoành thánh nước",
    "goi-ga": "Gỏi gà",
    "ga-nuong": "Gà nướng",
    "canh-khoai-mo": "Canh khoai mỡ",
    "canh-kho-qua": "Canh khổ qua",
    "ca-ri": "Cà ri",
    "bot-chien": "Bột chiên",
    "bo-la-lot": "Bò lá lốt",
    "bo-kho": "Bò kho",
    "bap-nuong": "Bắp nướng",
    "banh-uot": "Bánh ướt",
    "banh-u": "Bánh ú",
    "banh-trang-tron": "Bánh tráng trộn",
    "banh-mi-chao": "Bánh mì chảo",
    "banh-hoi": "Bánh hỏi",
    # Có ở cả hai dataset
    "banh-tet": "Bánh tét",
    "banh-can": "Bánh căn",
    # 30VNFoods
    "chao-long": "Cháo lòng",
    "com-tam": "Cơm tấm",
    "goi-cuon": "Gỏi cuốn",
    "hu-tieu": "Hủ tiếu",
    "mi-quang": "Mì Quảng",
    "nem-chua": "Nem chua",
    "pho": "Phở",
    "xoi-xeo": "Xôi xéo",
    "bun-dau-mam-tom": "Bún đậu mắm tôm",
    "bun-mam": "Bún mắm",
    "bun-rieu": "Bún riêu",
    "bun-thit-nuong": "Bún thịt nướng",
    "ca-kho-to": "Cá kho tộ",
    "canh-chua": "Canh chua",
    "cao-lau": "Cao lầu",
    "banh-mi": "Bánh mì",
    "banh-pia": "Bánh pía",
    "banh-trang-nuong": "Bánh tráng nướng",
    "banh-xeo": "Bánh xèo",
    "bun-bo-hue": "Bún bò Huế",
    "banh-canh": "Bánh canh",
    "banh-chung": "Bánh chưng",
    "banh-cuon": "Bánh cuốn",
    "banh-duc": "Bánh đúc",
    "banh-gio": "Bánh giò",
    "banh-khot": "Bánh khọt",
    "banh-beo": "Bánh bèo",
    "banh-bot-loc": "Bánh bột lọc",
}


def main(path="class_mapping.csv"):
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames
        rows = list(reader)

    filled, missing = 0, []
    for r in rows:
        if (r[COL] or "").strip():
            continue
        name = NAMES.get(r["slug"])
        if name:
            r[COL] = name
            filled += 1
        else:
            missing.append(r["slug"])

    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    print(f"Đã điền {filled}/{len(rows)} lớp")
    if missing:
        print("Chưa có tên cho:", ", ".join(missing))


if __name__ == "__main__":
    main(*sys.argv[1:2])
