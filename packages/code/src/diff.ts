/**
 * Result of {@link patienceDiff}. Each entry marks a token as kept
 * (`aIndex >= 0 && bIndex >= 0`), deleted (`bIndex === -1`), or inserted
 * (`aIndex === -1`).
 */
export interface PatienceDiffResult {
  lines: { line: string; aIndex: number; bIndex: number }[];
  lineCountDeleted: number;
  lineCountInserted: number;
}

/**
 * Patience diff over two token arrays. Adapted from Jonathan Trent's
 * PatienceDiff (https://github.com/jonTrent/PatienceDiff).
 */
interface Subsequence {
  aIndex: number;
  bIndex: number;
  prev?: Subsequence | undefined;
}

export function patienceDiff(aLines: string[], bLines: string[]): PatienceDiffResult {
  function findUnique(lines: string[], start: number, end: number) {
    const lineMap = new Map<string, { count: number; index: number }>();
    for (let i = start; i <= end; i++) {
      const line = lines[i] as string;
      const data = lineMap.get(line);
      if (data) {
        data.count++;
        data.index = i;
      } else {
        lineMap.set(line, { count: 1, index: i });
      }
    }

    const newMap = new Map<string, number>();
    for (const [key, value] of lineMap) {
      if (value.count === 1) {
        newMap.set(key, value.index);
      }
    }

    return newMap;
  }

  function uniqueCommon(
    aArray: string[],
    aStart: number,
    aEnd: number,
    bArray: string[],
    bStart: number,
    bEnd: number,
  ): Map<string, Subsequence> {
    const aUnique = findUnique(aArray, aStart, aEnd);
    const bUnique = findUnique(bArray, bStart, bEnd);

    return [...aUnique.entries()].reduce<Map<string, Subsequence>>((paired, [key, value]) => {
      const bIndex = bUnique.get(key);
      if (bIndex !== undefined) {
        paired.set(key, { aIndex: value, bIndex });
      }
      return paired;
    }, new Map());
  }

  function longestCommonSubsequence(abMap: Map<string, Subsequence>): Subsequence[] {
    const jagged: [Subsequence][] = [];

    for (const value of abMap.values()) {
      let i = 0;
      // biome-ignore lint/style/noNonNullAssertion: jagged[i] is truthy in the guard
      while (jagged[i] && jagged[i]!.at(-1)!.bIndex < value.bIndex) {
        i++;
      }

      if (i > 0) {
        value.prev = (jagged[i - 1] as [Subsequence]).at(-1);
      }

      if (!jagged[i]) {
        jagged[i] = [value];
      } else {
        (jagged[i] as [Subsequence]).push(value);
      }
    }

    let lcs: Subsequence[] = [];

    if (jagged.length > 0) {
      // biome-ignore lint/style/noNonNullAssertion: jagged is non-empty here
      lcs = [jagged.at(-1)!.at(-1)!];
      let cursor: Subsequence | undefined = lcs.at(-1);
      while (cursor?.prev) {
        cursor = cursor.prev;
        lcs.push(cursor);
      }
    }

    return lcs.reverse();
  }

  const result: { line: string; aIndex: number; bIndex: number }[] = [];
  let deleted = 0;
  let inserted = 0;

  function addToResult(aIndex: number, bIndex: number) {
    if (bIndex < 0) {
      deleted++;
    } else if (aIndex < 0) {
      inserted++;
    }
    result.push({
      line: (aIndex >= 0 ? aLines[aIndex] : bLines[bIndex]) as string,
      aIndex,
      bIndex,
    });
  }

  function addSubMatch(aStart: number, aEnd: number, bStart: number, bEnd: number) {
    while (aStart <= aEnd && bStart <= bEnd && aLines[aStart] === bLines[bStart]) {
      addToResult(aStart++, bStart++);
    }

    const aEndTemp = aEnd;
    while (aStart <= aEnd && bStart <= bEnd && aLines[aEnd] === bLines[bEnd]) {
      aEnd--;
      bEnd--;
    }

    const uniqueCommonMap = uniqueCommon(aLines, aStart, aEnd, bLines, bStart, bEnd);

    if (uniqueCommonMap.size === 0) {
      while (aStart <= aEnd) {
        addToResult(aStart++, -1);
      }
      while (bStart <= bEnd) {
        addToResult(-1, bStart++);
      }
    } else {
      recurseLCS(aStart, aEnd, bStart, bEnd, uniqueCommonMap);
    }

    while (aEnd < aEndTemp) {
      addToResult(++aEnd, ++bEnd);
    }
  }

  function recurseLCS(
    aStart: number,
    aEnd: number,
    bStart: number,
    bEnd: number,
    uniqueCommonMap: Map<string, Subsequence> = uniqueCommon(
      aLines,
      aStart,
      aEnd,
      bLines,
      bStart,
      bEnd,
    ),
  ) {
    const lcs = longestCommonSubsequence(uniqueCommonMap);

    if (lcs.length === 0) {
      addSubMatch(aStart, aEnd, bStart, bEnd);
    } else {
      const head = lcs[0] as Subsequence;
      if (aStart < head.aIndex || bStart < head.bIndex) {
        addSubMatch(aStart, head.aIndex - 1, bStart, head.bIndex - 1);
      }

      let i: number;
      for (i = 0; i < lcs.length - 1; i++) {
        const cur = lcs[i] as Subsequence;
        const next = lcs[i + 1] as Subsequence;
        addSubMatch(cur.aIndex, next.aIndex - 1, cur.bIndex, next.bIndex - 1);
      }

      const tail = lcs[i] as Subsequence;
      if (tail.aIndex <= aEnd || tail.bIndex <= bEnd) {
        addSubMatch(tail.aIndex, aEnd, tail.bIndex, bEnd);
      }
    }
  }

  recurseLCS(0, aLines.length - 1, 0, bLines.length - 1);

  return {
    lines: result,
    lineCountDeleted: deleted,
    lineCountInserted: inserted,
  };
}
