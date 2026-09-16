export const isImageGenQuery = (text: string): boolean => {
  const t = text.toLowerCase().trim();
  if (!t) return false;
  return (
    /\b(generate|create|make|draw|paint|render|produce|design)\s+(an?\s+|me\s+)?(.{0,40}?)\s*(image|picture|photo|photograph|illustration|artwork|drawing|portrait|art)\b/.test(t) ||
    /\bimage\s+of\s+/.test(t) ||
    /\bpicture\s+of\s+/.test(t) ||
    /\bphoto\s+of\s+/.test(t) ||
    /^imagine\s+/.test(t) ||
    /^\/imagine\s+/.test(t)
  );
};
