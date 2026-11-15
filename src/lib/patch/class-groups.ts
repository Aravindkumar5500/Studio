/** Tailwind utility groups the PropertiesInspector edits deterministically. */
export const CLASS_GROUPS = {
  display: [/^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden|contents)$/],
  flexDirection: [/^flex-(row|row-reverse|col|col-reverse)$/],
  justify: [/^justify-(start|end|center|between|around|evenly)$/],
  items: [/^items-(start|end|center|baseline|stretch)$/],
  gap: [/^gap-(x-|y-)?\[?[\w.%/-]+\]?$/],
  paddingX: [/^px-\[?[\w.%/-]+\]?$/],
  paddingY: [/^py-\[?[\w.%/-]+\]?$/],
  padding: [/^p-\[?[\w.%/-]+\]?$/],
  marginX: [/^mx-\[?[\w.%/-]+\]?$/],
  marginY: [/^my-\[?[\w.%/-]+\]?$/],
  width: [/^w-\[?[\w.%/-]+\]?$/],
  height: [/^h-\[?[\w.%/-]+\]?$/],
  bg: [/^bg-\[?[\w.#%/-]+\]?$/],
  // Any text-* token that is not a size or an alignment is a colour, so design
  // system tokens such as `text-primary` are handled like built-in palette names.
  textColor: [
    /^text-(?!xs$|sm$|base$|lg$|xl$|[2-9]xl$|left$|center$|right$|justify$)[a-z0-9][\w./%#-]*$/,
    /^text-\[#[0-9a-fA-F]{3,8}\]$/,
  ],
  fontSize: [/^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/],
  fontWeight: [/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/],
  fontFamily: [/^font-(sans|serif|mono)$/],
  textAlign: [/^text-(left|center|right|justify)$/],
  rounded: [/^rounded(-(none|sm|md|lg|xl|2xl|3xl|full))?$/],
  border: [/^border(-\d+)?$/],
  borderColor: [/^border-(?!\d+$)[a-z0-9][\w./%#-]*$/],
  shadow: [/^shadow(-(sm|md|lg|xl|2xl|none|inner))?$/],
} as const;

export type ClassGroup = keyof typeof CLASS_GROUPS;

export function isClassGroup(value: string): value is ClassGroup {
  return Object.prototype.hasOwnProperty.call(CLASS_GROUPS, value);
}

/** Splits a className value, preserving responsive/state prefixes. */
export function splitClasses(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

export function stripVariants(token: string): { variants: string; base: string } {
  const idx = token.lastIndexOf(":");
  if (idx === -1) return { variants: "", base: token };
  return { variants: token.slice(0, idx + 1), base: token.slice(idx + 1) };
}

export function tokenBelongsToGroup(token: string, group: ClassGroup, variantPrefix = ""): boolean {
  const { variants, base } = stripVariants(token);
  if (variants !== variantPrefix) return false;
  return CLASS_GROUPS[group].some((re) => re.test(base));
}

/**
 * Replaces (or inserts) the single token of `group` carrying `variantPrefix`.
 * An empty `value` removes the token.
 */
export function setGroupToken(
  className: string,
  group: ClassGroup,
  value: string,
): string {
  const { variants: variantPrefix, base } = stripVariants(value);
  const tokens = splitClasses(className).filter(
    (t) => !tokenBelongsToGroup(t, group, variantPrefix),
  );
  if (base) tokens.push(value);
  return tokens.join(" ");
}

export function addClass(className: string, value: string): string {
  const tokens = splitClasses(className);
  if (tokens.includes(value)) return tokens.join(" ");
  tokens.push(value);
  return tokens.join(" ");
}

export function removeClass(className: string, value: string): string {
  return splitClasses(className)
    .filter((t) => t !== value)
    .join(" ");
}

/** Reads the current token of a group, for populating inspector controls. */
export function getGroupToken(
  className: string,
  group: ClassGroup,
  variantPrefix = "",
): string | null {
  return (
    splitClasses(className).find((t) => tokenBelongsToGroup(t, group, variantPrefix)) ?? null
  );
}
