/**
 * Safe numeric expression evaluator for Calculated criteria.
 *
 * SECURITY: Never use `eval` or `new Function` on user input. This evaluator
 * parses a restricted grammar:
 *   - numeric literals (1, 3.14, 1e3)
 *   - operators + - * / %
 *   - parentheses ( )
 *   - variable identifiers (alphanumeric + underscore, must start with letter/_)
 * Anything else (calls, member access, strings) throws.
 *
 * Returns null when formula is empty, when an identifier is unbound, or when
 * the expression is malformed — callers render "—" in those cases.
 */

export type FormulaVars = Record<string, number>;

export function evaluateFormula(formula: string, vars: FormulaVars): number | null {
  const trimmed = (formula ?? '').trim();
  if (!trimmed) return null;
  try {
    const tokens = tokenize(trimmed);
    const parser = new Parser(tokens, vars);
    const value = parser.parseExpression();
    if (!parser.atEnd()) throw new Error('Unexpected trailing input');
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

// ── Tokenizer ──────────────────────────────────────────────────────
type Token =
  | { kind: 'num'; value: number }
  | { kind: 'id'; value: string }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' | '%' }
  | { kind: 'lparen' }
  | { kind: 'rparen' };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c === '(') { out.push({ kind: 'lparen' }); i++; continue; }
    if (c === ')') { out.push({ kind: 'rparen' }); i++; continue; }
    if (c === '+' || c === '-' || c === '*' || c === '/' || c === '%') {
      out.push({ kind: 'op', value: c });
      i++;
      continue;
    }
    // Number
    if ((c >= '0' && c <= '9') || c === '.') {
      let j = i;
      while (j < src.length && /[0-9.eE+\-]/.test(src[j])) {
        // accept e/E only inside number; signs only right after e/E
        if ((src[j] === '+' || src[j] === '-') && j > i && src[j - 1] !== 'e' && src[j - 1] !== 'E') break;
        j++;
      }
      const slice = src.slice(i, j);
      const n = Number(slice);
      if (!Number.isFinite(n)) throw new Error(`Invalid number: ${slice}`);
      out.push({ kind: 'num', value: n });
      i = j;
      continue;
    }
    // Identifier (variable name)
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_') {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ kind: 'id', value: src.slice(i, j) });
      i = j;
      continue;
    }
    throw new Error(`Unexpected character: ${c}`);
  }
  return out;
}

// ── Recursive-descent parser ───────────────────────────────────────
// Grammar:
//   expression : term  (('+' | '-') term)*
//   term       : factor (('*' | '/' | '%') factor)*
//   factor     : '-' factor | primary
//   primary    : NUMBER | IDENT | '(' expression ')'

class Parser {
  private pos = 0;
  constructor(private tokens: Token[], private vars: FormulaVars) {}

  atEnd(): boolean { return this.pos >= this.tokens.length; }
  private peek(): Token | undefined { return this.tokens[this.pos]; }
  private consume(): Token { return this.tokens[this.pos++]; }

  parseExpression(): number {
    let left = this.parseTerm();
    while (!this.atEnd()) {
      const t = this.peek();
      if (t?.kind !== 'op' || (t.value !== '+' && t.value !== '-')) break;
      this.consume();
      const right = this.parseTerm();
      left = t.value === '+' ? left + right : left - right;
    }
    return left;
  }

  private parseTerm(): number {
    let left = this.parseFactor();
    while (!this.atEnd()) {
      const t = this.peek();
      if (t?.kind !== 'op' || (t.value !== '*' && t.value !== '/' && t.value !== '%')) break;
      this.consume();
      const right = this.parseFactor();
      if (t.value === '*') left = left * right;
      else if (t.value === '/') left = right === 0 ? NaN : left / right;
      else left = right === 0 ? NaN : left % right;
    }
    return left;
  }

  private parseFactor(): number {
    const t = this.peek();
    if (t?.kind === 'op' && t.value === '-') {
      this.consume();
      return -this.parseFactor();
    }
    if (t?.kind === 'op' && t.value === '+') {
      this.consume();
      return this.parseFactor();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const t = this.consume();
    if (!t) throw new Error('Unexpected end of input');
    if (t.kind === 'num') return t.value;
    if (t.kind === 'id') {
      if (!(t.value in this.vars)) throw new Error(`Unbound variable: ${t.value}`);
      return this.vars[t.value];
    }
    if (t.kind === 'lparen') {
      const v = this.parseExpression();
      const close = this.consume();
      if (close?.kind !== 'rparen') throw new Error('Expected )');
      return v;
    }
    throw new Error('Unexpected token');
  }
}
