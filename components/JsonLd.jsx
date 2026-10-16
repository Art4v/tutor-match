// ============================================================================
// <JsonLd data={...} />: schema.org structured data for crawlers and AI agents.
// ----------------------------------------------------------------------------
// THE ONE dangerouslySetInnerHTML IN THE REPO. Everywhere else, user content
// reaches the DOM only as React text (see lib/markdown.js and RichText.jsx).
// This exception exists because JSON-LD must be the raw text of a
// <script type="application/ld+json">, and React escapes ordinary text
// children (turning `&` into `&amp;`), which corrupts the JSON.
//
// What makes it safe: the payload is a plain object we build, serialised with
// JSON.stringify (so it is always valid JSON, never markup), and then every
// character that could end the <script> early or change how the HTML parser
// reads it is rewritten as a JSON unicode escape. A tutor bio containing
// `</script><script>alert(1)</script>` therefore stays inert string data.
// The escapes are decoded back by any JSON parser, so the data is unchanged.
//
// Do not pass it pre-serialised strings or HTML, and do not copy this pattern
// anywhere else: add a field to the object instead.
// ============================================================================

// Written with \u escapes (never the literal characters) because U+2028 and
// U+2029 are line terminators to a JS parser and would break the regex itself.
const UNSAFE = /[<>&\u2028\u2029]/g;
const ESCAPES = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

export function serializeJsonLd(data) {
  return JSON.stringify(data).replace(UNSAFE, (c) => ESCAPES[c]);
}

export function JsonLd({ data }) {
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
