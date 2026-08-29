// 「中身が同じなら前回の参照を返す」参照安定化フックです。
//   目的: 利用側が compareFields / keyColumnKeys / columns / labels をインラインで書いても、
//   中身(浅い比較)が変わらない限り useMemo の依存を壊さないようにします(関数の同一性は
//   Object.is で比較するため、インライン関数を含む場合は毎レンダー新しい値と見なされ、正しく再計算されます)。
//   実装は React 公式の「前回レンダーの情報を保存する」パターン(条件付きの render 中 setState)で、
//   ref の render 中書き込みを使いません。
import { useState } from 'react';

export const shallowEqualObject = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const recordA = a as Record<string, unknown>;
  const recordB = b as Record<string, unknown>;
  const keysA = Object.keys(recordA);
  if (keysA.length !== Object.keys(recordB).length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(recordB, key)) return false;
    if (!Object.is(recordA[key], recordB[key])) return false;
  }
  return true;
};

export const shallowEqualArray = (
  a: readonly unknown[] | undefined,
  b: readonly unknown[] | undefined,
): boolean => {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (!shallowEqualObject(a[i], b[i])) return false;
  }
  return true;
};

export function useStableValue<T>(
  value: T,
  isEqual: (previous: T, next: T) => boolean,
): T {
  const [stable, setStable] = useState(value);
  if (stable !== value && !isEqual(stable, value)) {
    setStable(value);
    return value;
  }
  return stable;
}

/** 要素を浅く比較して同じなら前回の配列参照を返します。 */
export const useStableArray = <A extends readonly unknown[] | undefined>(value: A): A =>
  useStableValue(value, shallowEqualArray);

/** 浅く比較して同じなら前回のオブジェクト参照を返します。 */
export const useStableObject = <O extends object | undefined>(value: O): O =>
  useStableValue(value, shallowEqualObject);
