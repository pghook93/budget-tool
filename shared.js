/* ============================================================================
 * PolicyPatch Budget Tool — shared text-normalisation utilities.
 *
 * Loaded by both index.html (viewer) and admin.html (admin page) via a plain
 * <script src="shared.js"> tag. Keeps category casing, ask cleanup, and
 * preserved-term handling identical on both pages — editing one file now
 * covers both, so the two pages can never drift.
 *
 * Safe to load multiple times: functions attach to window if not already
 * defined. No ES modules, no build step — just a classic script.
 * ========================================================================= */
(function (global) {
  'use strict';

  // --------------------------------------------------------------------------
  // Proper nouns, acronyms and agency names that must always render in their
  // canonical case. Matched case-insensitively but written back as shown here.
  // Kept short and focused on Australian social-policy vocabulary.
  // --------------------------------------------------------------------------
  var PRESERVE = [
    'NDIS', 'ACOSS', 'VCOSS', 'QCOSS', 'NCOSS', 'SACOSS', 'WACOSS', 'TasCOSS',
    'COAG', 'ATO', 'ABS', 'DSS', 'DVA', 'DSP', 'CRA', 'FHSS', 'GST', 'HECS',
    'JobSeeker', 'JobKeeper', 'Medicare', 'Centrelink', 'PBS', 'MBS',
    'Australia', 'Australian', 'Australians',
    'Commonwealth', 'Federal', 'State', 'Territory',
    'Victoria', 'Victorian', 'NSW', 'Queensland', 'Tasmania', 'Tasmanian',
    'South Australia', 'South Australian',
    'Western Australia', 'Western Australian',
    'Northern Territory', 'ACT',
    'Aboriginal', 'Torres Strait Islander', 'First Nations', 'Indigenous',
    'LGBTQIA+', 'LGBTQIA', 'LGBTIQA+', 'LGBTIQA',
    'LGBTIQ+', 'LGBTIQ', 'LGBTQI+', 'LGBTQI', 'LGBT',
    'COVID', 'COVID-19'
  ];

  // Short function words that stay lowercase in AP-style title case unless
  // they are the first or last word of the heading.
  var SMALL = new Set([
    'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of',
    'on', 'or', 'the', 'to', 'vs', 'via'
  ]);

  // --------------------------------------------------------------------------
  // AP-style title case. Every significant word capitalised, small words stay
  // lowercase (unless first/last), hyphenated words capitalise both halves,
  // PRESERVE terms win over everything else.
  // --------------------------------------------------------------------------
  function toTitleCase(s) {
    if (!s) return s;
    var tokens = String(s).split(/(\s+)/); // keep whitespace separators
    var wordIdx = [];
    tokens.forEach(function (t, i) {
      if (!/^\s+$/.test(t) && t.length) wordIdx.push(i);
    });
    var firstIdx = wordIdx[0];
    var lastIdx = wordIdx[wordIdx.length - 1];

    var titled = tokens.map(function (tok, i) {
      if (/^\s+$/.test(tok) || !tok) return tok;
      var lower = tok.toLowerCase();
      // Strip leading/trailing punctuation for the SMALL-word test, but keep
      // it on the final output so we don't eat quotes, brackets, etc.
      var core = lower.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      var leading = lower.slice(0, lower.indexOf(core));
      var trailing = core ? lower.slice(lower.indexOf(core) + core.length) : '';
      var isSmall = SMALL.has(core);
      var isEdge = i === firstIdx || i === lastIdx;
      if (isSmall && !isEdge) return leading + core + trailing;
      var capped = core.split('-').map(function (part) {
        if (!part) return part;
        return part.charAt(0).toUpperCase() + part.slice(1);
      }).join('-');
      return leading + capped + trailing;
    }).join('');

    // Reinstate preserved terms last so canonical forms (NDIS, JobSeeker,
    // Aboriginal, Torres Strait Islander, etc.) always win.
    var out = titled;
    for (var k = 0; k < PRESERVE.length; k++) {
      var term = PRESERVE[k];
      var re = new RegExp(
        '\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b',
        'gi'
      );
      out = out.replace(re, term);
    }
    return out;
  }

  // --------------------------------------------------------------------------
  // Clean up an overarching category. Strip leading "Recommendations",
  // "Our recommendations", "Key asks", "Summary of recommendations",
  // "Recommendations at a glance", etc. — these are TOC-container artefacts,
  // not real categories. Then normalise casing via toTitleCase.
  // --------------------------------------------------------------------------
  function cleanOverarching(s) {
    if (!s) return 'Uncategorised';
    var out = String(s).trim();
    // Strip leading list numbering like "2. Raise International Aid...",
    // "3) Fund X", "4 \u2014 Establish Y". These come from PDF layout ordinals
    // that often don't match the true ask sequence, so they cause confusion
    // (e.g. ask labelled "2." actually being the 1st ask in its section).
    // Also strip "Recommendation 3:" / "Rec 3." style prefixes.
    out = out.replace(
      /^(?:recommendation|rec\.?)\s*\d+\s*[:.\-\u2013\u2014)]?\s+/i,
      ''
    );
    // Strip "Section 1:", "Part 2 -", "Chapter 3.", "Pillar 4:" style prefixes.
    out = out.replace(
      /^(?:section|part|chapter|pillar|theme|priority|area)\s*\d+\s*[:.\-\u2013\u2014)]?\s+/i,
      ''
    );
    // Strip leading ordinals: "2.", "3)", "4 -" AND bare "4 Expansion..."
    // (digit with only whitespace separator, no punctuation).
    out = out.replace(/^\d+\s*[.)\-\u2013\u2014:]\s*/, '');
    out = out.replace(/^\d+\s+(?=[A-Za-z])/, '');
    out = out.replace(
      /^(?:our\s+|summary\s+of\s+|major\s+|key\s+)?recommendation[s:]*\s+(?:at\s+a\s+glance\s+)?/i,
      ''
    );
    out = out.replace(/^key\s+asks?\s+/i, '');
    out = out.trim();
    if (!out) return 'Uncategorised';
    return toTitleCase(out);
  }

  // --------------------------------------------------------------------------
  // Clean up an ask. Strip parenthetical cross-references, trailing page
  // fragments, and lone trailing footnote numbers. Preserves real numerics
  // like "$1.2 billion", "by 2030", "$80", "15%".
  // --------------------------------------------------------------------------
  function cleanAskText(s) {
    if (!s) return '';
    var out = String(s);
    // 1. Parenthetical cross-references: "(See also: ... page 9 4.)",
    //    "(see p. 12)", "(cf. recommendation 3)", etc.
    out = out.replace(
      /\s*\((?:see also|see|cf\.?|refer to|also see)[^()]*\)\s*/gi,
      ' '
    );
    // 2. Trailing " page N [M]" or " p. N" fragments at end of sentence —
    //    only when they're the last tokens before a terminator.
    out = out.replace(/\s+(?:page|p\.?)\s+\d+(?:\s+\d+)?\s*\.?\s*$/gi, '');
    // 3. Trailing lone superscript-style footnote numbers (e.g.
    //    "… energy transition. 19" or "… energy transition 19"). Only 1-3
    //    digits, only at end, only after a word character + optional
    //    punctuation — so we never strip "$1.2 billion" or "by 2030".
    out = out.replace(/([\w.\)\]\?!\u201D\u2019"'])\s+\d{1,3}\s*$/g, '$1');
    // 4. Collapse double spaces and stray orphan punctuation.
    out = out.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
    // 5. Uppercase parenthesised acronyms: "(Cdp)" → "(CDP)", "(Ndis)" →
    //    "(NDIS)". Only triggers on 2-6 letter all-letter tokens inside
    //    parentheses, so "(see…)" or "(e.g.)" stay untouched.
    out = out.replace(/\(([A-Za-z]{2,6})\)/g, function (_m, acr) {
      return '(' + acr.toUpperCase() + ')';
    });
    // 6. Ensure the ask starts with a capital letter. PDFs sometimes emit
    //    asks that begin lowercase (e.g. bullet continuations).
    if (out.length) {
      out = out.charAt(0).toUpperCase() + out.slice(1);
    }
    return out;
  }

  // Export to the page's global scope. Use direct assignment so it works in
  // plain browser script tags (no module loader required).
  global.PolicyPatchShared = {
    PRESERVE: PRESERVE,
    SMALL: SMALL,
    toTitleCase: toTitleCase,
    cleanOverarching: cleanOverarching,
    cleanAskText: cleanAskText
  };
  // Also expose as top-level names for convenience — both pages already call
  // toTitleCase(), cleanOverarching(), cleanAskText() unqualified.
  global.toTitleCase = toTitleCase;
  global.cleanOverarching = cleanOverarching;
  global.cleanAskText = cleanAskText;
})(typeof window !== 'undefined' ? window : globalThis);
