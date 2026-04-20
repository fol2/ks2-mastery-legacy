// Enriched spelling word metadata. Ported from legacy preview.html lines 847-878.
// Depends on: window.KS2_WORDS (vendor/word-list.js)
//             window.KS2_ACCEPTED_ALTERNATIVES (vendor/word-list.js)
//             window.KS2_SENTENCE_BANK (vendor/sentence-bank-0N.js)
//
// Publishes:
//   window.KS2_WORD_META = { [slug]: enrichedWord } — slug -> full enriched record
//   window.KS2_WORDS_ENRICHED = enrichedWord[]       — ordered array
//
// Each enriched record has shape:
//   { year, family, word, slug, yearLabel, familyWords, sentence, sentences, accepted }

(function buildWordMeta() {
  var RAW_WORDS = (window.KS2_WORDS || []).slice();
  var ACCEPTED_ALTERNATIVES = window.KS2_ACCEPTED_ALTERNATIVES || {};
  var SENTENCE_BANK = window.KS2_SENTENCE_BANK || {};

  // Build family -> [word, word, ...] map so each enriched record can list its siblings.
  var familyMap = Object.create(null);
  for (var i = 0; i < RAW_WORDS.length; i++) {
    var item = RAW_WORDS[i];
    var familyKey = item.year + "||" + item.family;
    if (!familyMap[familyKey]) familyMap[familyKey] = [];
    familyMap[familyKey].push(item.word);
  }

  function trimmedStrings(arr) {
    var out = [];
    if (!Array.isArray(arr)) return out;
    for (var i = 0; i < arr.length; i++) {
      var trimmed = String(arr[i] || "").trim();
      if (trimmed) out.push(trimmed);
    }
    return out;
  }

  var enriched = RAW_WORDS.map(function (item) {
    var slug = String(item.word).toLowerCase();
    var familyKey = item.year + "||" + item.family;

    // Prefer sentence-bank variants; fall back to the inline `sentence` field.
    var fromBank = trimmedStrings(SENTENCE_BANK[slug]);
    var fromInlineArray = trimmedStrings(item.sentences);
    var fromInlineSingle = String(item.sentence || "").trim();
    var sentences = fromBank.length
      ? fromBank
      : fromInlineArray.length
        ? fromInlineArray
        : fromInlineSingle
          ? [fromInlineSingle]
          : [];

    var accepted = [slug];
    var extras = ACCEPTED_ALTERNATIVES[slug];
    if (Array.isArray(extras)) {
      for (var j = 0; j < extras.length; j++) accepted.push(extras[j]);
    }

    return {
      year: item.year,
      family: item.family,
      word: item.word,
      slug: slug,
      yearLabel: item.year === "3-4" ? "Years 3-4" : "Years 5-6",
      familyWords: familyMap[familyKey].slice(),
      sentence: sentences[0] || "",
      sentences: sentences,
      accepted: accepted,
    };
  });

  var bySlug = Object.create(null);
  for (var k = 0; k < enriched.length; k++) {
    bySlug[enriched[k].slug] = enriched[k];
  }

  window.KS2_WORD_META = bySlug;
  window.KS2_WORDS_ENRICHED = enriched;
})();
