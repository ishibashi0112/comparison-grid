// className の連結ユーティリティです(空 / false / undefined を除去)。
export const cx = (
  ...parts: Array<string | false | null | undefined>
): string | undefined => {
  const out = parts.filter(
    (part): part is string => typeof part === 'string' && part.length > 0,
  );
  return out.length > 0 ? out.join(' ') : undefined;
};
