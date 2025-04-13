from fontTools.ttLib import TTFont

def generate_cmap(ttf_path):
    font = TTFont(ttf_path)
    cmap_table = font["cmap"]

    # Choose the Unicode subtable
    unicode_cmap = None
    for subtable in cmap_table.tables:
        if subtable.platformID == 3 and subtable.platEncID in (1, 10):  # Windows Unicode
            unicode_cmap = subtable
            break

    # Collect mapping: charCode → Unicode
    char_map = unicode_cmap.cmap  # {int: glyph_name}
    return char_map

def generate_cmap_text(char_map, cmap_name):
    lines = []
    lines.append(f"/CIDInit /ProcSet findresource begin")
    lines.append("12 dict begin")
    lines.append("begincmap")
    lines.append(f"/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def")
    lines.append(f"/CMapName /{cmap_name} def")
    lines.append("/CMapType 2 def")
    lines.append("1 begincodespacerange")
    lines.append("<0000> <FFFF>")
    lines.append("endcodespacerange")

    # Add Unicode mappings in blocks of 100
    items = list(char_map.items())
    for i in range(0, len(items), 100):
        chunk = items[i:i+100]
        lines.append(f"{len(chunk)} beginbfchar")
        for codepoint, glyph_name in chunk:
            lines.append(f"<{codepoint:04X}> <{codepoint:04X}>")
        lines.append("endbfchar")

    lines.append("endcmap")
    lines.append("CMapName currentdict /CMap defineresource pop")
    lines.append("end")
    lines.append("end")
    return "\n".join(lines)

def generate_cmap_js(cmap_text):
    return f"export cont cMap = `{cmap_text}`;"

if __name__ == "__main__":
    import sys
    import os
    import zlib

    if len(sys.argv) < 2:
        print("Usage: python script.py path/to/font.ttf")
        sys.exit(1)

    ttf_path = sys.argv[1]

    base_name = os.path.splitext(ttf_path)[0]

    char_map = generate_cmap(ttf_path)
    cmap_text = generate_cmap_text(char_map, base_name)

    with open(f"{base_name}.cmap", "wb") as f:
         f.write(cmap_text.encode("utf-8"))

    with open(f"{base_name}_cMap.js", "wb") as f:
         f.write(generate_cmap_js(cmap_text).encode("utf-8"))

    with open(f"{base_name}.bmap", "wb") as f:
         compressed = zlib.compress(cmap_text.encode("utf-8"))
         f.write(compressed)
