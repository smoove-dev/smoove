import type { HighlightStyle } from "@codemirror/language";
import type { Parser, SyntaxNode, Tree } from "@lezer/common";
import { highlightTree } from "@lezer/highlight";
import { DefaultHighlightStyle } from "./default-highlight-style.js";
import type { CodeHighlighter, HighlightResult } from "./highlighter.js";

interface LezerCache {
  tree: Tree;
  code: string;
  colorLookup: Map<string, string>;
}

/**
 * A {@link CodeHighlighter} backed by a Lezer parser and a CodeMirror
 * {@link HighlightStyle}. Ported from motion-canvas's LezerHighlighter.
 */
export class LezerHighlighter implements CodeHighlighter<LezerCache | null> {
  private static readonly classRegex = /\.(\S+).*color:([^;]+)/;
  private readonly classLookup = new Map<string, string>();

  constructor(
    private readonly parser: Parser,
    private readonly style: HighlightStyle = DefaultHighlightStyle,
  ) {
    for (const rule of this.style.module?.getRules().split("\n") ?? []) {
      const match = rule.match(LezerHighlighter.classRegex);
      if (!match) {
        continue;
      }
      const className = match[1] as string;
      const color = (match[2] as string).trim();
      this.classLookup.set(className, color);
    }
  }

  initialize(): boolean {
    return true;
  }

  prepare(code: string): LezerCache | null {
    const colorLookup = new Map<string, string>();
    const tree = this.parser.parse(code);
    highlightTree(tree, this.style, (from, to, classes) => {
      const color = this.classLookup.get(classes);
      if (!color) {
        return;
      }

      const cursor = tree.cursorAt(from, 1);
      do {
        const id = this.getNodeId(cursor.node);
        colorLookup.set(id, color);
      } while (cursor.next() && cursor.to <= to);
    });

    return { tree, code, colorLookup };
  }

  highlight(index: number, cache: LezerCache | null): HighlightResult {
    if (!cache) {
      return { color: null, skipAhead: 0 };
    }

    const node = cache.tree.resolveInner(index, 1);
    const id = this.getNodeId(node);
    const color = cache.colorLookup.get(id);
    if (color) {
      return { color, skipAhead: node.to - index };
    }

    let skipAhead = 0;
    if (!node.firstChild) {
      skipAhead = node.to - index;
    }

    return { color: null, skipAhead };
  }

  tokenize(code: string): string[] {
    const tree = this.parser.parse(code);
    const cursor = tree.cursor();
    const tokens: string[] = [];
    let current = 0;

    do {
      if (!cursor.node.firstChild) {
        if (cursor.from > current) {
          tokens.push(code.slice(current, cursor.from));
        }
        if (cursor.from < cursor.to) {
          tokens.push(code.slice(cursor.from, cursor.to));
        }
        current = cursor.to;
      }
    } while (cursor.next());

    if (current < code.length) {
      tokens.push(code.slice(current));
    }

    return tokens;
  }

  private getNodeId(node: SyntaxNode): string {
    return `${node.from}:${node.to}`;
  }
}
