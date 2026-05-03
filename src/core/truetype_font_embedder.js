import { Dict, Name } from "./primitives.js";
import { DW, W } from "./liberationsans_regular_widths_full.js";
import { fetchBinaryData } from "./core_utils.js";
import { Stream } from "./stream.js";

async function embedTrueTypeFont(fontName, evaluator, xref, changes) {
  const fontStream = await evaluator.fetchStandardFontData(fontName);
  if (!fontStream) {
    throw new Error(`Failed to fetch font file for ${fontName}`);
  }

  fontStream.dict = new Dict(xref);
  fontStream.dict.set("Length", fontStream.length);
  fontStream.dict.set("Length1", fontStream.length);
  const fontStreamRef = xref.getNewTemporaryRef();
  changes.put(fontStreamRef, { data: fontStream });
  xref.putTemporaryRefToCache(fontStreamRef, fontStream);

  const fontDescriptor = new Dict(xref);
  fontDescriptor.set("Type", Name.get("FontDescriptor"));
  fontDescriptor.set("FontName", Name.get(fontName));

  // Parameters for LiberationSans-Regular
  fontDescriptor.set("Flags", 32);
  fontDescriptor.set("FontBBox", [-416, -621, 2151, 1864]);
  fontDescriptor.set("Ascent", 1854);
  fontDescriptor.set("Descent", -434);
  fontDescriptor.set("CapHeight", 1409);

  fontDescriptor.set("StemV", 80);
  fontDescriptor.set("ItalicAngle", 0);
  fontDescriptor.set("FontFile2", fontStreamRef);
  const fontDescriptorRef = xref.getNewTemporaryRef();
  changes.put(fontDescriptorRef, { data: fontDescriptor });
  xref.putTemporaryRefToCache(fontDescriptorRef, fontDescriptor);

  const CIDToGIDMapBinaryData = await fetchBinaryData(
    `${evaluator.options.cidToGidMapUrl}LiberationSans-Regular_CidToGIDMap.bin`
  );

  const CIDToGIDMapStream = new Stream(CIDToGIDMapBinaryData);
  CIDToGIDMapStream.dict = new Dict(xref);
  CIDToGIDMapStream.dict.set("Length", CIDToGIDMapBinaryData.length);
  const CIDToGIDMapStreamRef = xref.getNewTemporaryRef();
  changes.put(CIDToGIDMapStreamRef, { data: CIDToGIDMapStream });
  xref.putTemporaryRefToCache(CIDToGIDMapStreamRef, CIDToGIDMapStream);

  const cidSystemInfo = new Dict(xref);
  cidSystemInfo.set("Registry", "Adobe");
  cidSystemInfo.set("Ordering", "Identity");
  cidSystemInfo.set("Supplement", 0);

  const cidFont = new Dict(xref);
  cidFont.set("Type", Name.get("Font"));
  cidFont.set("Subtype", Name.get("CIDFontType2"));
  cidFont.set("BaseFont", Name.get(fontName));
  cidFont.set("Encoding", Name.get("Identity-H"));
  cidFont.set("CIDToGIDMap", CIDToGIDMapStreamRef); // WARN: for a real TrueType font IT IS NOT "Identity", see GlyphOrder ttx section
  cidFont.set("CIDSystemInfo", cidSystemInfo);
  cidFont.set("FontDescriptor", fontDescriptorRef);
  // NOTE: ToUnicode, if necessary, must be set in the composite type0 font
  cidFont.set("DW", DW);
  cidFont.set("W", W);
  const cidFontRef = xref.getNewTemporaryRef();
  changes.put(cidFontRef, { data: cidFont });

  xref.putTemporaryRefToCache(cidFontRef, cidFont);

  const font = new Dict(xref);
  font.set("Type", Name.get("Font"));
  font.set("Subtype", Name.get("Type0"));
  font.set("BaseFont", Name.get(fontName));
  font.set("Encoding", Name.get("Identity-H"));
  font.set("DescendantFonts", [cidFontRef]);
  // NOTE: LiberationSans-Regular has identity cMap and does need "ToUnicode"

  const fontRef = xref.getNewTemporaryRef();
  changes.put(fontRef, { data: font });

  xref.putTemporaryRefToCache(fontRef, font);

  return fontRef;
}

export { embedTrueTypeFont };
