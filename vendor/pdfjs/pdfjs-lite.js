(function (global) {
  'use strict';

  const textDecoderUtf8 = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { fatal: false }) : null;

  function toUint8(data) {
    if (data instanceof Uint8Array) {
      return data;
    }
    if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) {
      return new Uint8Array(data);
    }
    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(data)) {
      return new Uint8Array(data.buffer);
    }
    throw new TypeError('Unsupported PDF data buffer type for lite extractor.');
  }

  function bytesToLatin1(bytes) {
    let result = '';
    const len = bytes.length;
    for (let i = 0; i < len; i += 1) {
      result += String.fromCharCode(bytes[i]);
    }
    return result;
  }

  function latin1ToBytes(text) {
    const arr = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i += 1) {
      arr[i] = text.charCodeAt(i) & 0xff;
    }
    return arr;
  }

  function decodePossibleUtf8(bytes) {
    if (textDecoderUtf8) {
      try {
        return textDecoderUtf8.decode(bytes);
      } catch (err) {
        // fallback to latin1 below
      }
    }
    return bytesToLatin1(bytes);
  }

  async function inflate(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Brak wbudowanego DecompressionStream do dekompresji strumienia Flate.');
    }
    const stream = new DecompressionStream('deflate');
    const writer = stream.writable.getWriter();
    await writer.write(bytes);
    await writer.close();

    const reader = stream.readable.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.length;
      }
    }
    reader.releaseLock();

    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }

  function asciiHexDecode(bytes) {
    const raw = bytesToLatin1(bytes).replace(/[^0-9A-Fa-f]/g, '');
    const cleaned = raw.length % 2 === 0 ? raw : raw + '0';
    const out = new Uint8Array(cleaned.length / 2);
    for (let i = 0; i < cleaned.length; i += 2) {
      out[i / 2] = parseInt(cleaned.substr(i, 2), 16);
    }
    return out;
  }

  function ascii85Decode(bytes) {
    const raw = bytesToLatin1(bytes).replace(/\s+/g, '').replace(/~>/g, '');
    const output = [];
    let tuple = [];
    for (let i = 0; i < raw.length; i += 1) {
      const ch = raw[i];
      if (ch === 'z' && tuple.length === 0) {
        output.push(0, 0, 0, 0);
        continue;
      }
      tuple.push(ch.charCodeAt(0) - 33);
      if (tuple.length === 5) {
        let value = 0;
        for (let j = 0; j < 5; j += 1) {
          value = value * 85 + tuple[j];
        }
        output.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
        tuple = [];
      }
    }
    if (tuple.length) {
      const missing = 5 - tuple.length;
      for (let i = 0; i < missing; i += 1) {
        tuple.push(84); // 'u' => padding
      }
      let value = 0;
      for (let j = 0; j < 5; j += 1) {
        value = value * 85 + tuple[j];
      }
      for (let i = 0; i < 4 - missing; i += 1) {
        output.push((value >>> (24 - 8 * i)) & 0xff);
      }
    }
    return new Uint8Array(output);
  }

  function parseFilters(dictSection) {
    if (!dictSection) return [];
    const match = dictSection.match(/\/Filter\s*(\[[^\]]+\]|\/[A-Za-z0-9]+)/);
    if (!match) return [];
    const token = match[1].trim();
    const filters = [];
    if (token.startsWith('[')) {
      const inner = token.slice(1, -1);
      inner.split(/\s+/).forEach((part) => {
        if (part.startsWith('/')) {
          filters.push(part.slice(1));
        }
      });
    } else if (token.startsWith('/')) {
      filters.push(token.slice(1));
    }
    return filters;
  }

  function trimStreamData(data) {
    let text = data;
    if (text.startsWith('\r\n')) {
      text = text.slice(2);
    } else if (text.startsWith('\n') || text.startsWith('\r')) {
      text = text.slice(1);
    }
    if (text.endsWith('\r\n')) {
      text = text.slice(0, -2);
    } else if (text.endsWith('\n') || text.endsWith('\r')) {
      text = text.slice(0, -1);
    }
    return text;
  }

  function decodePdfLiteral(str) {
    let result = '';
    for (let i = 0; i < str.length; i += 1) {
      const ch = str[i];
      if (ch === '\\') {
        i += 1;
        const next = str[i];
        switch (next) {
          case 'n': result += '\n'; break;
          case 'r': result += '\r'; break;
          case 't': result += '\t'; break;
          case 'b': result += '\b'; break;
          case 'f': result += '\f'; break;
          case '(':
          case ')':
          case '\\':
            result += next;
            break;
          default: {
            if (next >= '0' && next <= '7') {
              let oct = next;
              for (let j = 0; j < 2; j += 1) {
                const peek = str[i + 1];
                if (peek >= '0' && peek <= '7') {
                  oct += peek;
                  i += 1;
                } else {
                  break;
                }
              }
              result += String.fromCharCode(parseInt(oct, 8));
            } else {
              result += next;
            }
          }
        }
      } else {
        result += ch;
      }
    }
    return result;
  }

  function decodePdfHex(str) {
    const cleaned = str.replace(/[^0-9A-Fa-f]/g, '');
    const padded = cleaned.length % 2 === 0 ? cleaned : `${cleaned}0`;
    let out = '';
    for (let i = 0; i < padded.length; i += 2) {
      out += String.fromCharCode(parseInt(padded.substr(i, 2), 16));
    }
    return out;
  }

  function extractTextFromContent(content) {
    const pieces = [];

    const simpleRegex = /\((?:\\.|[^()])*\)\s*T['j]/g;
    let match;
    while ((match = simpleRegex.exec(content)) !== null) {
      const literalMatch = match[0].match(/\((?:\\.|[^()])*\)/);
      if (!literalMatch) continue;
      const decoded = decodePdfLiteral(literalMatch[0].slice(1, -1));
      if (decoded) {
        pieces.push(decoded);
        pieces.push(' ');
      }
      if (/T'/.test(match[0])) {
        pieces.push('\n');
      }
    }

    const arrayRegex = /\[(.*?)\]\s*TJ/g;
    while ((match = arrayRegex.exec(content)) !== null) {
      const segment = match[1];
      const innerRegex = /\((?:\\.|[^()])*\)|<([0-9A-Fa-f\s]+)>/g;
      let inner;
      const chunkParts = [];
      while ((inner = innerRegex.exec(segment)) !== null) {
        if (inner[0][0] === '(') {
          chunkParts.push(decodePdfLiteral(inner[0].slice(1, -1)));
        } else if (inner[1]) {
          chunkParts.push(decodePdfHex(inner[1]));
        }
      }
      if (chunkParts.length) {
        pieces.push(chunkParts.join(' '));
        pieces.push('\n');
      }
    }

    const raw = pieces.join('').replace(/\s+\n/g, '\n');
    return raw
      .replace(/[\t ]{2,}/g, ' ')
      .replace(/ \n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  async function decodeStream(streamData, dictSection) {
    const filters = parseFilters(dictSection);
    let buffer = latin1ToBytes(trimStreamData(streamData));

    for (const filter of filters) {
      if (filter === 'FlateDecode' || filter === 'Fl') {
        buffer = await inflate(buffer);
      } else if (filter === 'ASCIIHexDecode') {
        buffer = asciiHexDecode(buffer);
      } else if (filter === 'ASCII85Decode') {
        buffer = ascii85Decode(buffer);
      } else {
        throw new Error(`Nieobsługiwany filtr PDF: ${filter}`);
      }
    }

    if (!filters.length) {
      return trimStreamData(bytesToLatin1(buffer));
    }
    return decodePossibleUtf8(buffer);
  }

  async function extractText(data) {
    const bytes = toUint8(data);
    const latin = bytesToLatin1(bytes);
    const objectRegex = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
    const pageTexts = [];
    let match;

    while ((match = objectRegex.exec(latin)) !== null) {
      const objectBody = match[3];
      const streamIndex = objectBody.indexOf('stream');
      if (streamIndex === -1) continue;
      const dictSection = objectBody.slice(0, streamIndex);
      let streamData = objectBody.slice(streamIndex + 6);
      const endStreamIndex = streamData.indexOf('endstream');
      if (endStreamIndex === -1) continue;
      streamData = streamData.slice(0, endStreamIndex);

      let decoded;
      try {
        decoded = await decodeStream(streamData, dictSection);
      } catch (err) {
        continue;
      }

      if (!decoded || !/BT[\s\S]*?ET/.test(decoded)) {
        continue;
      }

      const text = extractTextFromContent(decoded);
      if (text) {
        pageTexts.push(text);
      }
    }

    if (!pageTexts.length) {
      const directText = extractTextFromContent(latin);
      if (directText) {
        pageTexts.push(directText);
      }
    }

    const merged = pageTexts.filter(Boolean).join('\n\n');
    return merged.trim();
  }

  const liteRuntime = {
    name: 'pdfjs-lite-fallback',
    async extractText(buffer) {
      return extractText(buffer);
    }
  };

  Object.defineProperty(liteRuntime, 'version', {
    value: '0.1.0',
    enumerable: true
  });

  global.pdfjsLite = liteRuntime;
})(typeof window !== 'undefined' ? window : globalThis);
