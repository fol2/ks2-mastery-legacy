# KS2 Punctuation Mastery legacy HTML engine audit 報告

日期：2026-04-23  
審核對象：`ks2_punctuation_mastery_v6.html`，並以 `KS2 Maths Reasoning Webapp.txt` 作方法論對照。  
輸出：`ks2_punctuation_mastery_v6_1_engine_review.html`、`ks2_punctuation_engine_review_v6_to_v6_1.diff`

## 1. 總結判斷

呢個 legacy HTML 已經唔係普通 quiz demo。它有一個相當完整嘅單檔原型 engine：技能圖譜、題庫、生成器、adaptive selection、spaced review、guided learn、GPS test mode、learner profile、localStorage persistence、AI context pack adapter、keyboard support、analytics。作為「離線 / local reference build」是有價值的；作為直接塞入 `ks2-mastery` production runtime 就唔應該。

最重要結論係：

1. **教學方法大方向正確**。它重視 punctuation placement、proofreading、paragraph transfer，而唔係只靠多項選擇。呢點比普通 SPaG drill 好。
2. **engine 已經足夠做 future Punctuation subject 的核心 seed**。尤其 `SKILLS`、`CONTENT`、`GENERATOR_FAMILIES`、`evaluateResponse`、`validateTransfer`、`updateScheduling` 呢幾組應該保留，但要拆出 service。
3. **唔可以直接把單檔 HTML 當 production subject**。PR 49 的方向是 full-lockdown：production authority 由 Worker / server-owned subject command boundary 控制，唔應該把 local engine、raw content、直接 API key、或 `?local=1` runtime 當產品路徑。
4. **我已經做咗一版 engine-only patch**。主要修 retry queue、accepted answer variants、validator tightness、localStorage fail-safe、attempt log error tags、防守式 profile delete。呢版係 standalone reference patch，不是最終 React/Worker migration。

## 2. 審核範圍

我集中審以下部分：

- engine architecture：runtime state、profile state、item state、facet state、session flow。
- methodology：adaptive practice、spaced return、interleaving、guided examples、transfer tasks。
- marking：exact answer marking、validator-based transfer marking、choose-mode marking。
- scheduling：item bucket、mastery、ease、intervalDays、retry queue。
- generated content：local deterministic generator registry、AI context pack validation。
- data persistence：localStorage import/export、profile migration、generated item pruning。
- integration readiness：如何拆成 `ks2-mastery` subject module / deterministic service / Worker command boundary。

我刻意冇評論 UI 視覺設計、layout、配色、branding，除非該 UI 直接影響 engine safety，例如 persistence warning。

## 3. Methodology / 學習設計評估

### 3.1 強項

這個 engine 最強嘅地方係「唔只做 recognition」。它有以下 practice jobs：

- choose：辨認正確版本。
- insert：直接放 punctuation。
- fix：proofread and repair。
- combine：句子重寫。
- paragraph：短文 proofreading。
- transfer：自己寫句子。

呢個 progression 幾合理，因為 punctuation mastery 唔應該停喺 MCQ。學生要可以把 punctuation 用入真句子和短文，先至可以轉移到寫作。

它亦有 smart review stages：retrieve、discriminate、place marks、proofread、transfer。呢個 loop 比 fixed-order practice 好，因為可以迫學生不斷轉換判斷：先記起規則，再比較 near-miss，再落筆，再 proofread，再轉移到 production。

### 3.2 同 KS2 English 對齊程度

核心技能 coverage 幾完整：capital letters/sentence endings、commas in lists、apostrophes for contraction/possession、direct speech、fronted adverbials、parenthesis、commas for clarity、colon before list、semi-colons、dashes、semi-colons in complex lists、bullet points、hyphens。呢個基本覆蓋 KS2 English vocabulary/grammar/punctuation 要求的主要 punctuation points。

更重要係，app 有 paragraph repair 同 transfer。KS2 English programme 強調 writing 要 plan/revise/evaluate，並 proofread spelling and punctuation errors；Year 5/6 亦要求 pupils propose changes to vocabulary, grammar and punctuation to enhance effects and clarify meaning。呢個 app 的 proofreading/paragraph mode 方向係對的。

### 3.3 未夠完整的地方

1. **content coverage 有深度但未夠 breadth validation**。題庫量夠 demo，但若做 production subject，需要 content release model，同埋每個 skill/facet 至少有 enough canonical examples、near-miss examples、generated templates、negative tests。
2. **marking 仍然偏 exact-match**。對 closed items OK，但對 transfer/free writing 應該有 rubric facets，例如 sentence boundary、target mark present、target mark position、capitalisation、speech punctuation inside quotes、unwanted punctuation。
3. **misconception analytics 未真正用盡**。item 有 `errorTags`，但舊版 attempt log 冇帶入。v6.1 patch 已修，但 migration 入 repo 時應該把 error tags 映射成 parent/admin analytics。
4. **generated variants 需要 seeded deterministic RNG**。現時 generator 用 `Math.random()`，local demo OK，但 production service 要固定 seed / deterministic transition，否則 replay、resume、test reproducibility 會弱。

## 4. Engine architecture 評估

### 4.1 現有單檔架構

目前單檔 HTML 用一個 IIFE 包住整個 runtime：

- constants：`SKILLS`、`CONTENT`、`MODES`、`LEXICON_BASE`、`GENERATOR_FAMILIES`。
- persistence：`loadDB`、`migrateDB`、`saveDB`。
- learner state：profile、itemStates、facetStates、customItems、attemptLog。
- scheduler：`itemStateSnapshot`、`skillSnapshot`、`selectAdaptiveItem`、`updateMemoryState`、`updateScheduling`。
- marking：`evaluateResponse`、`validateTransfer`。
- generation：`maybeTopUpGeneratedItems`、`chooseGeneratorFamily`。
- rendering/events：`render*`、`handleClick`、`handleKeydown`。

呢個結構做 single-file prototype 幾乾淨；但對 `ks2-mastery` 來講，要拆。最重要是：**pedagogy/service 要同 render 分開**。現在 service logic 同 render logic 同一個 closure，將來測試、Worker command、D1 persistence 都會受限制。

### 4.2 最應保留的 engine pieces

應該保留並移植：

- `SKILLS` as content/skill map seed。
- `CONTENT` as fixed seed item bank。
- `GENERATOR_FAMILIES` as deterministic item compiler templates。
- `normalizeText` and answer equivalence logic。
- `validateTransfer` but要改成 rubric/facet scoring。
- `updateMemoryState` / bucket model but要改為 deterministic transition output。
- `computeAnalytics` concept but移到 subject analytics snapshot。

### 4.3 應該放棄的 pieces

不應直接移植：

- full HTML render pipeline。
- direct `localStorage` as source of truth。
- direct browser API-key AI adapter as production feature。
- one giant closure as engine runtime。
- `Math.random()`-driven selection in production service。

## 5. 發現的 bug / glitch / engine polish

以下係我實際做咗 patch 或建議修的點。

### 5.1 Retry queue 會一直影響整個 session

舊版 `updateScheduling` 會在答錯時 push `session.retryQueue`，`selectAdaptiveItem` 會用 due plans 去 boost 近似重試。但 due plan 被用完之後沒有被 consume，等於一次錯題可能長時間繼續推高同一 skill/mode/family。這會令 smart review 過度黐住同一錯誤範圍，interleaving 變窄。

已修：加入 `consumeRetryPlanForItem(item)`，在答完一條已到期、同 skill/mode/family 匹配的 retry item 後移除一個 due plan。

### 5.2 Generated speech answers 對單引號太嚴格

固定題好多都接受 `"..."` 同 `'...'`，但 generated speech 題只收 double quotes。英國課堂常見 single inverted commas 也可接受，所以這是 false negative。

已修：加入 `expandAcceptedAnswers()`，所有 production answers 自動加入：

- double quote → single quote variant。
- em dash → spaced hyphen variant。

### 5.3 部分 transfer validators 太寬鬆

舊版 `containsSemicolonPhrases` 和 `containsDashPhrases` 只要求 phrases + punctuation mark，沒有要求 capital / sentence ending。`frontedAdverbialWithSpeech` 只要 starts with phrase comma、has quotes、sentence ending，對 speech punctuation inside quotes 判斷偏鬆。

已修：加入 `hasSentenceEnd()`、`startsWithCapital()`、`hasPunctuatedSpeech()`，並收緊：

- semi-colon transfer 要有句首大寫、semi-colon、句末 punctuation。
- dash transfer 要有句首大寫、dash、句末 punctuation。
- fronted adverbial + speech transfer 要有 fronted comma、speech quote、speech punctuation pattern。

### 5.4 localStorage save 失敗會打斷 engine

舊版 `saveDB()` 直接 `localStorage.setItem()`，如果瀏覽器 storage full、private mode、storage 被封，可能 throw exception，導致 practice flow 壞掉。

已修：`saveDB()` 加 try/catch，回傳 boolean，並設定 `APP.persistenceWarning`。這不是 production persistence solution，但令 standalone reference build 更安全。

### 5.5 attempt log 沒有記錄 errorTags

舊版 items/generator 有 `errorTags`，但 `logAttempt()` 沒寫入 attempt log。這令 misconception analytics 不能直接從 log 出來。

已修：attempt log 加 `errorTags: item.errorTags || []`。

### 5.6 profile delete defensive guard

UI 已經只在多於一個 profile 時顯示 delete，但 event handler 自身沒有 guard。若 DOM 被改或未來重構出現觸發，刪最後一個 profile 會令 active profile 空掉。

已修：handler 加 `if (APP.db.profiles.length <= 1)`。

## 6. 我做過的 validation

我做了以下 validation：

- `node --check`：原版與 patched JS 都通過 syntax check。
- 固定題庫 regression：75 條 fixed content 的 model/正確答案全部被 engine 接受。
- generator regression：41 個 generator family，每個跑 30 次；generated model answer 全部通過 marking。
- quote variant regression：generated speech 題的 single-quote variants 已可通過；測試中 150 個 single quote cases accepted。
- retry queue unit check：已到期 retry plan 在匹配 item 後可被 consume。
- hidden/bidi Unicode check：本地兩個相關檔案未發現 bidi control / hidden control characters。

限制：我沒有跑完整 headless browser e2e，因為當前 container 沒有 Playwright/jsdom。這不影響 engine-level static/unit review，但真正合入 repo 前要用 repo 的 subject-expansion harness 和 browser smoke tests 補上。

## 7. 對 `ks2-mastery` / PR 49 的整合指引

### 7.1 不要直接搬 HTML

直接把 `ks2_punctuation_mastery_v6_1_engine_review.html` 放入 `legacy/` 可以，但不應該成為 production route。它應該只作：

- archaeology reference。
- characterisation fixture。
- content seed extraction source。
- local comparison target。

PR 49 的 full-lockdown 方向已經把 spelling runtime authority 移到 Worker subject commands，並禁止 production bundle 暴露 raw local runtime/content。Punctuation 也應跟同一個方向。

### 7.2 建議 migration 形態

目標 architecture：

```txt
src/subjects/punctuation/index.js
        ↓
src/subjects/punctuation/punctuation-service.js
        ↓
src/subjects/punctuation/punctuation-content.js or versioned content release
        ↓
shared repository boundary / child_subject_state / practice_sessions / event_log
        ↓
Worker subject commands in production
        ↓
React PracticeComponent / Analytics / Settings through shared shell
```

### 7.3 Subject module contract

`src/subjects/punctuation/index.js` 應符合 repo subject contract：

```js
export const punctuationSubject = {
  id: 'punctuation',
  name: 'English Punctuation',
  blurb: 'KS2 punctuation mastery through proofreading, placement and transfer.',
  initState(previousState, learnerId) { ... },
  getDashboardStats(state, learnerId) { ... },
  PracticeComponent,
  handleAction(action, context) { ... }
};
```

不要再用 `renderPractice()` string renderer。repo docs 已經說新 subject 要 expose React practice component 或 explicit React subject component map。

### 7.4 Service contract

先做 narrow Punctuation thin slice，而不是一次過搬晒全部 feature。Service shape 建議：

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

所有 transition 回傳：

```js
{ ok, changed, state, events, audio }
```

這可以直接跟 repo subject-expansion harness 對齊。

### 7.5 第一個 production slice 應該縮窄

我建議 Punctuation 第一版 migration 唔好一次搬全部 v6 功能。先做：

- Smart Review。
- Weak Spots Drill。
- Insert / Fix / Choose / Combine。
- 8–10 個核心 skills。
- fixed seed item bank + deterministic generator seed。
- no AI context pack。
- no direct browser API key。
- no rich parent/admin extras beyond analytics snapshot。

暫時延後：

- paragraph repair full coverage。
- open transfer scoring beyond simple validators。
- AI context packs。
- custom lexicon context packs。
- local-only generator stock management。
- GPS timed mode if Worker session persistence未穩。

### 7.6 Content migration

先從 legacy 抽：

- `SKILLS` → `punctuation-skills.js`
- `CONTENT` → `punctuation-seed-items.js`
- `LEXICON_BASE`、`V5_TYPED` → `punctuation-lexicon.js`
- `GENERATOR_FAMILIES` → `punctuation-generators.js`
- `normalizeText`、`expandAcceptedAnswers`、`evaluateResponse`、`validateTransfer` → `punctuation-marking.js`
- `updateMemoryState`、`selectAdaptiveItem` → `punctuation-scheduler.js`

Production content should eventually be a versioned published content release, not a giant permanent JS blob. For first slice, static seed module is acceptable if it is not shipped as raw source in production and Worker controls runtime authority.

### 7.7 Worker command boundary

Following PR 49, production should call Worker subject commands, not run client-owned subject authority. Suggested command surface:

```txt
POST /api/subjects/punctuation/start
POST /api/subjects/punctuation/submit
POST /api/subjects/punctuation/continue
POST /api/subjects/punctuation/end
GET  /api/subjects/punctuation/read-model
```

Command must own:

- session creation。
- item selection。
- generated item seed。
- answer scoring。
- state transition。
- reward events。
- analytics read model。

React side should mostly render state and dispatch commands.

### 7.8 Persistence model

Use repo generic collections:

- `child_subject_state.ui`：current screen/session UI snapshot。
- `child_subject_state.data`：punctuation progress, prefs, generated seed counters。
- `practice_sessions`：active/completed rounds。
- `event_log`：answer submitted, item mastered, misconception seen, session completed。

不要加 hidden browser store、subject-specific side DB、analytics shadow store。

### 7.9 Tests required before merge

最低限度要加：

1. `punctuation-marking.test.js`
   - all seed model answers pass。
   - generated model answers pass。
   - single/double quote variants pass。
   - dash variants pass。
   - negative cases fail correctly。

2. `punctuation-scheduler.test.js`
   - weak/due/new weighting。
   - recent repetition penalty。
   - retry queue consume。
   - deterministic fixed-seed selection。

3. `punctuation-service.test.js`
   - init/restore safe。
   - start → submit → continue → end transitions。
   - transition events emitted。
   - no renderer dependency。

4. subject expansion conformance
   - module contract passes。
   - all shared tabs render。
   - state persists through generic repositories。
   - import/export restore keeps live round。
   - render/action failure stays contained inside subject tab。

5. production lockdown audit
   - no raw `/src/subjects/punctuation/...` exposed。
   - no direct client AI API-key punctuation calls in production bundle。
   - no local-only runtime path used as product route。
   - Worker-backed demo route still works if demo access is supported。

## 8. Recommendation

My recommendation：

- **Keep patched standalone HTML as reference artefact**：good for manual testing and archaeology。
- **Do not merge it as app code**：太多 client-owned authority，和 full-lockdown direction 衝突。
- **Extract and migrate engine in phases**：先 marking/content/scheduler/service，再 React subject, then Worker command boundary, then analytics/hub read model。
- **First slice should be small and deterministic**：不要一次過搬 AI context pack、custom lexicon、paragraph transfer、GPS timing。先令 service contract + tests 綠。

The patched HTML is useful, but the production-quality product move is to treat it as an engine donor, not as the future app shell.
