/**
 * Delimited text, back into a grid of fields.
 *
 * The inverse of what the clipboard writes, and it has to cope with more than
 * that: what arrives on a paste came from Excel, Sheets, a terminal or this
 * grid, and only the last of those is under our control. So the awkward cases
 * are the point — a quoted field holding the delimiter, a quoted field holding
 * a newline, a doubled quote standing for one, and the three line endings in
 * circulation.
 *
 * Written as a scanner rather than split-and-rejoin because a quoted newline
 * means the line boundaries are not knowable until the quotes have been
 * tracked: splitting on newlines first tears such a field in half, and no
 * amount of rejoining afterwards reliably puts it back.
 */
export const parseDelimited = (text: string, delimiter: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let index = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (index < text.length) {
    const character = text[index]!;

    if (quoted) {
      if (character === '"') {
        // A doubled quote is one literal quote; a lone one closes the field.
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      field += character;
      index += 1;
      continue;
    }

    if (character === '"' && field === '') {
      quoted = true;
      index += 1;
      continue;
    }

    if (character === delimiter) {
      endField();
      index += 1;
      continue;
    }

    if (character === '\r' || character === '\n') {
      endRow();
      // CRLF is one ending, not two.
      index += character === '\r' && text[index + 1] === '\n' ? 2 : 1;
      continue;
    }

    field += character;
    index += 1;
  }

  // Whatever is in hand when the text runs out is a final field, unless there
  // is nothing at all — a trailing newline ends the last row rather than
  // starting an empty one.
  if (field !== '' || row.length > 0) endRow();

  return rows;
};

/**
 * Which delimiter the text is using.
 *
 * The system clipboard carries tab-separated text from every spreadsheet worth
 * naming, so a tab anywhere settles it. Falling back to a comma means a paste
 * from a CSV file still lands in columns rather than as one long field.
 *
 * Only the first line is consulted, and only outside quotes: a comma inside a
 * quoted field is data, and letting it vote would turn one tab-separated row
 * into a dozen columns.
 */
export const detectDelimiter = (text: string): string => {
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (quoted) continue;
    if (character === '\t') return '\t';
    if (character === '\n' || character === '\r') break;
  }
  return ',';
};
