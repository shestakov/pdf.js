import { Dict, Name } from "./primitives.js";
import { DW, W } from "./LiberationSans-Regular_W.js";
import { Stream, StringStream } from "./stream.js";
import { cMap } from "./LiberationSans-Regular_cMap.js";
import { fetchBinaryData } from "./core_utils.js";

export async function embedTrueTypeFont(fontName, evaluator, xref, changes) {
  const fontStream = await evaluator.fetchStandardFontData(fontName);
  if (!fontStream) {
    throw new Error(`Failed to fetch font file for ${fontName}`);
  }

  fontStream.dict = new Dict(xref);
  fontStream.dict.set("Length", fontStream.length);
  fontStream.dict.set("Length1", fontStream.length);
  const fontStreamRef = xref.getNewTemporaryRef();
  changes.put(fontStreamRef, { data: fontStream });

  const fontDescriptor = new Dict(xref);
  fontDescriptor.set("Type", Name.get("FontDescriptor"));
  fontDescriptor.set("FontName", Name.get(fontName));

  // Parameters for ArialMT.ttx
  // fontDescriptor.set("Flags", 2075);
  // fontDescriptor.set("FontBBox", [-1361, -665, 4154, 2124]);
  // fontDescriptor.set("Ascent", 728);
  // fontDescriptor.set("Descent", -210);
  // fontDescriptor.set("CapHeight", 699);

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

  const toUnicodeCMapData = cMap;
  const toUnicodeStream = new StringStream(toUnicodeCMapData);
  toUnicodeStream.dict = new Dict(xref);
  toUnicodeStream.dict.set("Length", toUnicodeCMapData.length);
  const toUnicodeStreamRef = xref.getNewTemporaryRef();
  changes.put(toUnicodeStreamRef, { data: toUnicodeStream });
  xref.putTemporaryRefToCache(toUnicodeStreamRef, toUnicodeStream);

  const CIDToGIDMapBinaryData = await fetchBinaryData(
    // "/App/LiberationSans-Regular_CidToGIDMap.bin"
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
  cidFont.set("CIDToGIDMap", CIDToGIDMapStream); // WARN: for a real TrueType font IT IS NOT "Identity", see GlyphOrder ttx section
  cidFont.set("CIDSystemInfo", cidSystemInfo);
  cidFont.set("FontDescriptor", fontDescriptorRef);
  // NOTE: ToUnicode is set in the composite type0 font
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
  font.set("ToUnicode", toUnicodeStreamRef);

  const fontRef = xref.getNewTemporaryRef();
  changes.put(fontRef, { data: font });

  xref.putTemporaryRefToCache(fontRef, font);

  return fontRef;
}
