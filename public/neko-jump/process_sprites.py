import os
from PIL import Image

def remove_white_bg_soft(img_path, threshold_low=200, threshold_high=245):
    """
    白背景を除去し、エッジに白いフチ（ヘイロー）が残るのを防ぐために
    白に近いグラデーション領域を滑らかに半透明化（ソフト透過）する。
    さらに、透明な余白を自動クロップする。
    """
    if not os.path.exists(img_path):
        print(f"File not found: {img_path}")
        return None
        
    img = Image.open(img_path).convert("RGBA")
    width, height = img.size
    datas = img.getdata()
    
    new_data = []
    for item in datas:
        r, g, b, a = item
        # RGBの平均値で白っぽさを判定
        avg = (r + g + b) / 3.0
        
        if avg >= threshold_high:
            # 完全に白に近い領域は完全透明
            new_data.append((255, 255, 255, 0))
        elif avg >= threshold_low:
            # 中間領域は、白に近いほど透明度を上げる（線形補間）
            ratio = (avg - threshold_low) / (threshold_high - threshold_low)
            new_alpha = int(255 * (1.0 - ratio))
            # 色自体も背景の白を差し引いて暗く補正し、白いフチを消す
            factor = 1.0 - ratio
            new_r = int(r * factor)
            new_g = int(g * factor)
            new_b = int(b * factor)
            new_data.append((new_r, new_g, new_b, min(a, new_alpha)))
        else:
            # 暗い領域は元の色を維持
            new_data.append(item)
            
    img.putdata(new_data)
    
    # オートクロップ
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    return img

def slice_and_save_crow_soft(sheet_path, out_dir):
    """
    カラスのスプライトシートからソフト透過で2つの羽ばたきフレームを切り出す。
    """
    transparent_sheet = remove_white_bg_soft(sheet_path, threshold_low=195, threshold_high=240)
    if transparent_sheet is None:
        return
        
    w, h = transparent_sheet.size
    half_w = w // 2
    
    # 左半分（羽上げ）
    crow0 = transparent_sheet.crop((0, 0, half_w, h))
    bbox0 = crow0.getbbox()
    if bbox0:
        crow0 = crow0.crop(bbox0)
    crow0.save(os.path.join(out_dir, "crow-0.png"), "PNG")
    print("Saved high-quality transparent crow-0.png")
    
    # 右半分（羽下げ）
    crow1 = transparent_sheet.crop((half_w, 0, w, h))
    bbox1 = crow1.getbbox()
    if bbox1:
        crow1 = crow1.crop(bbox1)
    crow1.save(os.path.join(out_dir, "crow-1.png"), "PNG")
    print("Saved high-quality transparent crow-1.png")

def process_all_assets_high_quality():
    out_dir = r"d:\04_ゲーム\neko-jump"
    os.makedirs(out_dir, exist_ok=True)
    
    # 新しい完璧な風船ネズミを含むアセットリスト
    assets = {
        "rat": (r"C:\Users\motoya\.gemini\antigravity\brain\5f1d60f9-7501-46ed-b89a-ffdf90c4b903\balloon_rat_perfect_1780160077613.png", "rat.png"),
        "yarn": (r"C:\Users\motoya\.gemini\antigravity\brain\5f1d60f9-7501-46ed-b89a-ffdf90c4b903\yarn_ball_1780159360619.png", "yarn.png"),
        "collar": (r"C:\Users\motoya\.gemini\antigravity\brain\5f1d60f9-7501-46ed-b89a-ffdf90c4b903\spiked_collar_1780159379064.png", "collar.png"),
        "shield": (r"C:\Users\motoya\.gemini\antigravity\brain\5f1d60f9-7501-46ed-b89a-ffdf90c4b903\shield_item_1780159490390.png", "shield.png"),
    }
    
    # カラスのスライス透過
    crow_sheet = r"C:\Users\motoya\.gemini\antigravity\brain\5f1d60f9-7501-46ed-b89a-ffdf90c4b903\crow_sheet_1780159789484.png"
    slice_and_save_crow_soft(crow_sheet, out_dir)
    
    # 他のアセットのソフト透過
    for name, (src_path, filename) in assets.items():
        print(f"Processing soft transparent {name}...")
        trans_img = remove_white_bg_soft(src_path, threshold_low=195, threshold_high=242)
        if trans_img:
            trans_img.save(os.path.join(out_dir, filename), "PNG")
            print(f"Saved high-quality transparent {filename}")
            
    # シームレス壁
    brick_src = r"C:\Users\motoya\.gemini\antigravity\brain\5f1d60f9-7501-46ed-b89a-ffdf90c4b903\brick_seamless_1780159774582.png"
    if os.path.exists(brick_src):
        brick_img = Image.open(brick_src)
        brick_img = brick_img.resize((128, 128), Image.Resampling.LANCZOS)
        brick_img.save(os.path.join(out_dir, "brick-wall.png"), "PNG")
        print("Saved sharp seamless brick-wall.png")

if __name__ == "__main__":
    process_all_assets_high_quality()
