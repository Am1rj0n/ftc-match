from PIL import Image, ImageDraw
import numpy as np

def generate_circular_icons():
    """
    Creates circular search-optimized favicons by:
    1. Extracting the white 'F' logo from the source favicon via luminosity mask
    2. Placing it cleanly onto a solid dark-navy circle (#080b15)
    The circular versions are used for Google Search / large-icon contexts.
    The original square favicon.png is NOT modified.
    """
    img = Image.open('favicon.png').convert("RGBA")
    data = np.array(img, dtype=np.float32)

    # ---- Extract logo via luminosity ----
    # Luminosity of each pixel (0–255): bright = logo, dark = background
    luma = 0.299 * data[:, :, 0] + 0.587 * data[:, :, 1] + 0.114 * data[:, :, 2]

    # Normalize luma to [0, 1]
    luma_norm = luma / 255.0

    # Build RGBA: white logo pixels get full alpha, background fades to 0
    # Stretch contrast: pixels below threshold become 0, above become logo
    threshold = 0.35
    alpha_mask = np.clip((luma_norm - threshold) / (1.0 - threshold), 0, 1)

    logo_rgba = np.zeros((img.height, img.width, 4), dtype=np.uint8)
    logo_rgba[:, :, 0] = 255   # R - white logo
    logo_rgba[:, :, 1] = 255   # G - white logo
    logo_rgba[:, :, 2] = 255   # B - white logo
    logo_rgba[:, :, 3] = (alpha_mask * 255).astype(np.uint8)

    logo = Image.fromarray(logo_rgba, 'RGBA')

    # ---- Build the circular canvas at high res ----
    base_size = 1024
    bg_color = (8, 11, 21, 255)   # #080b15 — the site's background

    base = Image.new("RGBA", (base_size, base_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(base)
    draw.ellipse((0, 0, base_size - 1, base_size - 1), fill=bg_color)

    # ---- Resize logo to ~72% of circle (safe zone for circular masks) ----
    target_size = int(base_size * 0.72)
    logo_resized = logo.resize((target_size, target_size), Image.Resampling.LANCZOS)

    # ---- Center-paste with alpha compositing ----
    offset = (base_size - target_size) // 2
    base.paste(logo_resized, (offset, offset), logo_resized)

    # ---- Output all required sizes ----
    sizes = [512, 192, 48, 32]
    for size in sizes:
        output = base.resize((size, size), Image.Resampling.LANCZOS)
        output.save(f'favicon-search-{size}.png', 'PNG')
        print(f"Generated favicon-search-{size}.png ({size}×{size})")

if __name__ == "__main__":
    generate_circular_icons()
