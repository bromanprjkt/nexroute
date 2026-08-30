// Filter RTK (Router Tool Kit) yang di-porting dari 9Router
// Digunakan untuk mendeteksi dan mengompresi output alat terminal panjang (git diff, ls, dll.)

const DETECT_WINDOW = 1024;
const GIT_DIFF_HUNK_MAX_LINES = 100;
const SMART_TRUNCATE_MIN_LINES = 25;
const LS_MAX_LINES = 50;

const RE_GIT_DIFF = /^diff --git /m;
const RE_GIT_DIFF_HUNK = /^@@ /m;
const RE_LS_ROW = /^[-dlbcps][rwx-]{9}/m;
const RE_LS_TOTAL = /^total \d+$/m;

export function autoDetectFilter(text: string): ((t: string) => string) | null {
  const head = text.length > DETECT_WINDOW ? text.slice(0, DETECT_WINDOW) : text;

  if (RE_GIT_DIFF.test(head) || RE_GIT_DIFF_HUNK.test(head)) return gitDiff;
  
  if (RE_LS_TOTAL.test(head) || countMatches(head, RE_LS_ROW) >= 3) return lsFilter;

  // Fallback: big blob with no structure — smart truncate
  if (text.split('\n').length >= SMART_TRUNCATE_MIN_LINES) return smartTruncate;

  return null;
}

function countMatches(str: string, regex: RegExp): number {
  const matches = str.match(new RegExp(regex, 'g'));
  return matches ? matches.length : 0;
}

export function gitDiff(diff: string, maxLines = 500): string {
  const result: string[] = [];
  let currentFile = "";
  let added = 0;
  let removed = 0;
  let inHunk = false;
  let hunkShown = 0;
  let hunkSkipped = 0;
  let wasTruncated = false;

  const lines = diff.split("\n");

  outer: for (const line of lines) {
    if (line.startsWith("diff --git")) {
      if (hunkSkipped > 0) {
        result.push(`  ... (${hunkSkipped} lines truncated)`);
        wasTruncated = true;
        hunkSkipped = 0;
      }
      if (currentFile && (added > 0 || removed > 0)) {
        result.push(`  +${added} -${removed}`);
      }
      const parts = line.split(" b/");
      currentFile = parts.length > 1 ? parts.slice(1).join(" b/") : "unknown";
      result.push(`\n${currentFile}`);
      added = 0;
      removed = 0;
      inHunk = false;
      hunkShown = 0;
    } else if (line.startsWith("@@")) {
      if (hunkSkipped > 0) {
        result.push(`  ... (${hunkSkipped} lines truncated)`);
        wasTruncated = true;
        hunkSkipped = 0;
      }
      inHunk = true;
      hunkShown = 0;
      result.push(`  ${line}`);
    } else if (inHunk) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        added += 1;
        if (hunkShown < GIT_DIFF_HUNK_MAX_LINES) {
          result.push(`  ${line}`);
          hunkShown += 1;
        } else {
          hunkSkipped += 1;
        }
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        removed += 1;
        if (hunkShown < GIT_DIFF_HUNK_MAX_LINES) {
          result.push(`  ${line}`);
          hunkShown += 1;
        } else {
          hunkSkipped += 1;
        }
      } else if (hunkShown < GIT_DIFF_HUNK_MAX_LINES && !line.startsWith("\\")) {
        if (hunkShown > 0) {
          result.push(`  ${line}`);
          hunkShown += 1;
        }
      }
    }

    if (result.length >= maxLines) {
      result.push("\n... (more changes truncated)");
      wasTruncated = true;
      break outer;
    }
  }

  if (hunkSkipped > 0) {
    result.push(`  ... (${hunkSkipped} lines truncated)`);
    wasTruncated = true;
  }

  if (currentFile && (added > 0 || removed > 0)) {
    result.push(`  +${added} -${removed}`);
  }

  return result.join("\n");
}

export function lsFilter(text: string): string {
  const lines = text.split("\n");
  if (lines.length <= LS_MAX_LINES) return text;

  // Pertahankan header (total N) dan beberapa baris awal/akhir
  const head = lines.slice(0, Math.floor(LS_MAX_LINES / 2));
  const tail = lines.slice(lines.length - Math.floor(LS_MAX_LINES / 2));
  
  return [...head, `\n... (${lines.length - LS_MAX_LINES} baris disembunyikan RTK)`, ...tail].join('\n');
}

export function smartTruncate(text: string, maxLen = 4000): string {
  if (text.length <= maxLen) return text;
  
  const midPoint = Math.floor(maxLen / 2);
  const left = text.slice(0, midPoint);
  const right = text.slice(-midPoint);
  
  return `${left}\n\n... [RTK Smart Truncate: ${text.length - maxLen} byte dihapus dari tengah] ...\n\n${right}`;
}
