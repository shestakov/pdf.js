from fontTools.ttLib import TTFont
import struct

def generate_cid_to_gid_map(ttf_path, cid_range_end=0xFFFF):
    """
    Generates a binary CIDToGIDMap for the given TrueType font.

    Parameters:
      ttf_path (str): Path to the TrueType (.ttf) font file.
      cid_range_end (int): The maximum CID to map (default 0xFFFF).

    Returns:
      bytes: A binary string of length (cid_range_end+1)*2 representing the CIDToGIDMap.
    """
    # Load the TTF font
    font = TTFont(ttf_path)

    # Get the best cmap table that maps Unicode -> glyph name.
    # This usually uses platformID 3 (Microsoft) with encodingID 1 or 10.
    cmap = None
    for table in font['cmap'].tables:
        if table.platformID == 3 and table.platEncID in (1, 10):
            cmap = table.cmap
            break

    if cmap is None:
        raise ValueError("No usable cmap table found in the TTF.")

    # Get glyph order as a list; note that the first glyph is usually ".notdef".
    glyph_order = font.getGlyphOrder()

    # Create a list for CID to GID mapping: for each CID in the range,
    # if the CID (i.e., the Unicode code point) exists in the cmap,
    # look up its corresponding glyph name and then its index (GID) in glyph_order.
    # If the code point is not mapped, assign 0 (typically .notdef).
    cid_to_gid = [0] * (cid_range_end + 1)
    for cid in range(cid_range_end + 1):
        if cid in cmap:
            glyph_name = cmap[cid]
            try:
                # The GID is the index in the glyph order.
                gid = glyph_order.index(glyph_name)
            except ValueError:
                gid = 0  # fallback if the glyph is not found
            cid_to_gid[cid] = gid
        else:
            # For CIDs not present in the cmap, use 0 (.notdef)
            cid_to_gid[cid] = 0

    # Create the binary stream: each mapping is two bytes in big-endian order.
    binary_data = bytearray()
    for gid in cid_to_gid:
        binary_data.extend(struct.pack(">H", gid))

    return bytes(binary_data)

if __name__ == "__main__":
    import sys
    import os

    if len(sys.argv) < 2:
        print("Usage: python script.py path/to/font.ttf")
        sys.exit(1)

    ttf_path = sys.argv[1]

    # Generate CIDToGIDMap for the full 0x0000-0xFFFF range (you can limit this range if desired)
    cid_to_gid_map = generate_cid_to_gid_map(ttf_path, cid_range_end=0xFFFF)

    base_name = os.path.splitext(ttf_path)[0]
    output_path = f"{base_name}_CidToGIDMap.bin"

    with open(output_path, "wb") as f:
        f.write(cid_to_gid_map)

    print("CIDToGIDMap binary length:", len(cid_to_gid_map))
    print("First 64 bytes:", cid_to_gid_map[:64])
