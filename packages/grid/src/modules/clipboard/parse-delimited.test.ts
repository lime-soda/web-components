import { describe, expect, it } from 'vite-plus/test';
import { detectDelimiter, parseDelimited } from './parse-delimited.js';

/**
 * What arrives on a paste, which is not what we wrote.
 *
 * The text came from Excel, Sheets, a terminal or this grid, and only the last
 * is under our control — so the awkward cases are the whole job rather than
 * corners of it. A price copied from a spreadsheet carries thousands
 * separators, which means quoted fields containing the delimiter are the
 * ordinary case for financial data rather than a rarity.
 */

const tsv = (text: string) => parseDelimited(text, '\t');
const csv = (text: string) => parseDelimited(text, ',');

describe('parsing delimited text', () => {
  it('reads a block into rows and fields', () => {
    expect(tsv('a\tb\nc\td')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('reads a single value', () => {
    expect(tsv('101.25')).toEqual([['101.25']]);
  });

  it('reads a single column', () => {
    expect(tsv('100\n101\n102')).toEqual([['100'], ['101'], ['102']]);
  });

  it('keeps empty fields, which are positions rather than absences', () => {
    // Dropping them would shift every field after it into the wrong column.
    expect(tsv('a\t\tc')).toEqual([['a', '', 'c']]);
  });

  describe('quoting', () => {
    it('keeps a delimiter inside quotes', () => {
      // The ordinary case for financial data: 1,500,000 through a
      // comma-separated paste is three columns unless the quotes are honoured.
      expect(csv('"1,500,000",UKT')).toEqual([['1,500,000', 'UKT']]);
    });

    it('keeps a newline inside quotes', () => {
      // Why this is a scanner and not a split: the line boundaries are not
      // knowable until the quotes have been tracked.
      expect(csv('"line one\nline two",b')).toEqual([['line one\nline two', 'b']]);
    });

    it('reads a doubled quote as one', () => {
      expect(csv('"UKT 4% ""on the run""",b')).toEqual([['UKT 4% "on the run"', 'b']]);
    });

    it('leaves a quote mid-field alone', () => {
      // Only a quote opening a field starts a quoted field. 5" is a length.
      expect(tsv('5" pipe')).toEqual([['5" pipe']]);
    });
  });

  describe('line endings', () => {
    it('reads CRLF as one ending', () => {
      expect(tsv('a\r\nb')).toEqual([['a'], ['b']]);
    });

    it('reads a lone CR as an ending', () => {
      expect(tsv('a\rb')).toEqual([['a'], ['b']]);
    });

    it('ignores a trailing newline rather than inventing a row', () => {
      // Excel puts one on the end of a copied block, and an empty final row
      // would blank the cells beneath what was pasted.
      expect(tsv('a\tb\n')).toEqual([['a', 'b']]);
    });

    it('has nothing to say about empty text', () => {
      expect(tsv('')).toEqual([]);
    });
  });
});

describe('detecting the delimiter', () => {
  it('picks tab when there is one, which every spreadsheet writes', () => {
    expect(detectDelimiter('a\tb\nc\td')).toBe('\t');
  });

  it('falls back to comma, so a paste from a CSV still lands in columns', () => {
    expect(detectDelimiter('a,b\nc,d')).toBe(',');
  });

  it('ignores a comma inside quotes when there are tabs', () => {
    expect(detectDelimiter('"1,500,000"\tUKT')).toBe('\t');
  });

  it('reads only the first line', () => {
    // A tab appearing later does not retroactively change how line one was
    // meant to be read.
    expect(detectDelimiter('a,b\nc\td')).toBe(',');
  });

  it('treats a single value as comma-separated, which changes nothing', () => {
    expect(detectDelimiter('101.25')).toBe(',');
  });
});
