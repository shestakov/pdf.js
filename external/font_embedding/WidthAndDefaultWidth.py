from fontTools.ttLib import TTFont
from collections import defaultdict, Counter
import os

def get_glyph_widths(font_path):
    font = TTFont(font_path)
    units_per_em = font['head'].unitsPerEm
    cmap = font.getBestCmap()  # Unicode → glyph name
    glyph_order = font.getGlyphOrder()
    gid_map = {glyph_name: gid for gid, glyph_name in enumerate(glyph_order)}
    hmtx = font['hmtx'].metrics

    cid_to_width = {}

    for cid in sorted(cmap.keys()):
        glyph_name = cmap[cid]
        gid = gid_map.get(glyph_name)
        if gid is None:
            continue  # skip unmapped
        advance = hmtx.get(glyph_name, (0,))[0]
        scaled_width = int(round(1000 * advance / units_per_em))
        cid_to_width[cid] = scaled_width

    return cid_to_width

def group_widths(widths, default_width):
    grouped = []
    sorted_cids = sorted(cid for cid in widths if widths[cid] != default_width)
    i = 0

    while i < len(sorted_cids):
        start_cid = sorted_cids[i]
        current_sequence = [start_cid]
        i += 1

        # Find block of consecutive CIDs
        while i < len(sorted_cids) and sorted_cids[i] == sorted_cids[i - 1] + 1:
            current_sequence.append(sorted_cids[i])
            i += 1

        # Now process the block to find same-width subranges and mixed sequences
        j = 0
        while j < len(current_sequence):
            cid = current_sequence[j]
            w = widths[cid]
            sub_start = j
            sub_end = j

            # Try to find a run of same widths
            while sub_end + 1 < len(current_sequence):
                next_cid = current_sequence[sub_end + 1]
                if widths[next_cid] != w:
                    break
                sub_end += 1

            run_length = sub_end - sub_start + 1
            if run_length >= 2:
                grouped.append([
                    current_sequence[sub_start],
                    current_sequence[sub_end],
                    w
                ])
                j = sub_end + 1
            else:
                # Collect next few that can't be grouped
                var_start = j
                var_values = [w]
                j += 1
                while j < len(current_sequence):
                    var_values.append(widths[current_sequence[j]])
                    j += 1
                    # Stop if the next two have the same width (potential group)
                    if (
                        j + 1 < len(current_sequence)
                        and widths[current_sequence[j]] == widths[current_sequence[j + 1]]
                    ):
                        break
                grouped.append([
                    current_sequence[var_start],
                    var_values
                ])

    return grouped

def generate_outputs(font_path):
    widths = get_glyph_widths(font_path)
    width_counts = Counter(widths.values())
    default_width = width_counts.most_common(1)[0][0]

    non_default_widths = {cid: w for cid, w in widths.items() if w != default_width}
    grouped = group_widths(non_default_widths, default_width)

    # JS-style output
    js_array = "export const W = [\n"
    for item in grouped:
        if len(item) == 3:
            js_array += f"  {item[0]}, {item[1]}, {item[2]},\n"
        else:
            array_str = ", ".join(str(w) for w in item[1])
            js_array += f"  {item[0]}, [{array_str}],\n"
    js_array += "];\n"
    js_array += f"export const DW = {default_width};"

    # PDF-style output
    pdf_array = "/W [\n"
    for item in grouped:
        if len(item) == 3:
            pdf_array += f"  {item[0]} {item[1]} {item[2]}\n"
        else:
            array_str = " ".join(str(w) for w in item[1])
            pdf_array += f"  {item[0]} [{array_str}]\n"
    pdf_array += "]\n"
    pdf_array += f"/DW {default_width}"

    return js_array, pdf_array

def write_outputs(font_path, js_output, pdf_output):
    base_name = os.path.splitext(font_path)[0]
    js_filename = f"{base_name}_W.js"
    txt_filename = f"{base_name}_W.txt"

    with open(js_filename, "w", encoding="utf-8") as f:
        f.write(js_output)
    with open(txt_filename, "w", encoding="utf-8") as f:
        f.write(pdf_output)

    print(f"✅ JS output written to: {js_filename}")
    print(f"✅ PDF text output written to: {txt_filename}")

# Example usage
if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python script.py path/to/font.ttf")
        sys.exit(1)

    font_file = sys.argv[1]
    js_output, pdf_output = generate_outputs(font_file)
    write_outputs(font_file, js_output, pdf_output)

    print("JavaScript /W Array:")
    print(js_output)
    print("\nPDF /W Array:")
    print(pdf_output)
