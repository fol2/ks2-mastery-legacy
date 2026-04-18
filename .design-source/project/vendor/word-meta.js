window.KS2_WORD_META = (function(){
  const Y56 = ["accommodate","accompany","according","achieve","aggressive","amateur","ancient","apparent","appreciate","attached","available","average","awkward","bargain","bruise","category","cemetery","committee","communicate","community","competition","conscience","conscious","controversy","convenience","correspond","criticise","curiosity","definite","desperate","determined","develop","dictionary","disastrous","embarrass","environment","equip","equipped","equipment","especially","exaggerate","excellent","existence","explanation","familiar","foreign","forty","frequently","government","guarantee","harass","hindrance","identity","immediate","immediately","individual","interfere","interrupt","language","leisure","lightning","marvellous","mischievous","muscle","necessary","neighbour","nuisance","occupy","occur","opportunity","parliament","persuade","physical","prejudice","privilege","profession","programme","pronunciation","queue","recognise","recommend","relevant","restaurant","rhyme","rhythm","sacrifice","secretary","shoulder","signature","sincere","sincerely","soldier","stomach","sufficient","suggest","symbol","system","temperature","thorough","twelfth","variety","vegetable","vehicle","yacht"];
  const set = new Set(Y56);
  const meta = {};
  for (const w of Object.keys(window.KS2_SENTENCE_BANK || {})) {
    meta[w] = { year: set.has(w) ? '5-6' : '3-4' };
  }
  return meta;
})();
