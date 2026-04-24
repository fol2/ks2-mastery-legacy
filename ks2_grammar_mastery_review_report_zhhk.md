# KS2 Grammar Mastery legacy HTML engine review（廣東話報告）

## 0. 檔案確認

已經喺環境入面搵到並審查：`/mnt/data/ks2_grammar_mastery_refactor.html`。

我亦已輸出修正版：`ks2_grammar_mastery_refactor_reviewed.html`。

今次審查集中喺 engine、學習方法、題庫、marking、adaptive scheduling、state、AI 邊界、測試模式同之後合併入 `fol2/ks2-mastery` 嘅工程路線；UI/UX 只會喺影響 engine 或可維護性時先提。

## 1. 一句總結

呢份 legacy HTML 已經唔係普通 prototype。以單檔 HTML 嚟講，Grammar engine 已經相當完整：有 18 個 grammar concept、51 個 deterministic templates、misconception tagging、spaced retry queue、learn / smart / trouble / surgery / builder / worked / faded / KS2-style test mode、question-type analytics、punctuation progression、AI-safe enrichment lane，同 local profile persistence。

但如果要合併入 `ks2-mastery`，唔應該直接搬 HTML。正確做法係：抽出 deterministic grammar service，同平台 subject module、repository、Worker command boundary、event runtime、analytics snapshot 對接。尤其 PR 49 正做 full-lockdown spelling runtime，Grammar 將來應該跟同一個方向：production scored practice 唔好再由 browser-local engine 直接掌控。

## 2. 今次我已經實際修咗嘅 engine 問題

### 2.1 Critical：KS2-style test mode 喺某啲 concept focus 會卡死

原本 `buildTestQuestionPacks(size, focusSkillId)` 會嘗試維持 mini-set 入面有 minimum constructed-response、punctuation、selected-response balance。但當 focus concept 本身題型太窄，例如 `sentence_functions` 或某啲只有 selected-response 嘅 concept，engine 會入到 while loop，但候選 template 其實已經唔足夠，結果可以無限等，表面就似個 app freeze。

我嘅測試重現到：`buildTestQuestionPacks(8, "sentence_functions")` 會 timeout。

已修：

- `buildTestQuestionPacks()` 加入 fail-safe guard。
- focus concept 候選不足時會先放寬到 mixed SATs-friendly pool，而唔會死 loop。
- 保留 selected / constructed / punctuation balance 嘗試，但唔再為咗 balance 犧牲可執行性。
- 回傳永遠 slice 到目標 size，避免 overfill。

### 2.2 High：template repeat cap 之前係「soft cap」，會靜默失效

原本 `testPackCandidates()` 入面，如果所有候選都到咗 `maxRepeat`，佢會 fallback 返未限制嘅 candidates。即係 cap 寫咗，但當候選細時會 silently ignore，導致同一 template 喺 test set 入面重複好多次。

已修：

- `filters.maxRepeat` 變成真正 filter。
- 如果 focus pool 唔夠，就由 `buildTestQuestionPacks()` 嘅 fallback 去 broadening，而唔係由 `testPackCandidates()` 偷偷放返重複 template。
- 修後測試 38 個 mini-set scenario，max repeat 保持喺 2 以內。

### 2.3 Medium：undefined misconception id

`proc2_tense_aspect_choice` 使用咗 `tense_aspect_confusion`，但 `MISCONCEPTIONS` 同 `MINIMAL_HINTS` 入面真正存在嘅 key 係 `tense_confusion`。

影響：

- learner feedback 可能顯示 raw key，唔係 user-friendly wording。
- analytics misconception aggregation 會分裂成無定義類別。

已修：

- 將 `"tense_aspect_confusion"` 改為 `"tense_confusion"`。

## 3. 我跑過嘅驗證

### 3.1 JavaScript syntax

`node --check /mnt/data/ks2_grammar_mastery_refactor.js`

結果：通過，無 syntax error。

### 3.2 Template generation smoke test

測試範圍：51 個 template × 20 個 seed，即 1020 次 generator + evaluate smoke。

結果：

- 51 templates 全部可 generate。
- 18 skills 全部存在。
- 無 duplicate template id。
- empty response evaluate 都無 runtime exception。

### 3.3 Mini-set generation regression test

測試範圍：mixed + 18 個 focus skills，各跑 8-question 同 12-question set，即 38 個 scenario。

結果：

- 無 error。
- 所有 set 都成功生成正確長度。
- 修後 `maxRepeat` 最大值為 2。
- 原本會卡死嘅 `sentence_functions` focus 已修。

### 3.4 Mock DOM initialise test

用 minimal mocked DOM 跑完整 script 初始化。

結果：`initialise ok`，即 startup path 無 immediate runtime exception。

### 3.5 Hidden / bidirectional Unicode scan

結果：

- bidirectional control characters：0
- replacement character：0

## 4. Engine 架構評估

### 4.1 靜態內容與 deterministic generator

目前 engine 最強嘅地方係：scored practice 主要由 built-in deterministic generators 控制，而唔係 AI 即場作題。呢點非常重要。Grammar 題目一旦要計分，必須有可預測答案、可重播 seed、可解釋 marking。

目前設計有：

- `SKILLS`：18 個 grammar / punctuation concept。
- `TEMPLATES`：51 個題型 template。
- `EXTRA_LEXICON`：procedural generation 字庫。
- `makeBaseQuestion()`：統一 question shape。
- `evaluate()` closure：每題本地 marking。
- `itemId = templateId:seed`：可追蹤 specific generated item。

呢個方向係啱嘅。之後合併入 repo 時，最好保留 `templateId + seed + contentVersion` 做 durable replay key。

### 4.2 Coverage 完整度

目前覆蓋嘅 concept 已經相當貼近 upper-KS2 GPS：

- sentence functions
- word classes
- expanded noun phrases
- adverbials / fronted adverbials
- subordinate clauses
- relative clauses
- tense / aspect
- Standard English
- pronouns / cohesion
- formal / informal register
- active / passive voice
- subject / object
- modal verbs
- parenthesis / commas
- direct speech punctuation
- possessive apostrophes
- colons / semi-colons / dashes
- hyphens for ambiguity

最大缺口：

- Spelling Paper 2 無覆蓋。呢份係 Grammar Mastery，唔係完整 GPS Mastery。
- Vocabulary domain 只係間接覆蓋 formal vocabulary，未有完整 KS2 vocabulary strand。
- 寫作 transfer 未夠：有 sentence surgery / builder，但未去到 paragraph-level application。
- Explanation items 偏少，暫時只有 2 個 explain templates。
- Some concept pools 只有 2–3 templates，長期 adaptive practice 會較快重複。

### 4.3 Adaptive scheduling

目前 adaptive engine 有幾個好點：

- skill / template / questionType / item 四層 tracking。
- `strength`, `intervalDays`, `dueAt`, `correctStreak` 類 spaced review state。
- wrong / supported answer 會放入 retry queue。
- Smart mixed review 會考慮 due、weak、recent wrong、question type weakness、repeat penalty。
- Trouble mode 會偏向 weakest concepts。

修正後，test pack generation 更安全，唔會因為 focus concept candidate pool 太窄而 freeze。

建議下一步：

- 將 scheduling 抽成 pure service function：`selectNextQuestion(state, options, rng)`。
- 隨機要可 seed，方便 test replay。
- `Math.random()` 只應喺 session start 建 seed；service 內盡量用 deterministic RNG。

### 4.4 Feedback / misconception methodology

好處：

- 唔係只計 right/wrong，而係用 misconception tag。
- Minimal hint 係 post-attempt，而唔係 first attempt 前泄漏答案。
- Worked / faded support 會降低 mastery gain，唔會同 independent correct 一樣加分。
- Contrast cards 對 grammar 特別有價值，因為 grammar 好多錯誤係 discrimination failure，而唔係單純唔識定義。

風險：

- constructed-response marking 仍然係 deterministic string match。呢個安全，但偏硬。
- 一啲 grammar rewrite 會有多個合法答案；現時 accepted list 需要持續擴張。
- 如果將來畀 AI mark free text，會破壞可追蹤性；建議唔好。AI 可以做 explanation / suggestion，但 scored marking 應該 keep deterministic 或 teacher-reviewed。

### 4.5 AI boundary

而家做法合理：AI 係 enrichment lane。

已有 safeguards：

- Scored practice 用 built-in verified generators。
- AI revision set 只可以回傳 cards + safe drill generator IDs。
- Drill loading 由 whitelist deterministic generator 控制。
- API key local single-file 模式有 warning。

Production 建議：

- 唔好喺 browser 儲 API key。
- 用 Worker proxy。
- AI output 一律 non-scored。
- AI 提供嘅 drill recipe 只可以選 server-known template id，唔可以提交題目正文做計分題。

## 5. Methodology / effectiveness 評估

### 5.1 有效嘅地方

呢個 app 已經避開咗好多「教育 app 只係 quiz」嘅問題。佢有 mixed retrieval、spaced return、progressive support、worked example、faded guidance、misconception tagging、contrastive examples。對 grammar 嚟講，contrastive examples 特別重要，因為學生常見錯誤係：

- direct question vs indirect question
- determiner vs pronoun
- relative clause vs time clause
- active vs passive
- singular vs plural possession
- colon vs semi-colon vs dash

呢啲唔係狂做同一類題就會自然解決；需要 deliberate discrimination。

### 5.2 仍然要小心嘅地方

GPS-style grammar mastery 唔等於真寫作能力。KS2 GPS Paper 1 可以考 grammar / punctuation / vocabulary，但 writing composition 仍然要靠 teacher assessment 或 writing tasks 去看 transfer。呢份 HTML 已經有 sentence transformation，但未有 authentic paragraph editing / writing transfer loop。

所以我建議將 engine 定位為：

> Grammar concept mastery + GPS-style practice engine，不係完整 English writing engine。

## 6. Bugs / glitches / polishing backlog（engine only）

已修：

1. Test mode focus mini-set 可 freeze。
2. Test mode maxRepeat soft cap 失效。
3. Undefined misconception id `tense_aspect_confusion`。

仍建議下一輪做：

1. **Content-versioning**：每條 generated item 應該記 `contentVersion`，否則將來 template 改文案後舊 seed replay 會變。
2. **Accepted answer registry**：將 constructed-response accepted variants 獨立出嚟，唔好散喺 closure。
3. **Deterministic session RNG**：session seed 要入 state，唔好所有 selection 都靠 live `Math.random()`。
4. **Test mode claim calibration**：叫 `KS2-style test mode` 可以；唔好叫 full GPS mock，因為無 spelling paper，亦唔係 50 marks / 45 minutes。
5. **Paragraph transfer mode**：加一個 non-scored 或 teacher-reviewed paragraph surgery mode，專門測 grammar transfer。
6. **Analytics confidence**：strength score 應該同 attempts/sample size 一齊展示。新 skill 25% strength 唔代表真弱，只係未有證據。
7. **State migration**：`APP_VERSION = 1` 但 migration 只係 normalise；將來入 repo 前要有 versioned migrations。
8. **Subject split decision**：repo 有 grammar 同 punctuation placeholder；現 HTML 係 combined grammar/punctuation。第一 PR 可以先放 grammar subject 包 punctuation subdomain，但之後要決定 punctuation 係咪獨立 subject。
9. **Golden-path tests**：需要把今次 smoke tests 變成 repo tests，而唔係 ad hoc script。
10. **No client-owned production scoring**：PR49 full-lockdown 後，production scoring 應放 Worker/service boundary。

## 7. 合併入 `fol2/ks2-mastery` 嘅 implementation guide

### 7.1 唔好直接搬 HTML

呢份 HTML 應該視為 reference implementation。合併時要拆成：

```txt
src/subjects/grammar/
  module.js
  grammar-service.js
  grammar-content.js
  grammar-analytics.js
  GrammarPractice.jsx
  __tests__/
```

HTML 內嘅 `SKILLS`, `TEMPLATES`, `MISCONCEPTIONS`, `MINIMAL_HINTS`, `EXTRA_LEXICON` 應移到 content/service layer。

### 7.2 Subject module contract

Grammar module 應該 expose：

```js
export const grammarModule = {
  id: 'grammar',
  name: 'Grammar',
  blurb: 'Word classes, clauses, tenses and sentence shape.',
  initState,
  getDashboardStats,
  PracticeComponent,
  handleAction,
};
```

唔好用舊式 `renderPractice()` string renderer。Repo 方向係 React-owned browser shell。

### 7.3 Service contract

Grammar service 建議照 subject-expansion thin-slice contract：

```js
initState(previousState, learnerId)
getPrefs(learnerId)
savePrefs(learnerId, patch)
getStats(learnerId)
getAnalyticsSnapshot(learnerId)
startSession(learnerId, options)
submitAnswer(learnerId, uiState, response)
continueSession(learnerId, uiState)
endSession(learnerId, uiState)
resetLearner(learnerId)
```

所有 transition return：

```js
{ ok, changed, state, events, audio }
```

`state` 必須 serialisable，唔可以有 closure、DOM node、Function。

### 7.4 Data shape 建議

```js
{
  version: 1,
  learnerId,
  prefs: {
    allowTeachingItems: true,
    speechRate: 1,
    showDomainBeforeAnswer: true
  },
  mastery: {
    skills: {},
    templates: {},
    questionTypes: {},
    items: {}
  },
  retryQueue: [],
  sessions: [],
  recentEvents: [],
  activeRound: null,
  contentReleaseId: 'grammar-v1'
}
```

Question item replay key：

```js
{
  contentReleaseId: 'grammar-v1',
  templateId: 'proc3_clause_join_rewrite',
  seed: 123456,
  questionType: 'rewrite'
}
```

### 7.5 Worker / full-lockdown compatible path

PR 49 將 spelling practice authority 移去 Worker subject commands。Grammar production 應該跟同一個 pattern：

```txt
Browser React component
  -> subject action dispatch
  -> Worker grammar command
  -> deterministic grammar service scoring
  -> repository write
  -> domain events
  -> updated read model
```

Production 唔應該：

- browser 直接生成 scored answer authority
- browser 直接寫 final mastery state
- localStorage 成為 source of truth
- AI 回答直接變 scored question 或 scored marking

Development / local reference 可以保留 browser-local mode，但 production path 要同 PR49 full-lockdown 邊界一致。

### 7.6 Repository wiring

用 generic platform boundary：

- `child_subject_state.ui`：UI snapshot / active round view state
- `child_subject_state.data`：grammar prefs / mastery / retry queue
- `practice_sessions`：active / completed / abandoned rounds
- `event_log`：domain events，例如 `grammar_answer_submitted`, `grammar_skill_mastery_changed`, `grammar_misconception_seen`

唔好新增 grammar-only side database，除非後期真係做 content CMS。

### 7.7 Tests 必須先行

最少要加：

1. grammar service unit tests：generator deterministic、marking、state transition、retry queue、migration。
2. template smoke tests：所有 templates 以多個 seed generate + evaluate 無 error。
3. mini-set regression tests：mixed + each concept focus，8/12 set 都唔 freeze。
4. subject expansion conformance：module contract、service contract、repository wiring、event publication。
5. golden-path smoke：dashboard → grammar → start → answer → summary → back。
6. learner switch + import/export restore active round。
7. AI safe-lane tests：AI output validation 只可 load whitelisted deterministic generator。

### 7.8 Suggested PR sequence

**PR A — Grammar service thin slice**

- Add grammar service + content constants.
- No production UI complexity.
- No Worker full command path yet if PR49 still unstable, but service should be Worker-ready.
- Add unit tests and template smoke tests.

**PR B — React subject module wiring**

- Replace placeholder grammar module.
- Add `GrammarPractice.jsx` using service actions.
- Add analytics snapshot rendering.
- Add subject expansion harness tests.

**PR C — Worker command boundary**

- Add grammar subject commands.
- Persist through generic repository collections.
- Emit domain events.
- Ensure production does not ship raw scoring/content authority if full-lockdown rule applies.

**PR D — Content expansion + reporting**

- Increase low-count skills such as pronouns/cohesion, formality, active/passive, subject/object, modal verbs, hyphen ambiguity.
- Add paragraph surgery / transfer tasks.
- Add Parent/Admin read model fields.

## 8. Final recommendation

我會保留呢份 HTML 作為 strong reference，但唔會直接上 production。作為 local prototype，佢已經好有價值。作為 `ks2-mastery` subject engine，下一步係抽 service、固定 deterministic state contract、加 tests、再配合 PR49 嘅 Worker-owned runtime boundary。

今次修正後，最危險嘅 runtime freeze 已處理。Engine 可以作為 Grammar thin slice 嘅基礎，但合併前一定要完成 service extraction 同 conformance tests。
