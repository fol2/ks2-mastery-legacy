(function () {
  if (typeof TEMPLATES === "undefined" || typeof TEMPLATE_MAP === "undefined") return;

  function registerExtraTemplates(extraTemplates) {
    extraTemplates.forEach(template => {
      if (TEMPLATE_MAP[template.id]) return;
      TEMPLATES.push(template);
      TEMPLATE_MAP[template.id] = template;
    });
  }

  function renderChoiceList(options) {
    return `<div class="option-list">${options.map(([letter, text]) => `<div><strong>${letter}.</strong> ${escapeHtml(text)}</div>`).join("")}</div>`;
  }

  function makeDigitNumber(digits) {
    return Number(digits.join(""));
  }

  function usesDigitSetOnce(value, digitSet) {
    const text = String(Math.trunc(Math.abs(value)));
    if (text.length !== digitSet.length) return false;
    const actual = text.split("").map(Number).sort((a, b) => a - b);
    const expected = digitSet.slice().sort((a, b) => a - b);
    return actual.every((digit, index) => digit === expected[index]);
  }

  function permutations(items) {
    const out = [];
    function walk(arr, start) {
      if (start === arr.length) {
        out.push(arr.slice());
        return;
      }
      for (let i = start; i < arr.length; i++) {
        [arr[start], arr[i]] = [arr[i], arr[start]];
        walk(arr, start + 1);
        [arr[start], arr[i]] = [arr[i], arr[start]];
      }
    }
    walk(items.slice(), 0);
    return out;
  }

  function numberLineSvg(start, step, tickCount, targetIndex) {
    const width = 430;
    const height = 120;
    const left = 35;
    const right = 395;
    const y = 52;
    const gap = (right - left) / (tickCount - 1);
    let ticks = `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#2563eb" stroke-width="3" />`;
    for (let i = 0; i < tickCount; i++) {
      const x = left + i * gap;
      const label = i === targetIndex ? "?" : formatNumber(start + step * i);
      ticks += `<line x1="${x}" y1="${y - 12}" x2="${x}" y2="${y + 12}" stroke="#1f2937" stroke-width="2" />`;
      ticks += `<text x="${x}" y="${y + 34}" text-anchor="middle" font-size="14" fill="#1f2937">${escapeHtml(label)}</text>`;
    }
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Number line">${ticks}</svg>`;
  }

  function formatDurationText(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours && minutes) return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;
    if (hours) return `${hours} hour${hours === 1 ? "" : "s"}`;
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  function formatLitresMl(totalMl) {
    const litres = Math.floor(totalMl / 1000);
    const ml = totalMl % 1000;
    if (litres && ml) return `${litres} l ${ml} ml`;
    if (litres) return `${litres} l`;
    return `${ml} ml`;
  }

  function angleTypeName(angle) {
    if (angle === 90) return "right-angled";
    if (angle > 90) return "obtuse-angled";
    return "acute-angled";
  }

  function turnPhrase(quarterTurns) {
    if (quarterTurns === 1) return "quarter turn";
    if (quarterTurns === 2) return "half turn";
    return "three-quarter turn";
  }

  function tallyMarks(count) {
    const groups = [];
    let remaining = count;
    while (remaining >= 5) {
      groups.push("||||/");
      remaining -= 5;
    }
    if (remaining > 0) groups.push("|".repeat(remaining));
    return groups.join(" ");
  }

  function lineGraphSvg(values, labels, yStep, title) {
    const width = 430;
    const height = 250;
    const left = 50;
    const top = 20;
    const chartW = 330;
    const chartH = 170;
    const maxValue = Math.max(...values, yStep) + yStep;
    const xGap = chartW / (labels.length - 1);
    const points = values.map((value, index) => {
      const x = left + xGap * index;
      const y = top + chartH - (value / maxValue) * chartH;
      return { x, y, value, label: labels[index] };
    });
    const yLabels = [];
    for (let value = 0; value <= maxValue; value += yStep) yLabels.push(value);
    const grid = yLabels.map(value => {
      const y = top + chartH - (value / maxValue) * chartH;
      return `<g><line x1="${left}" y1="${y}" x2="${left + chartW}" y2="${y}" stroke="#e2e8f0" stroke-width="1" /><text x="${left - 10}" y="${y + 5}" text-anchor="end" font-size="12" fill="#64748b">${value}</text></g>`;
    }).join("");
    const polyline = `<polyline fill="none" stroke="#2563eb" stroke-width="3" points="${points.map(point => `${point.x},${point.y}`).join(" ")}" />`;
    const dots = points.map(point => `<g><circle cx="${point.x}" cy="${point.y}" r="4" fill="#1d4ed8" /><text x="${point.x}" y="${top + chartH + 22}" text-anchor="middle" font-size="12" fill="#475569">${escapeHtml(point.label)}</text></g>`).join("");
    return `<div class="viz-card"><div class="viz-title">${escapeHtml(title)}</div><svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}"><line x1="${left}" y1="${top + chartH}" x2="${left + chartW}" y2="${top + chartH}" stroke="#94a3b8" stroke-width="2" /><line x1="${left}" y1="${top}" x2="${left}" y2="${top + chartH}" stroke="#94a3b8" stroke-width="2" />${grid}${polyline}${dots}</svg></div>`;
  }

  function pictogramHtml(rows, scale, icon = "●") {
    return `<div class="viz-card"><div class="viz-title">Pictogram key: ${icon} = ${scale}</div><div class="option-list">${rows.map(([label, count]) => {
      const icons = icon.repeat(Math.round(count / scale));
      return `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(icons)}</div>`;
    }).join("")}</div></div>`;
  }

  function formatDecimalString(value) {
    return Number(value.toFixed(3)).toString();
  }

  function moneyValueFromPence(pence) {
    return Number((pence / 100).toFixed(2));
  }

  function formatPenceMoney(pence) {
    return formatMoney(moneyValueFromPence(pence));
  }

  function parseMoneyToPence(value) {
    const amount = parseNumberInput(value);
    if (amount === null) return null;
    return Math.round(amount * 100);
  }

  const FDP_LINK_CASES = [
    { n: 1, d: 2, decimal: 0.5, percent: 50 },
    { n: 1, d: 4, decimal: 0.25, percent: 25 },
    { n: 3, d: 4, decimal: 0.75, percent: 75 },
    { n: 1, d: 5, decimal: 0.2, percent: 20 },
    { n: 2, d: 5, decimal: 0.4, percent: 40 },
    { n: 3, d: 5, decimal: 0.6, percent: 60 },
    { n: 4, d: 5, decimal: 0.8, percent: 80 },
    { n: 1, d: 10, decimal: 0.1, percent: 10 },
    { n: 3, d: 10, decimal: 0.3, percent: 30 },
    { n: 7, d: 10, decimal: 0.7, percent: 70 },
    { n: 9, d: 10, decimal: 0.9, percent: 90 }
  ];

  function buildTemplateId(id) {
    return `npv_${id}`;
  }

  const extraTemplates = [
    {
      id: buildTemplateId("number_line_label"),
      label: "Number line missing label",
      domain: "Number and place value",
      skillIds: ["pv_compare"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const step = pick(rng, [50, 100, 200, 250]);
        const tickCount = 6;
        const start = randInt(rng, 12, 65) * step;
        const targetIndex = randInt(rng, 1, tickCount - 2);
        const answer = start + step * targetIndex;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>The number line is marked in equal steps.</p><p>What number should replace the missing label <strong>?</strong> What is the size of each step?</p>`,
          visualHtml: numberLineSvg(start, step, tickCount, targetIndex),
          solutionLines: [
            `Look at the gap between two labelled marks. Each jump is ${formatNumber(step)}.`,
            `Move ${targetIndex} equal jumps from ${formatNumber(start)}.`,
            `The missing label is ${formatNumber(answer)} and the step size is ${formatNumber(step)}.`
          ],
          checkLine: `Each label should increase by the same amount: ${formatNumber(step)}.`,
          reflectionPrompt: "Did you count the jumps or the marks?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "label", label: "Missing label", kind: "number" },
              { key: "step", label: "Step size", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const labelAnswer = parseNumberInput(resp.label);
            const stepAnswer = parseNumberInput(resp.step);
            let score = 0;
            if (labelAnswer === answer) score += 1;
            if (stepAnswer === step) score += 1;
            const answerText = `Missing label ${formatNumber(answer)}; step size ${formatNumber(step)}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${formatNumber(start)} + ${targetIndex} lots of ${formatNumber(step)} = ${formatNumber(answer)}. The step size is ${formatNumber(step)}.`,
                answerText
              });
            }
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception: stepAnswer !== step ? "number_line_scale_error" : "place_value_slip",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: answerText,
              answerText
            });
          }
        });
      }
    },
    {
      id: buildTemplateId("hidden_digit_limit"),
      label: "Hidden digit under a limit",
      domain: "Number and place value",
      skillIds: ["pv_compare"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const place = pick(rng, [10, 100]);
        const positionLabel = place === 100 ? "hundreds" : "tens";
        const parts = {
          thousands: randInt(rng, 2, 8),
          hundreds: randInt(rng, 0, 9),
          tens: randInt(rng, 0, 9),
          ones: randInt(rng, 1, 9)
        };
        const answer = randInt(rng, 1, 8);
        if (place === 100) parts.hundreds = null;
        else parts.tens = null;
        const correctNumber = (parts.thousands * 1000) + (place === 100 ? answer * 100 : parts.hundreds * 100) + (place === 10 ? answer * 10 : parts.tens * 10) + parts.ones;
        const cap = correctNumber + randInt(rng, 1, place);
        const gap = cap - correctNumber;
        const shown = `${parts.thousands}${parts.hundreds === null ? "?" : parts.hundreds}${parts.tens === null ? "?" : parts.tens}${parts.ones}`;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>The number is <strong>${shown}</strong>.</p><p>The hidden digit is in the ${positionLabel} place.</p><p>What is the greatest digit that makes the number less than <strong>${formatNumber(cap)}</strong>? How much smaller than the limit is the completed number?</p>`,
          solutionLines: [
            `Try the largest possible digit first because the question asks for the greatest one.`,
            `${shown.replace("?", answer)} = ${formatNumber(correctNumber)}.`,
            `It is ${formatNumber(gap)} less than ${formatNumber(cap)}, so the digit is ${answer}.`
          ],
          checkLine: `If you increase the hidden digit by 1, the number becomes too large. The gap to the limit is ${formatNumber(gap)}.`,
          reflectionPrompt: "Which place value changed when the hidden digit changed?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "digit", label: "Greatest digit", kind: "number" },
              { key: "gap", label: "How much smaller than the limit?", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const digitAnswer = parseNumberInput(resp.digit);
            const gapAnswer = parseNumberInput(resp.gap);
            let score = 0;
            if (digitAnswer === answer) score += 1;
            if (gapAnswer === gap) score += 1;
            const answerText = `Digit ${answer}; gap ${formatNumber(gap)}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `Using ${answer} makes the number ${formatNumber(correctNumber)}, which is ${formatNumber(gap)} below ${formatNumber(cap)}.`,
                answerText
              });
            }
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception: digitAnswer !== answer ? "constraint_ignored" : "skipped_step",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: answerText,
              answerText
            });
          }
        });
      }
    },
    {
      id: buildTemplateId("smallest_number_clues"),
      label: "Smallest number from digit clues",
      domain: "Number and place value",
      skillIds: ["pv_compare", "pv_rounding"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const digitSet = shuffle(rng, [0, randInt(rng, 1, 4), randInt(rng, 5, 7), randInt(rng, 8, 9)]).filter((digit, index, arr) => arr.indexOf(digit) === index);
        if (digitSet.length < 4) return this.generator(seed + 17);
        const place = 100;
        const perms = permutations(digitSet).filter(p => p[0] !== 0).map(makeDigitNumber);
        const threshold = randInt(rng, 22, 54) * 100;
        const valid = perms.filter(n => n > threshold);
        const grouped = {};
        valid.forEach(n => {
          const target = roundToPlace(n, place);
          if (!grouped[target]) grouped[target] = [];
          grouped[target].push(n);
        });
        const candidates = Object.entries(grouped).filter(([, nums]) => nums.length >= 2);
        if (!candidates.length) return this.generator(seed + 31);
        const [roundedText, nums] = pick(rng, candidates);
        nums.sort((a, b) => a - b);
        const answer = nums[0];
        const roundedTarget = Number(roundedText);
        return makeBaseQuestion(this, seed, {
          marks: 1,
          stemHtml: `<p>Use each of these digits once: <strong>${digitSet.join(", ")}</strong>.</p><p>Make the <strong>smallest</strong> 4-digit number that is greater than <strong>${formatNumber(threshold)}</strong> and rounds to <strong>${formatNumber(roundedTarget)}</strong> to the nearest 100.</p>`,
          solutionLines: [
            `List the numbers you can make that are greater than ${formatNumber(threshold)}.`,
            `Keep only the ones that round to ${formatNumber(roundedTarget)}.`,
            `The smallest valid number is ${formatNumber(answer)}.`
          ],
          checkLine: `Check both rules: greater than ${formatNumber(threshold)} and rounds to ${formatNumber(roundedTarget)}.`,
          reflectionPrompt: "Which rule was more helpful to check first?",
          inputSpec: { type: "number", label: "Smallest possible number" },
          evaluate: (resp) => {
            const numberAnswer = parseNumberInput(resp.answer);
            if (numberAnswer === null) {
              return mkResult({
                correct: false,
                score: 0,
                maxScore: 1,
                misconception: "misread_question",
                feedbackShort: "Enter a number."
              });
            }
            if (numberAnswer === answer) {
              return mkResult({
                correct: true,
                score: 1,
                maxScore: 1,
                feedbackShort: "Correct.",
                feedbackLong: `${formatNumber(answer)} is the smallest valid arrangement of the digits.`,
                answerText: formatNumber(answer)
              });
            }
            let feedbackLong = `The smallest valid number is ${formatNumber(answer)}.`;
            let misconception = "constraint_ignored";
            if (!usesDigitSetOnce(numberAnswer, digitSet)) {
              feedbackLong = `Use each of the digits ${digitSet.join(", ")} once. The smallest valid number is ${formatNumber(answer)}.`;
              misconception = "place_value_slip";
            } else if (numberAnswer <= threshold || roundToPlace(numberAnswer, place) !== roundedTarget) {
              feedbackLong = `Check both clues carefully. The number must be greater than ${formatNumber(threshold)} and round to ${formatNumber(roundedTarget)}.`;
            } else {
              feedbackLong = `${formatNumber(numberAnswer)} works for the clues, but it is not the smallest possible number.`;
            }
            return mkResult({
              correct: false,
              score: 0,
              maxScore: 1,
              misconception,
              feedbackShort: "Not quite.",
              feedbackLong,
              answerText: formatNumber(answer)
            });
          }
        });
      }
    },
    {
      id: buildTemplateId("rounding_true_statement"),
      label: "Halfway rounding error analysis",
      domain: "Number and place value",
      skillIds: ["pv_rounding", "pv_compare"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const place = pick(rng, [100, 1000]);
        const lowerTarget = randInt(rng, 18, 84) * place;
        const halfwayNumber = lowerTarget + (place / 2);
        const correctRounded = lowerTarget + place;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `
            <p>A pupil says:</p>
            <div class="callout">“${formatNumber(halfwayNumber)} rounds to ${formatNumber(lowerTarget)} to the nearest ${formatNumber(place)}.”</div>
            <p>Which mistake has the pupil made, and what is the correct rounded number?</p>`,
          solutionLines: [
            `${formatNumber(halfwayNumber)} is exactly halfway between ${formatNumber(lowerTarget)} and ${formatNumber(correctRounded)}.`,
            `A halfway value rounds up to the next multiple of ${formatNumber(place)}.`,
            `So the correct rounded number is ${formatNumber(correctRounded)}.`
          ],
          checkLine: `At an exact halfway point, the number rounds up.`,
          reflectionPrompt: "Did you notice that the number sat exactly halfway between two options?",
          inputSpec: {
            type: "multi",
            fields: [
              {
                key: "reason",
                label: "Mistake",
                kind: "radio",
                options: [
                  ["halfway", "They forgot that a halfway value rounds up."],
                  ["place", "They rounded to the wrong place value."],
                  ["none", "There is no mistake."]
                ]
              },
              { key: "rounded", label: "Correct rounded number", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const roundedAnswer = parseNumberInput(resp.rounded);
            let score = 0;
            if (resp.reason === "halfway") score += 1;
            if (roundedAnswer === correctRounded) score += 1;
            const answerText = `Halfway values round up; ${formatNumber(correctRounded)}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${formatNumber(halfwayNumber)} is exactly halfway, so it rounds up to ${formatNumber(correctRounded)}.`,
                answerText
              });
            }
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception: "halfway_rounding",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${formatNumber(halfwayNumber)} is exactly halfway, so it rounds up to ${formatNumber(correctRounded)}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: buildTemplateId("greatest_under_cap"),
      label: "Rounding range endpoints",
      domain: "Number and place value",
      skillIds: ["pv_rounding"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const place = pick(rng, [100, 1000]);
        const target = randInt(rng, 15, 82) * place;
        const smallest = target - (place / 2);
        const greatest = target + (place / 2) - 1;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Write the <strong>smallest</strong> and <strong>greatest</strong> whole numbers that round to <strong>${formatNumber(target)}</strong> to the nearest <strong>${formatNumber(place)}</strong>.</p>`,
          solutionLines: [
            `The halfway point below ${formatNumber(target)} is ${formatNumber(smallest)}, so that is the smallest whole number that rounds up to ${formatNumber(target)}.`,
            `The next halfway point above ${formatNumber(target)} is ${formatNumber(greatest + 1)}, so ${formatNumber(greatest)} is the greatest whole number that still rounds to ${formatNumber(target)}.`,
            `The full rounding range is ${formatNumber(smallest)} to ${formatNumber(greatest)}.`
          ],
          checkLine: `A rounding range starts at the halfway point below and ends one less than the halfway point above.`,
          reflectionPrompt: "Did you include the lower halfway point but stop one before the upper halfway point?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "smallest", label: "Smallest whole number", kind: "number" },
              { key: "greatest", label: "Greatest whole number", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const smallestAnswer = parseNumberInput(resp.smallest);
            const greatestAnswer = parseNumberInput(resp.greatest);
            let score = 0;
            if (smallestAnswer === smallest) score += 1;
            if (greatestAnswer === greatest) score += 1;
            const answerText = `Smallest ${formatNumber(smallest)}; greatest ${formatNumber(greatest)}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The numbers are ${formatNumber(smallest)} and ${formatNumber(greatest)}.`,
                answerText
              });
            }
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception: "halfway_rounding",
              feedbackShort: score ? "One end of the range is right." : "Not quite.",
              feedbackLong: `The rounding range is ${formatNumber(smallest)} to ${formatNumber(greatest)}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: buildTemplateId("digit_value_difference"),
      label: "Difference in digit values",
      domain: "Number and place value",
      skillIds: ["pv_compare"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const placePairs = [
          ["thousands", 1000, "tens", 10],
          ["ten-thousands", 10000, "hundreds", 100],
          ["hundreds", 100, "ones", 1]
        ];
        const [highLabel, highPlace, lowLabel, lowPlace] = pick(rng, placePairs);
        const highDigit = randInt(rng, 4, 9);
        const lowDigit = randInt(rng, 1, 8);
        const otherDigits = [
          randInt(rng, 1, 9),
          randInt(rng, 0, 9),
          randInt(rng, 0, 9),
          randInt(rng, 0, 9),
          randInt(rng, 0, 9)
        ];
        const placeMap = {
          "ten-thousands": 0,
          thousands: 1,
          hundreds: 2,
          tens: 3,
          ones: 4
        };
        otherDigits[placeMap[highLabel]] = highDigit;
        otherDigits[placeMap[lowLabel]] = lowDigit;
        const number = makeDigitNumber(otherDigits);
        const highValue = highDigit * highPlace;
        const lowValue = lowDigit * lowPlace;
        const answer = highValue - lowValue;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Look at the number <strong>${formatNumber(number)}</strong>.</p><p>What is the value of the digit in the <strong>${highLabel}</strong> place? Then work out how much greater it is than the value of the digit in the <strong>${lowLabel}</strong> place.</p>`,
          solutionLines: [
            `The ${highLabel} digit is worth ${formatNumber(highValue)}.`,
            `The ${lowLabel} digit is worth ${formatNumber(lowValue)}.`,
            `${formatNumber(highValue)} - ${formatNumber(lowValue)} = ${formatNumber(answer)}.`
          ],
          checkLine: "Compare the values, not just the digits themselves.",
          reflectionPrompt: "Did you convert each digit into its full place value first?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "highValue", label: `Value of the ${highLabel} digit`, kind: "number" },
              { key: "difference", label: "Difference in value", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const highValueAnswer = parseNumberInput(resp.highValue);
            const differenceAnswer = parseNumberInput(resp.difference);
            let score = 0;
            if (highValueAnswer === highValue) score += 1;
            if (differenceAnswer === answer) score += 1;
            const answerText = `Value ${formatNumber(highValue)}; difference ${formatNumber(answer)}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The ${highLabel} digit is worth ${formatNumber(highValue)}, so the difference in value is ${formatNumber(answer)}.`,
                answerText
              });
            }
            const digitDifference = highDigit - lowDigit;
            let misconception = "digit_value_confusion";
            if (highValueAnswer === highValue && differenceAnswer !== answer) misconception = "skipped_step";
            if (highValueAnswer === highDigit || differenceAnswer === digitDifference) misconception = "digit_value_confusion";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The ${highLabel} digit is worth ${formatNumber(highValue)}, and the difference in value is ${formatNumber(answer)}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: buildTemplateId("rounded_order_choice"),
      label: "Largest after rounding",
      domain: "Number and place value",
      skillIds: ["pv_rounding", "pv_compare"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const place = pick(rng, [100, 1000]);
        const labels = shuffle(rng, ["A", "B", "C", "D"]);
        const roundedBaseSet = new Set();
        while (roundedBaseSet.size < 4) {
          roundedBaseSet.add(randInt(rng, 21, 79));
        }
        const roundedBases = Array.from(roundedBaseSet).sort((a, b) => a - b).map(n => n * place);
        const towns = shuffle(rng, ["Oak", "Birch", "Cedar", "Maple"]);
        const options = roundedBases.map((rounded, index) => {
          const actual = rounded + randInt(rng, -Math.floor(place / 2) + 10, Math.floor(place / 2) - 10);
          return [labels[index], `${towns[index]} has ${formatNumber(actual)} people.` , actual, rounded];
        });
        options.sort((a, b) => b[3] - a[3]);
        const correctTown = options[0][0];
        const correctRounded = options[0][3];
        const display = shuffle(rng, options);
        const actualLeader = display.slice().sort((a, b) => b[2] - a[2])[0][0];
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Each town population will be rounded to the nearest <strong>${formatNumber(place)}</strong>.</p><p>Which town will be <strong>largest after rounding</strong>, and what will its rounded population be?</p>${renderChoiceList(display.map(([letter, text]) => [letter, text]))}`,
          solutionLines: [
            `Round each population to the nearest ${formatNumber(place)}.`,
            `The largest rounded value belongs to ${correctTown}.`,
            `Its rounded population is ${formatNumber(correctRounded)}.`
          ],
          checkLine: "Round first, then compare the rounded values.",
          reflectionPrompt: "Did any rounded values stay close enough to be confused?",
          inputSpec: {
            type: "multi",
            fields: [
              {
                key: "town",
                label: "Largest after rounding",
                kind: "select",
                options: display.map(([letter]) => [letter, letter])
              },
              { key: "rounded", label: "Rounded population", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const roundedAnswer = parseNumberInput(resp.rounded);
            let score = 0;
            if (resp.town === correctTown) score += 1;
            if (roundedAnswer === correctRounded) score += 1;
            const answerText = `${correctTown}; ${formatNumber(correctRounded)}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${correctTown} is largest after rounding, and it rounds to ${formatNumber(correctRounded)}.`,
                answerText
              });
            }
            let misconception = "place_value_slip";
            const chosen = display.find(([letter]) => letter === resp.town);
            if ((resp.town === actualLeader && actualLeader !== correctTown) || (chosen && roundedAnswer === chosen[2])) {
              misconception = "rounded_comparison_error";
            }
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${correctTown} is largest after rounding, and it rounds to ${formatNumber(correctRounded)}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "calc_full_groups_leftover",
      label: "Full groups and leftover",
      domain: "Calculation",
      skillIds: ["mul_div_structure"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const groupSize = pick(rng, [4, 5, 6, 8, 9]);
        const fullGroups = randInt(rng, 4, 11);
        const leftover = randInt(rng, 1, groupSize - 1);
        const total = fullGroups * groupSize + leftover;
        const contexts = [
          ["pupils", "teams"],
          ["books", "shelves"],
          ["stickers", "packs"],
          ["biscuits", "plates"]
        ];
        const [item, groupName] = pick(rng, contexts);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p><strong>${total}</strong> ${item} need to be put into equal ${groupName} of <strong>${groupSize}</strong>.</p><p>How many <strong>full</strong> ${groupName} can be made, and how many ${item} will be left over?</p>`,
          solutionLines: [
            `${formatNumber(total)} ÷ ${groupSize} = ${fullGroups} remainder ${leftover}.`,
            `So ${fullGroups} full ${groupName} can be made.`,
            `${leftover} ${item} will be left over.`
          ],
          checkLine: "The number left over must be smaller than the group size.",
          reflectionPrompt: "Did you decide what the remainder meant in the context?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "groups", label: `Full ${groupName}`, kind: "number" },
              { key: "leftover", label: `${item} left over`, kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const groupsAnswer = parseNumberInput(resp.groups);
            const leftoverAnswer = parseNumberInput(resp.leftover);
            let score = 0;
            if (groupsAnswer === fullGroups) score += 1;
            if (leftoverAnswer === leftover) score += 1;
            const answerText = `${fullGroups} full ${groupName}; ${leftover} left over`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${formatNumber(total)} ÷ ${groupSize} = ${fullGroups} remainder ${leftover}, so the answer is ${answerText}.`,
                answerText
              });
            }
            let misconception = "operation_choice";
            if (groupsAnswer === fullGroups || groupsAnswer === Math.ceil(total / groupSize) || leftoverAnswer === 0) {
              misconception = "remainder_interpretation";
            }
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${formatNumber(total)} ÷ ${groupSize} = ${fullGroups} remainder ${leftover}, so the answer is ${answerText}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "calc_compare_two_totals",
      label: "Compare two totals",
      domain: "Calculation",
      skillIds: ["mul_div_structure", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const aGroups = randInt(rng, 4, 8);
        const aPerGroup = randInt(rng, 16, 34);
        const bGroups = randInt(rng, 4, 8);
        const bPerGroup = randInt(rng, 16, 34);
        const aTotal = aGroups * aPerGroup;
        const bTotal = bGroups * bPerGroup;
        if (aTotal === bTotal) return this.generator(seed + 23);
        const names = pick(rng, [
          ["Noah", "Aisha"],
          ["Eva", "Leo"],
          ["Mina", "Jay"]
        ]);
        const [nameA, nameB] = names;
        const item = pick(rng, ["cupcakes", "stickers", "posters", "seedlings"]);
        const winner = aTotal > bTotal ? nameA : nameB;
        const difference = Math.abs(aTotal - bTotal);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>${nameA} makes <strong>${aGroups}</strong> trays of <strong>${aPerGroup}</strong> ${item}.</p><p>${nameB} makes <strong>${bGroups}</strong> trays of <strong>${bPerGroup}</strong> ${item}.</p><p>Who makes more altogether, and by how many?</p>`,
          solutionLines: [
            `${nameA}: ${aGroups} × ${aPerGroup} = ${formatNumber(aTotal)}.`,
            `${nameB}: ${bGroups} × ${bPerGroup} = ${formatNumber(bTotal)}.`,
            `${winner} makes more, by ${formatNumber(difference)}.`
          ],
          checkLine: "Work out both totals before you compare them.",
          reflectionPrompt: "Did you compare the totals, not the tray counts on their own?",
          inputSpec: {
            type: "multi",
            fields: [
              {
                key: "winner",
                label: "Who makes more?",
                kind: "select",
                options: [[nameA, nameA], [nameB, nameB]]
              },
              { key: "difference", label: "Difference", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const differenceAnswer = parseNumberInput(resp.difference);
            let score = 0;
            if (resp.winner === winner) score += 1;
            if (differenceAnswer === difference) score += 1;
            const answerText = `${winner}; ${formatNumber(difference)}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${winner} makes more, by ${formatNumber(difference)} ${item}.`,
                answerText
              });
            }
            const misconception = resp.winner === winner || differenceAnswer === aTotal || differenceAnswer === bTotal
              ? "skipped_step"
              : "operation_choice";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${nameA} makes ${formatNumber(aTotal)}, ${nameB} makes ${formatNumber(bTotal)}, so the answer is ${answerText}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "calc_target_after_packs",
      label: "How many more to reach the target?",
      domain: "Calculation",
      skillIds: ["mul_div_structure", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const packs = randInt(rng, 4, 8);
        const perPack = randInt(rng, 18, 36);
        const loose = randInt(rng, 6, 24);
        const current = packs * perPack + loose;
        const target = current + randInt(rng, 24, 120);
        const contexts = pick(rng, [
          ["cards", "boxes", "school fair"],
          ["leaflets", "bundles", "open evening"],
          ["badges", "packs", "sports day"]
        ]);
        const [item, packName, event] = contexts;
        const needed = target - current;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>The ${event} needs <strong>${formatNumber(target)}</strong> ${item}.</p><p>There are already <strong>${packs}</strong> ${packName} of <strong>${perPack}</strong> and <strong>${loose}</strong> extra ${item}.</p><p>How many ${item} are there now, and how many more are needed?</p>`,
          solutionLines: [
            `${packs} × ${perPack} = ${formatNumber(packs * perPack)}.`,
            `${formatNumber(packs * perPack)} + ${loose} = ${formatNumber(current)} ${item} now.`,
            `${formatNumber(target)} - ${formatNumber(current)} = ${formatNumber(needed)} more needed.`
          ],
          checkLine: "Find the amount already there before you compare it with the target.",
          reflectionPrompt: "Did you stop after the pack calculation, or did you include the loose items as well?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "current", label: `${item} there now`, kind: "number" },
              { key: "needed", label: `${item} still needed`, kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const currentAnswer = parseNumberInput(resp.current);
            const neededAnswer = parseNumberInput(resp.needed);
            let score = 0;
            if (currentAnswer === current) score += 1;
            if (neededAnswer === needed) score += 1;
            const answerText = `Now ${formatNumber(current)}; need ${formatNumber(needed)}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `There are ${formatNumber(current)} ${item} now, so ${formatNumber(needed)} more are needed.`,
                answerText
              });
            }
            let misconception = "operation_choice";
            if (currentAnswer === current || currentAnswer === packs * perPack || neededAnswer === packs * perPack || neededAnswer === current) {
              misconception = "skipped_step";
            }
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `There are ${formatNumber(current)} ${item} now, so ${formatNumber(needed)} more are needed.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "calc_start_unknown_story",
      label: "Start unknown in a story",
      domain: "Calculation",
      skillIds: ["inverse_missing", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const start = randInt(rng, 28, 72);
        const gained = randInt(rng, 14, 36);
        const spent = randInt(rng, 8, 24);
        const afterGain = start + gained;
        const end = afterGain - spent;
        const [name, item, actionGain, actionSpent] = pick(rng, [
          ["Ava", "stickers", "wins", "gives away"],
          ["Bilal", "tokens", "buys", "uses"],
          ["Mia", "cards", "finds", "shares"]
        ]);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>${name} has some ${item}.</p><p>${name} ${actionGain} <strong>${gained}</strong> more, then ${actionSpent} <strong>${spent}</strong>.</p><p>Now ${name} has <strong>${end}</strong> ${item}.</p><p>How many ${item} did ${name} have at the start, and how many were there after the first change?</p>`,
          solutionLines: [
            `Undo the last change first: ${end} + ${spent} = ${afterGain}.`,
            `That means there were ${afterGain} ${item} after the first change.`,
            `Undo the earlier gain: ${afterGain} - ${gained} = ${start}.`
          ],
          checkLine: "Reverse the story one step at a time from the end.",
          reflectionPrompt: "Did you undo the most recent change first?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "start", label: `${item} at the start`, kind: "number" },
              { key: "afterGain", label: `${item} after the first change`, kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const startAnswer = parseNumberInput(resp.start);
            const afterGainAnswer = parseNumberInput(resp.afterGain);
            let score = 0;
            if (startAnswer === start) score += 1;
            if (afterGainAnswer === afterGain) score += 1;
            const answerText = `Start ${start}; after first change ${afterGain}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${name} started with ${start} ${item} and had ${afterGain} after the first change.`,
                answerText
              });
            }
            const misconception = score === 1 ? "skipped_step" : "inverse_error";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${name} started with ${start} ${item} and had ${afterGain} after the first change.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "calc_function_table_reverse",
      label: "Function table with a reverse step",
      domain: "Calculation",
      skillIds: ["inverse_missing"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const mult = pick(rng, [3, 4, 5, 6, 8]);
        const offset = pick(rng, [5, 7, 9, 12, 14]);
        const useAdd = randInt(rng, 0, 1) === 0;
        const minInput = useAdd ? 4 : Math.max(4, Math.floor(offset / mult) + 1);
        if (minInput > 14) return this.generator(seed + 29);
        const inputA = randInt(rng, minInput, 14);
        const inputBMin = Math.max(minInput, 5);
        if (inputBMin > 18) return this.generator(seed + 31);
        const inputB = randInt(rng, inputBMin, 18);
        const outputA = useAdd ? (inputA * mult + offset) : (inputA * mult - offset);
        const outputB = useAdd ? (inputB * mult + offset) : (inputB * mult - offset);
        const headers = ["Input", "Output"];
        const rows = [
          [formatNumber(inputA), "?"],
          ["?", formatNumber(outputB)]
        ];
        const ruleText = useAdd
          ? `multiply by ${mult}, then add ${offset}`
          : `multiply by ${mult}, then subtract ${offset}`;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>The rule is: <strong>${ruleText}</strong>.</p><p>Complete the table.</p>`,
          visualHtml: tableHtml(headers, rows),
          solutionLines: [
            `${formatNumber(inputA)} follows the rule to give ${formatNumber(outputA)}.`,
            `To work backwards from ${formatNumber(outputB)}, undo the ${useAdd ? "+" + offset : "-" + offset} first.`,
            `So the missing input is ${formatNumber(inputB)}.`
          ],
          checkLine: "Forward steps and reverse steps must match the same rule.",
          reflectionPrompt: "Did you undo the final part of the rule before you divided?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "outputA", label: `Output for ${formatNumber(inputA)}`, kind: "number" },
              { key: "inputB", label: `Input for ${formatNumber(outputB)}`, kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const outputAnswer = parseNumberInput(resp.outputA);
            const inputAnswer = parseNumberInput(resp.inputB);
            let score = 0;
            if (outputAnswer === outputA) score += 1;
            if (inputAnswer === inputB) score += 1;
            const answerText = `Output ${formatNumber(outputA)}; input ${formatNumber(inputB)}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The missing values are ${formatNumber(outputA)} and ${formatNumber(inputB)}.`,
                answerText
              });
            }
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception: "inverse_error",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The missing values are ${formatNumber(outputA)} and ${formatNumber(inputB)}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "calc_error_analysis_seating",
      label: "Error analysis: seating plan",
      domain: "Calculation",
      skillIds: ["mul_div_structure", "add_sub_multistep", "error_analysis"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const rows = randInt(rng, 5, 9);
        const seatsPerRow = randInt(rng, 18, 32);
        const broken = randInt(rng, 6, 18);
        const totalSeats = rows * seatsPerRow;
        const usable = totalSeats - broken;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `
            <p>A hall has <strong>${rows}</strong> rows of <strong>${seatsPerRow}</strong> seats.</p>
            <p><strong>${broken}</strong> seats are broken.</p>
            <p>A pupil says:</p>
            <div class="callout">“The number of usable seats is ${rows} + ${seatsPerRow} - ${broken}.”</div>
            <p>Which mistake has the pupil made, and how many seats can actually be used?</p>`,
          solutionLines: [
            `Find the total seats first: ${rows} × ${seatsPerRow} = ${formatNumber(totalSeats)}.`,
            `Then subtract the broken seats: ${formatNumber(totalSeats)} - ${broken} = ${formatNumber(usable)}.`,
            `The pupil added the two dimensions instead of multiplying them.`
          ],
          checkLine: "Rows and seats per row combine multiplicatively, not additively.",
          reflectionPrompt: "Did you identify the total before subtracting the broken seats?",
          inputSpec: {
            type: "multi",
            fields: [
              {
                key: "reason",
                label: "Mistake",
                kind: "radio",
                options: [
                  ["multiply", "They added rows and seats per row instead of multiplying to find the total seats."],
                  ["subtract_first", "They should subtract the broken seats before finding the total seats."],
                  ["none", "There is no mistake."]
                ]
              },
              { key: "usable", label: "Usable seats", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const usableAnswer = parseNumberInput(resp.usable);
            let score = 0;
            if (resp.reason === "multiply") score += 1;
            if (usableAnswer === usable) score += 1;
            const answerText = `Multiply first; ${formatNumber(usable)}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `There are ${formatNumber(usable)} usable seats because ${rows} × ${seatsPerRow} = ${formatNumber(totalSeats)} and ${formatNumber(totalSeats)} - ${broken} = ${formatNumber(usable)}.`,
                answerText
              });
            }
            const misconception = resp.reason === "multiply" || usableAnswer === totalSeats ? "skipped_step" : "operation_choice";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `There are ${formatNumber(usable)} usable seats because ${rows} × ${seatsPerRow} = ${formatNumber(totalSeats)} and ${formatNumber(totalSeats)} - ${broken} = ${formatNumber(usable)}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "frac_missing_whole_from_part",
      label: "Find the whole from a fraction part",
      domain: "Fractions",
      skillIds: ["fractions_quantity"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const den = pick(rng, [3, 4, 5, 6, 8, 10]);
        const num = randInt(rng, 2, den - 1);
        const onePart = randInt(rng, 3, 12);
        const partValue = onePart * num;
        const total = onePart * den;
        const [item, focus] = pick(rng, [
          ["stickers", "gold stickers"],
          ["books", "poetry books"],
          ["marbles", "blue marbles"],
          ["cards", "football cards"]
        ]);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p><strong>${fractionToText(num, den)}</strong> of the <strong>${item}</strong> are <strong>${focus}</strong>.</p><p>There are <strong>${partValue}</strong> ${focus}.</p><p>How many are in <strong>one equal part</strong>, and how many ${item} are there altogether?</p>`,
          solutionLines: [
            `${fractionToText(num, den)} means ${num} equal parts are worth ${partValue}.`,
            `One part is ${partValue} ÷ ${num} = ${onePart}.`,
            `The whole amount is ${onePart} × ${den} = ${total}.`
          ],
          checkLine: "If you know several equal parts, divide first to find one part.",
          reflectionPrompt: "Did you find one part before you multiplied to get the whole?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "onePart", label: "One equal part", kind: "number" },
              { key: "total", label: `${item} altogether`, kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const onePartAnswer = parseNumberInput(resp.onePart);
            const totalAnswer = parseNumberInput(resp.total);
            let score = 0;
            if (onePartAnswer === onePart) score += 1;
            if (totalAnswer === total) score += 1;
            const answerText = `One part ${onePart}; whole ${total}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `One equal part is ${onePart}, so there are ${total} ${item} altogether.`,
                answerText
              });
            }
            const misconception = onePartAnswer === onePart || totalAnswer === partValue ? "skipped_step" : "fraction_misconception";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `One equal part is ${onePart}, so there are ${total} ${item} altogether.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "frac_difference_between_groups",
      label: "Difference between fraction groups",
      domain: "Fractions",
      skillIds: ["fractions_quantity", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const den = pick(rng, [4, 5, 6, 7, 8, 10]);
        const num = randInt(rng, 1, Math.floor((den - 1) / 2));
        const total = den * randInt(rng, 6, 14);
        const selected = total * num / den;
        const notSelected = total - selected;
        const difference = notSelected - selected;
        const [item, focus] = pick(rng, [
          ["beads", "silver"],
          ["cards", "animal"],
          ["counters", "red"],
          ["books", "history"]
        ]);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p><strong>${fractionToText(num, den)}</strong> of the <strong>${total}</strong> ${item} are <strong>${focus}</strong>.</p><p>How many are ${focus}, and how many more are <strong>not</strong> ${focus} than are ${focus}?</p>`,
          solutionLines: [
            `Find the ${focus} ${item}: ${total} ÷ ${den} × ${num} = ${selected}.`,
            `So ${notSelected} are not ${focus}.`,
            `The difference is ${notSelected} - ${selected} = ${difference}.`
          ],
          checkLine: "After finding the fraction amount, decide whether the question wants the leftover or the difference.",
          reflectionPrompt: "Did you subtract the two groups at the end, or did you stop at the leftover?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "selected", label: `${focus} ${item}`, kind: "number" },
              { key: "difference", label: "How many more are not selected?", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const selectedAnswer = parseNumberInput(resp.selected);
            const differenceAnswer = parseNumberInput(resp.difference);
            let score = 0;
            if (selectedAnswer === selected) score += 1;
            if (differenceAnswer === difference) score += 1;
            const answerText = `${selected} ${focus}; difference ${difference}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${selected} are ${focus}, and there are ${difference} more not ${focus} than ${focus}.`,
                answerText
              });
            }
            const misconception = selectedAnswer === selected || differenceAnswer === notSelected
              ? "skipped_step"
              : "fraction_misconception";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${selected} are ${focus}, and there are ${difference} more not ${focus} than ${focus}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "frac_fraction_of_remainder",
      label: "Fraction of the remainder",
      domain: "Fractions",
      skillIds: ["fractions_quantity", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const firstOptions = [
          [1, 4],
          [1, 5],
          [2, 5],
          [1, 3]
        ];
        const secondOptions = [
          [1, 2],
          [2, 3],
          [3, 4]
        ];
        const [numA, denA] = pick(rng, firstOptions);
        const [numB, denB] = pick(rng, secondOptions);
        const total = denA * denB * randInt(rng, 3, 8);
        const firstAmount = total * numA / denA;
        const remainder = total - firstAmount;
        const secondAmount = remainder * numB / denB;
        const [item, firstLabel, secondLabel] = pick(rng, [
          ["books", "poetry books", "history books"],
          ["stickers", "star stickers", "letter stickers"],
          ["cards", "football cards", "animal cards"]
        ]);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p><strong>${fractionToText(numA, denA)}</strong> of the <strong>${total}</strong> ${item} are <strong>${firstLabel}</strong>.</p><p><strong>${fractionToText(numB, denB)}</strong> of the <strong>rest</strong> are <strong>${secondLabel}</strong>.</p><p>How many are left after the ${firstLabel} are taken away, and how many are ${secondLabel}?</p>`,
          solutionLines: [
            `${fractionToText(numA, denA)} of ${total} is ${firstAmount}.`,
            `So ${remainder} ${item} are left after the ${firstLabel} are taken away.`,
            `${fractionToText(numB, denB)} of ${remainder} is ${secondAmount}.`
          ],
          checkLine: "The second fraction acts on the remainder, not on the original whole.",
          reflectionPrompt: "Did you use the remainder as the new whole for the second fraction?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "remainder", label: `${item} left after the first group`, kind: "number" },
              { key: "secondAmount", label: `${secondLabel}`, kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const remainderAnswer = parseNumberInput(resp.remainder);
            const secondAmountAnswer = parseNumberInput(resp.secondAmount);
            let score = 0;
            if (remainderAnswer === remainder) score += 1;
            if (secondAmountAnswer === secondAmount) score += 1;
            const answerText = `Remainder ${remainder}; ${secondLabel} ${secondAmount}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${remainder} ${item} are left, and ${secondAmount} are ${secondLabel}.`,
                answerText
              });
            }
            const misconception = remainderAnswer === remainder || secondAmountAnswer === firstAmount
              ? "skipped_step"
              : "fraction_misconception";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${remainder} ${item} are left, and ${secondAmount} are ${secondLabel}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "frac_order_extremes",
      label: "Smallest and largest fraction",
      domain: "Fractions",
      skillIds: ["fractions_compare"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const pools = [
          [[1, 3], [2, 5], [3, 4], [5, 6]],
          [[1, 4], [3, 8], [2, 3], [7, 8]],
          [[2, 7], [1, 2], [3, 5], [4, 5]],
          [[1, 6], [3, 10], [2, 3], [9, 10]]
        ];
        const display = shuffle(rng, pick(rng, pools)).map(([n, d], index) => ({
          n,
          d,
          value: n / d,
          letter: String.fromCharCode(65 + index)
        }));
        const smallest = display.slice().sort((a, b) => a.value - b.value)[0].letter;
        const largest = display.slice().sort((a, b) => b.value - a.value)[0].letter;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Look at these fractions.</p>${renderChoiceList(display.map(item => [item.letter, fractionToText(item.n, item.d)]))}<p>Which fraction is <strong>smallest</strong>, and which fraction is <strong>largest</strong>?</p>`,
          solutionLines: [
            `Compare each fraction using benchmark fractions or a common denominator.`,
            `The smallest fraction is ${smallest}.`,
            `The largest fraction is ${largest}.`
          ],
          checkLine: "A larger denominator does not always mean a larger fraction.",
          reflectionPrompt: "Did you compare the size of the fractions, not just the numerators or denominators?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "smallest", label: "Smallest fraction", kind: "select", options: display.map(item => [item.letter, item.letter]) },
              { key: "largest", label: "Largest fraction", kind: "select", options: display.map(item => [item.letter, item.letter]) }
            ]
          },
          evaluate: (resp) => {
            let score = 0;
            if (resp.smallest === smallest) score += 1;
            if (resp.largest === largest) score += 1;
            const answerText = `Smallest ${smallest}; largest ${largest}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The smallest fraction is ${smallest}, and the largest fraction is ${largest}.`,
                answerText
              });
            }
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception: "fraction_misconception",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The smallest fraction is ${smallest}, and the largest fraction is ${largest}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "frac_between_benchmarks",
      label: "Fraction between two benchmarks",
      domain: "Fractions",
      skillIds: ["fractions_compare"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const scenarios = [
          { low: [1, 2], high: [3, 4], target: [3, 5], closer: [1, 2], options: [[2, 5], [3, 5], [3, 4], [4, 5]] },
          { low: [1, 2], high: [3, 4], target: [11, 16], closer: [3, 4], options: [[7, 16], [11, 16], [3, 4], [5, 6]] },
          { low: [1, 4], high: [1, 2], target: [2, 5], closer: [1, 2], options: [[1, 6], [2, 5], [1, 2], [3, 5]] },
          { low: [1, 3], high: [2, 3], target: [3, 5], closer: [2, 3], options: [[1, 4], [3, 5], [2, 3], [3, 4]] }
        ];
        const scenario = pick(rng, scenarios);
        const display = shuffle(rng, scenario.options).map(([n, d], index) => ({
          n,
          d,
          letter: String.fromCharCode(65 + index),
          text: fractionToText(n, d)
        }));
        const targetLetter = display.find(item => item.n === scenario.target[0] && item.d === scenario.target[1]).letter;
        const closerText = fractionToText(scenario.closer[0], scenario.closer[1]);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Which fraction lies <strong>between</strong> <strong>${fractionToText(scenario.low[0], scenario.low[1])}</strong> and <strong>${fractionToText(scenario.high[0], scenario.high[1])}</strong>?</p>${renderChoiceList(display.map(item => [item.letter, item.text]))}<p>Is that fraction closer to <strong>${fractionToText(scenario.low[0], scenario.low[1])}</strong> or to <strong>${fractionToText(scenario.high[0], scenario.high[1])}</strong>?</p>`,
          solutionLines: [
            `Only ${targetLetter} lies between the two benchmark fractions.`,
            `Then compare how far it is from each benchmark.`,
            `It is closer to ${closerText}.`
          ],
          checkLine: "A benchmark fraction can be a boundary, but the correct fraction must sit strictly inside the interval.",
          reflectionPrompt: "Did you first find the one that lies between before deciding which benchmark it is closer to?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "fraction", label: "Fraction between the benchmarks", kind: "select", options: display.map(item => [item.letter, item.letter]) },
              {
                key: "closer",
                label: "Closer to",
                kind: "select",
                options: [
                  [fractionToText(scenario.low[0], scenario.low[1]), fractionToText(scenario.low[0], scenario.low[1])],
                  [fractionToText(scenario.high[0], scenario.high[1]), fractionToText(scenario.high[0], scenario.high[1])]
                ]
              }
            ]
          },
          evaluate: (resp) => {
            let score = 0;
            if (resp.fraction === targetLetter) score += 1;
            if (resp.closer === closerText) score += 1;
            const answerText = `${targetLetter}; closer to ${closerText}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${targetLetter} is the fraction between the benchmarks, and it is closer to ${closerText}.`,
                answerText
              });
            }
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception: "fraction_misconception",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${targetLetter} is the fraction between the benchmarks, and it is closer to ${closerText}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "frac_error_compare",
      label: "Error analysis: comparing fractions",
      domain: "Fractions",
      skillIds: ["fractions_compare", "error_analysis"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const scenarios = [
          {
            left: [3, 8],
            right: [1, 2],
            pupilSymbol: ">",
            correctSymbol: "<",
            reasonKey: "numerator",
            reasonText: "They compared the numerators only instead of comparing the fraction sizes."
          },
          {
            left: [2, 3],
            right: [3, 5],
            pupilSymbol: "<",
            correctSymbol: ">",
            reasonKey: "denominator",
            reasonText: "They compared the denominators only instead of comparing the fraction sizes."
          }
        ];
        const scenario = pick(rng, scenarios);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `
            <p>A pupil says:</p>
            <div class="callout">“${fractionToText(scenario.left[0], scenario.left[1])} ${scenario.pupilSymbol} ${fractionToText(scenario.right[0], scenario.right[1])}”</div>
            <p>Which mistake has the pupil made, and what is the correct symbol?</p>`,
          solutionLines: [
            `You cannot compare fractions by looking at just one number.`,
            `Think about benchmark fractions or a common denominator.`,
            `The correct symbol is ${scenario.correctSymbol}.`
          ],
          checkLine: "A larger numerator or denominator on its own does not decide the size of a fraction.",
          reflectionPrompt: "Did you think about the size of each part as well as how many parts there are?",
          inputSpec: {
            type: "multi",
            fields: [
              {
                key: "reason",
                label: "Mistake",
                kind: "radio",
                options: [
                  ["numerator", "They compared the numerators only."],
                  ["denominator", "They compared the denominators only."],
                  ["none", "There is no mistake."]
                ]
              },
              {
                key: "symbol",
                label: "Correct symbol",
                kind: "select",
                options: [["<", "<"], [">", ">"], ["=", "="]]
              }
            ]
          },
          evaluate: (resp) => {
            let score = 0;
            if (resp.reason === scenario.reasonKey) score += 1;
            if (resp.symbol === scenario.correctSymbol) score += 1;
            const answerText = `${scenario.reasonText} ${scenario.correctSymbol}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${scenario.reasonText} The correct symbol is ${scenario.correctSymbol}.`,
                answerText
              });
            }
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception: "fraction_misconception",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${scenario.reasonText} The correct symbol is ${scenario.correctSymbol}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "frac_amount_table",
      label: "Fraction amount table",
      domain: "Fractions",
      skillIds: ["fractions_quantity"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const pairs = [
          [3, 4],
          [2, 3],
          [3, 5],
          [5, 6],
          [2, 7]
        ];
        const [numA, denA] = pick(rng, pairs);
        let pairB = pick(rng, pairs);
        if (pairB[0] === numA && pairB[1] === denA) pairB = [1, 3];
        const [numB, denB] = pairB;
        const totalA = denA * randInt(rng, 4, 10);
        const amountA = totalA * numA / denA;
        const totalB = denB * randInt(rng, 5, 12);
        const amountB = totalB * numB / denB;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Complete the table.</p>`,
          visualHtml: tableHtml(
            ["Whole amount", "Fraction", "Fraction amount"],
            [
              [formatNumber(totalA), fractionToText(numA, denA), "?"],
              ["?", fractionToText(numB, denB), formatNumber(amountB)]
            ]
          ),
          solutionLines: [
            `${fractionToText(numA, denA)} of ${formatNumber(totalA)} is ${formatNumber(amountA)}.`,
            `If ${fractionToText(numB, denB)} of a whole amount is ${formatNumber(amountB)}, find one part first.`,
            `That gives a whole amount of ${formatNumber(totalB)}.`
          ],
          checkLine: "One row works forwards from the whole; the other row works backwards from the fraction amount.",
          reflectionPrompt: "Did you notice that the two rows need different directions of thinking?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "amountA", label: `Fraction amount for ${formatNumber(totalA)}`, kind: "number" },
              { key: "totalB", label: `Whole amount for ${formatNumber(amountB)}`, kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const amountAAnswer = parseNumberInput(resp.amountA);
            const totalBAnswer = parseNumberInput(resp.totalB);
            let score = 0;
            if (amountAAnswer === amountA) score += 1;
            if (totalBAnswer === totalB) score += 1;
            const answerText = `Amount ${formatNumber(amountA)}; whole ${formatNumber(totalB)}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The missing values are ${formatNumber(amountA)} and ${formatNumber(totalB)}.`,
                answerText
              });
            }
            const misconception = score ? "skipped_step" : "fraction_misconception";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The missing values are ${formatNumber(amountA)} and ${formatNumber(totalB)}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "measure_length_total_target",
      label: "Length total and target",
      domain: "Measure",
      skillIds: ["unit_conversion", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const m = randInt(rng, 1, 4);
        const cm = pick(rng, [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95]);
        const extraCm = randInt(rng, 45, 190);
        const first = m * 100 + cm;
        const total = first + extraCm;
        const target = total + randInt(rng, 25, 140);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>One ribbon is <strong>${m} m ${cm} cm</strong> long.</p><p>Another ribbon is <strong>${extraCm} cm</strong> long.</p><p>How long are they <strong>altogether in cm</strong>, and how many more centimetres are needed to make <strong>${Math.floor(target / 100)} m ${target % 100} cm</strong>?</p>`,
          solutionLines: [
            `${m} m ${cm} cm = ${first} cm.`,
            `Altogether: ${first} + ${extraCm} = ${total} cm.`,
            `To reach ${target} cm, ${target} - ${total} = ${target - total} cm more are needed.`
          ],
          checkLine: "Convert to one unit before you add or compare.",
          reflectionPrompt: "Did you turn the metres into centimetres first?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "total", label: "Total length in cm", kind: "number" },
              { key: "need", label: "More centimetres needed", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const totalAnswer = parseNumberInput(resp.total);
            const needAnswer = parseNumberInput(resp.need);
            let score = 0;
            if (totalAnswer === total) score += 1;
            if (needAnswer === target - total) score += 1;
            const answerText = `Total ${total} cm; need ${target - total} cm`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The ribbons are ${total} cm altogether, so ${target - total} cm more are needed.`,
                answerText
              });
            }
            const misconception = totalAnswer === total || totalAnswer === first || needAnswer === total
              ? "skipped_step"
              : "unit_confusion";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The ribbons are ${total} cm altogether, so ${target - total} cm more are needed.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "measure_mass_compare",
      label: "Compare mass in mixed units",
      domain: "Measure",
      skillIds: ["unit_conversion"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const kgA = randInt(rng, 1, 4);
        const gA = pick(rng, [150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900]);
        const totalA = kgA * 1000 + gA;
        let totalB = totalA + pick(rng, [-650, -500, -350, -200, 200, 350, 500, 650]);
        if (totalB <= 500) totalB = totalA + 450;
        const heavier = totalA > totalB ? "A" : "B";
        const difference = Math.abs(totalA - totalB);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Parcel <strong>A</strong> weighs <strong>${kgA} kg ${gA} g</strong>.</p><p>Parcel <strong>B</strong> weighs <strong>${formatNumber(totalB)} g</strong>.</p><p>Which parcel is heavier, and by how many grams?</p>`,
          solutionLines: [
            `Convert parcel A to grams: ${kgA} kg ${gA} g = ${formatNumber(totalA)} g.`,
            `Compare ${formatNumber(totalA)} g with ${formatNumber(totalB)} g.`,
            `Parcel ${heavier} is heavier by ${formatNumber(difference)} g.`
          ],
          checkLine: "Both masses must be in grams before you compare them.",
          reflectionPrompt: "Did you compare the masses after converting parcel A into grams?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "heavier", label: "Heavier parcel", kind: "select", options: [["A", "A"], ["B", "B"]] },
              { key: "difference", label: "Difference in grams", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const differenceAnswer = parseNumberInput(resp.difference);
            let score = 0;
            if (resp.heavier === heavier) score += 1;
            if (differenceAnswer === difference) score += 1;
            const answerText = `Parcel ${heavier}; ${difference} g`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `Parcel ${heavier} is heavier by ${formatNumber(difference)} g.`,
                answerText
              });
            }
            const misconception = resp.heavier === heavier || differenceAnswer === totalA || differenceAnswer === totalB
              ? "skipped_step"
              : "unit_confusion";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `Parcel ${heavier} is heavier by ${formatNumber(difference)} g.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "measure_capacity_target",
      label: "Capacity total and amount needed",
      domain: "Measure",
      skillIds: ["unit_conversion", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const litres = randInt(rng, 1, 4);
        const ml = pick(rng, [100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900]);
        const extraMl = pick(rng, [150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900]);
        const current = litres * 1000 + ml + extraMl;
        const target = current + pick(rng, [250, 300, 350, 400, 450, 500, 650, 700, 800, 900, 1000, 1200]);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A tank already contains <strong>${litres} l ${ml} ml</strong> of water.</p><p>Then another <strong>${extraMl} ml</strong> is poured in.</p><p>How much water is in the tank <strong>now in ml</strong>, and how many more millilitres are needed to make <strong>${formatLitresMl(target)}</strong>?</p>`,
          solutionLines: [
            `${litres} l ${ml} ml = ${formatNumber(litres * 1000 + ml)} ml.`,
            `Now there are ${formatNumber(litres * 1000 + ml)} + ${extraMl} = ${formatNumber(current)} ml.`,
            `To make ${formatNumber(target)} ml, ${formatNumber(target)} - ${formatNumber(current)} = ${formatNumber(target - current)} ml are needed.`
          ],
          checkLine: "Convert the mixed amount to millilitres before adding or subtracting.",
          reflectionPrompt: "Did you include both the original amount and the extra millilitres before comparing with the target?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "current", label: "Water now in ml", kind: "number" },
              { key: "needed", label: "More ml needed", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const currentAnswer = parseNumberInput(resp.current);
            const neededAnswer = parseNumberInput(resp.needed);
            let score = 0;
            if (currentAnswer === current) score += 1;
            if (neededAnswer === target - current) score += 1;
            const answerText = `Now ${current} ml; need ${target - current} ml`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `There are ${formatNumber(current)} ml in the tank now, so ${formatNumber(target - current)} ml more are needed.`,
                answerText
              });
            }
            const misconception = currentAnswer === current || currentAnswer === litres * 1000 + ml || neededAnswer === current
              ? "skipped_step"
              : "unit_confusion";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `There are ${formatNumber(current)} ml in the tank now, so ${formatNumber(target - current)} ml more are needed.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "measure_conversion_error",
      label: "Error analysis: conversion in millilitres",
      domain: "Measure",
      skillIds: ["unit_conversion", "error_analysis"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const litres = randInt(rng, 1, 4);
        const ml = pick(rng, [150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900]);
        const extraMl = pick(rng, [200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900]);
        const correctBase = litres * 1000 + ml;
        const wrongBase = litres * 100 + ml;
        const total = correctBase + extraMl;
        const wrongTotal = wrongBase + extraMl;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `
            <p>A pupil says:</p>
            <div class="callout">“${litres} l ${ml} ml + ${extraMl} ml = ${formatNumber(wrongTotal)} ml because ${litres} l ${ml} ml = ${formatNumber(wrongBase)} ml.”</div>
            <p>Which mistake has the pupil made, and what is the correct total in millilitres?</p>`,
          solutionLines: [
            `${litres} l ${ml} ml = ${formatNumber(correctBase)} ml, not ${formatNumber(wrongBase)} ml.`,
            `Then add the extra ${extraMl} ml.`,
            `The correct total is ${formatNumber(total)} ml.`
          ],
          checkLine: "1 litre = 1,000 millilitres, not 100 millilitres.",
          reflectionPrompt: "Did you check the size of one litre before converting?",
          inputSpec: {
            type: "multi",
            fields: [
              {
                key: "reason",
                label: "Mistake",
                kind: "radio",
                options: [
                  ["litre", "They treated 1 litre as 100 millilitres instead of 1,000 millilitres."],
                  ["subtract", "They should have subtracted instead of adding."],
                  ["none", "There is no mistake."]
                ]
              },
              { key: "total", label: "Correct total in ml", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const totalAnswer = parseNumberInput(resp.total);
            let score = 0;
            if (resp.reason === "litre") score += 1;
            if (totalAnswer === total) score += 1;
            const answerText = `1 litre is 1,000 ml; total ${total} ml`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${litres} l ${ml} ml = ${formatNumber(correctBase)} ml, so the correct total is ${formatNumber(total)} ml.`,
                answerText
              });
            }
            const misconception = totalAnswer === correctBase ? "skipped_step" : "unit_confusion";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${litres} l ${ml} ml = ${formatNumber(correctBase)} ml, so the correct total is ${formatNumber(total)} ml.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "measure_start_and_break",
      label: "Start time and break time",
      domain: "Measure",
      skillIds: ["time_elapsed", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const beforeBreak = pick(rng, [35, 40, 45, 50, 55, 60, 65, 70]);
        const breakLength = pick(rng, [10, 15, 20, 25]);
        const afterBreak = pick(rng, [30, 35, 40, 45, 50, 55, 60]);
        const total = beforeBreak + breakLength + afterBreak;
        const endHour = randInt(rng, 12, 18);
        const endMin = pick(rng, [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
        const end = endHour * 60 + endMin;
        const start = end - total;
        if (start < 8 * 60) return this.generator(seed + 19);
        const breakStart = start + beforeBreak;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A workshop ends at <strong>${minutesToClock(end)}</strong>.</p><p>It runs for <strong>${formatDurationText(beforeBreak)}</strong>, then has a <strong>${breakLength}-minute</strong> break, then runs for another <strong>${formatDurationText(afterBreak)}</strong>.</p><p>What time did the workshop start, and what time did the break start?</p>`,
          solutionLines: [
            `The total workshop time is ${formatDurationText(total)}.`,
            `Count back ${formatDurationText(total)} from ${minutesToClock(end)} to get the start time ${minutesToClock(start)}.`,
            `Then add ${formatDurationText(beforeBreak)} to find the break start time ${minutesToClock(breakStart)}.`
          ],
          checkLine: "For reverse time problems, find the total duration first and then count back.",
          reflectionPrompt: "Did you work backwards from the end before finding the break start?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "start", label: "Start time", kind: "text", placeholder: "e.g. 09:40" },
              { key: "breakStart", label: "Break start time", kind: "text", placeholder: "e.g. 10:25" }
            ]
          },
          evaluate: (resp) => {
            const startAnswer = parseClockTime(resp.start);
            const breakAnswer = parseClockTime(resp.breakStart);
            let score = 0;
            if (startAnswer === start % (24 * 60)) score += 1;
            if (breakAnswer === breakStart % (24 * 60)) score += 1;
            const answerText = `Start ${minutesToClock(start)}; break ${minutesToClock(breakStart)}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The workshop starts at ${minutesToClock(start)}, and the break starts at ${minutesToClock(breakStart)}.`,
                answerText
              });
            }
            const misconception = score ? "skipped_step" : "misread_question";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The workshop starts at ${minutesToClock(start)}, and the break starts at ${minutesToClock(breakStart)}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "measure_connection_wait",
      label: "Connection wait and final arrival",
      domain: "Measure",
      skillIds: ["time_elapsed", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const departHour = randInt(rng, 8, 15);
        const departMin = pick(rng, [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
        const firstTravel = pick(rng, [25, 30, 35, 40, 45, 50, 55, 60, 65]);
        const wait = pick(rng, [10, 15, 20, 25, 30, 35]);
        const secondTravel = pick(rng, [20, 25, 30, 35, 40, 45, 50, 55]);
        const depart = departHour * 60 + departMin;
        const firstArrival = depart + firstTravel;
        const secondDepart = firstArrival + wait;
        const finalArrival = secondDepart + secondTravel;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A coach leaves at <strong>${minutesToClock(depart)}</strong> and reaches the station after <strong>${formatDurationText(firstTravel)}</strong>.</p><p>The connecting train leaves at <strong>${minutesToClock(secondDepart)}</strong> and takes <strong>${formatDurationText(secondTravel)}</strong>.</p><p>How long is the wait at the station, and what time is the final arrival?</p>`,
          solutionLines: [
            `The coach reaches the station at ${minutesToClock(firstArrival)}.`,
            `The wait is from ${minutesToClock(firstArrival)} to ${minutesToClock(secondDepart)}, which is ${wait} minutes.`,
            `The final arrival time is ${minutesToClock(finalArrival)}.`
          ],
          checkLine: "Work out the station arrival first so that the waiting time is visible.",
          reflectionPrompt: "Did you use the station arrival time before you added the train journey?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "wait", label: "Wait in minutes", kind: "number" },
              { key: "arrival", label: "Final arrival time", kind: "text", placeholder: "e.g. 11:20" }
            ]
          },
          evaluate: (resp) => {
            const waitAnswer = parseNumberInput(resp.wait);
            const arrivalAnswer = parseClockTime(resp.arrival);
            let score = 0;
            if (waitAnswer === wait) score += 1;
            if (arrivalAnswer === finalArrival % (24 * 60)) score += 1;
            const answerText = `Wait ${wait} minutes; arrive ${minutesToClock(finalArrival)}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The wait is ${wait} minutes, and the final arrival time is ${minutesToClock(finalArrival)}.`,
                answerText
              });
            }
            const withoutWait = firstArrival + secondTravel;
            const misconception = score || arrivalAnswer === withoutWait % (24 * 60) ? "skipped_step" : "misread_question";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The wait is ${wait} minutes, and the final arrival time is ${minutesToClock(finalArrival)}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "measure_total_away",
      label: "Total time away and home arrival",
      domain: "Measure",
      skillIds: ["time_elapsed", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const startHour = randInt(rng, 8, 14);
        const startMin = pick(rng, [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
        const outward = pick(rng, [20, 25, 30, 35, 40, 45, 50, 55]);
        const stay = pick(rng, [35, 40, 45, 50, 55, 60, 65, 70]);
        const returnJourney = pick(rng, [25, 30, 35, 40, 45, 50, 55, 60]);
        const start = startHour * 60 + startMin;
        const totalAway = outward + stay + returnJourney;
        const home = start + totalAway;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A family leaves home at <strong>${minutesToClock(start)}</strong>.</p><p>The journey to the museum takes <strong>${formatDurationText(outward)}</strong>.</p><p>They stay there for <strong>${formatDurationText(stay)}</strong>.</p><p>The journey home takes <strong>${formatDurationText(returnJourney)}</strong>.</p><p>How long are they away from home altogether, and what time do they get home?</p>`,
          solutionLines: [
            `Total time away = ${outward} + ${stay} + ${returnJourney} = ${totalAway} minutes.`,
            `That is ${formatDurationText(totalAway)}.`,
            `Starting at ${minutesToClock(start)}, they get home at ${minutesToClock(home)}.`
          ],
          checkLine: "Add all the parts of the outing before finding the home time.",
          reflectionPrompt: "Did you include the time spent at the museum as well as both journeys?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "away", label: "Total time away in minutes", kind: "number" },
              { key: "home", label: "Home time", kind: "text", placeholder: "e.g. 14:35" }
            ]
          },
          evaluate: (resp) => {
            const awayAnswer = parseNumberInput(resp.away);
            const homeAnswer = parseClockTime(resp.home);
            let score = 0;
            if (awayAnswer === totalAway) score += 1;
            if (homeAnswer === home % (24 * 60)) score += 1;
            const answerText = `Away ${totalAway} minutes; home ${minutesToClock(home)}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `They are away for ${totalAway} minutes and get home at ${minutesToClock(home)}.`,
                answerText
              });
            }
            const withoutStay = outward + returnJourney;
            const misconception = score || awayAnswer === withoutStay || homeAnswer === (start + withoutStay) % (24 * 60)
              ? "skipped_step"
              : "misread_question";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `They are away for ${totalAway} minutes and get home at ${minutesToClock(home)}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "measure_time_table_dual",
      label: "Time table forward and backward",
      domain: "Measure",
      skillIds: ["time_elapsed"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const startA = (randInt(rng, 8, 12) * 60) + pick(rng, [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
        const durationA = pick(rng, [25, 30, 35, 40, 45, 50, 55, 60, 65, 70]);
        const endA = startA + durationA;
        const startB = (randInt(rng, 11, 16) * 60) + pick(rng, [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
        const durationB = pick(rng, [35, 40, 45, 50, 55, 60, 65, 70, 75]);
        const endB = startB + durationB;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Complete the table.</p>`,
          visualHtml: tableHtml(
            ["Start", "Duration", "End"],
            [
              [minutesToClock(startA), formatDurationText(durationA), "?"],
              ["?", formatDurationText(durationB), minutesToClock(endB)]
            ]
          ),
          solutionLines: [
            `Add ${formatDurationText(durationA)} to ${minutesToClock(startA)} to get ${minutesToClock(endA)}.`,
            `Count back ${formatDurationText(durationB)} from ${minutesToClock(endB)} to get ${minutesToClock(startB)}.`,
            `The missing times are ${minutesToClock(endA)} and ${minutesToClock(startB)}.`
          ],
          checkLine: "One row needs a forward step; the other row needs a backward step.",
          reflectionPrompt: "Did you notice that the two rows need opposite directions of thinking?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "endA", label: `End time for ${minutesToClock(startA)}`, kind: "text", placeholder: "e.g. 10:15" },
              { key: "startB", label: `Start time for ${minutesToClock(endB)}`, kind: "text", placeholder: "e.g. 12:40" }
            ]
          },
          evaluate: (resp) => {
            const endAAnswer = parseClockTime(resp.endA);
            const startBAnswer = parseClockTime(resp.startB);
            let score = 0;
            if (endAAnswer === endA % (24 * 60)) score += 1;
            if (startBAnswer === startB % (24 * 60)) score += 1;
            const answerText = `End ${minutesToClock(endA)}; start ${minutesToClock(startB)}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The missing times are ${minutesToClock(endA)} and ${minutesToClock(startB)}.`,
                answerText
              });
            }
            const misconception = score ? "skipped_step" : "misread_question";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The missing times are ${minutesToClock(endA)} and ${minutesToClock(startB)}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "gm_area_to_perimeter",
      label: "Area to perimeter",
      domain: "Geometry and measure",
      skillIds: ["perimeter_area", "inverse_missing"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const shownSide = randInt(rng, 4, 12);
        const otherSide = randInt(rng, 3, 10);
        const area = shownSide * otherSide;
        const perimeter = 2 * (shownSide + otherSide);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A rectangle has area <strong>${area} cm²</strong>.</p><p>One side is <strong>${shownSide} cm</strong>.</p><p>What is the missing side length, and what is the perimeter?</p>`,
          solutionLines: [
            `The missing side is ${area} ÷ ${shownSide} = ${otherSide} cm.`,
            `Perimeter = 2 × (${shownSide} + ${otherSide}) = ${perimeter} cm.`
          ],
          checkLine: "Use the area to find the unknown side before you work out the perimeter.",
          reflectionPrompt: "Did you divide the area by the known side first?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "side", label: "Missing side in cm", kind: "number" },
              { key: "perimeter", label: "Perimeter in cm", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const sideAnswer = parseNumberInput(resp.side);
            const perimeterAnswer = parseNumberInput(resp.perimeter);
            let score = 0;
            if (sideAnswer === otherSide) score += 1;
            if (perimeterAnswer === perimeter) score += 1;
            const answerText = `Side ${otherSide} cm; perimeter ${perimeter} cm`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The missing side is ${otherSide} cm, so the perimeter is ${perimeter} cm.`,
                answerText
              });
            }
            const misconception = sideAnswer === otherSide || perimeterAnswer === 2 * shownSide + otherSide
              ? "skipped_step"
              : (sideAnswer === area || perimeterAnswer === area ? "area_perimeter_confusion" : "inverse_error");
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The missing side is ${otherSide} cm, so the perimeter is ${perimeter} cm.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "gm_same_perimeter_compare_area",
      label: "Compare areas with the same perimeter",
      domain: "Geometry and measure",
      skillIds: ["perimeter_area"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const pairs = [
          { a: [8, 4], b: [7, 5] },
          { a: [9, 3], b: [6, 6] },
          { a: [10, 4], b: [8, 6] },
          { a: [11, 5], b: [9, 7] },
          { a: [12, 4], b: [10, 6] }
        ];
        const chosen = pick(rng, pairs);
        const [lengthA, widthA] = chosen.a;
        const [lengthB, widthB] = chosen.b;
        const areaA = lengthA * widthA;
        const areaB = lengthB * widthB;
        const larger = areaA > areaB ? "A" : "B";
        const difference = Math.abs(areaA - areaB);
        const perimeter = 2 * (lengthA + widthA);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Rectangle <strong>A</strong> is <strong>${lengthA} cm</strong> by <strong>${widthA} cm</strong>.</p><p>Rectangle <strong>B</strong> is <strong>${lengthB} cm</strong> by <strong>${widthB} cm</strong>.</p><p>Both rectangles have the same perimeter of <strong>${perimeter} cm</strong>.</p><p>Which rectangle has the larger area, and by how many square centimetres?</p>`,
          solutionLines: [
            `Area of A = ${lengthA} × ${widthA} = ${areaA} cm².`,
            `Area of B = ${lengthB} × ${widthB} = ${areaB} cm².`,
            `Rectangle ${larger} has the larger area by ${difference} cm².`
          ],
          checkLine: "The perimeter being the same does not mean the areas are the same.",
          reflectionPrompt: "Did you calculate both areas before comparing them?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "which", label: "Larger area", kind: "radio", options: [["A", "Rectangle A"], ["B", "Rectangle B"]] },
              { key: "difference", label: "Difference in cm²", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const differenceAnswer = parseNumberInput(resp.difference);
            let score = 0;
            if (resp.which === larger) score += 1;
            if (differenceAnswer === difference) score += 1;
            const answerText = `Rectangle ${larger}; ${difference} cm²`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `Rectangle ${larger} has the larger area by ${difference} cm².`,
                answerText
              });
            }
            const misconception = resp.which === larger || differenceAnswer === areaA || differenceAnswer === areaB
              ? "skipped_step"
              : "area_perimeter_confusion";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `Rectangle ${larger} has the larger area by ${difference} cm².`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "gm_composite_area_total",
      label: "Composite area from two rectangles",
      domain: "Geometry and measure",
      skillIds: ["perimeter_area"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const mainLength = randInt(rng, 6, 12);
        const mainWidth = randInt(rng, 4, 8);
        const extraLength = randInt(rng, 2, 6);
        const extraWidth = randInt(rng, 2, 5);
        const extraArea = extraLength * extraWidth;
        const totalArea = mainLength * mainWidth + extraArea;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A patio is made from two rectangles joined together.</p><p>Work out the area of the small section and the total area of the patio.</p>`,
          visualHtml: tableHtml(
            ["Section", "Length", "Width"],
            [
              ["Main rectangle", `${mainLength} m`, `${mainWidth} m`],
              ["Small section", `${extraLength} m`, `${extraWidth} m`]
            ]
          ),
          solutionLines: [
            `Area of the small section = ${extraLength} × ${extraWidth} = ${extraArea} m².`,
            `Area of the main rectangle = ${mainLength} × ${mainWidth} = ${mainLength * mainWidth} m².`,
            `Total area = ${mainLength * mainWidth} + ${extraArea} = ${totalArea} m².`
          ],
          checkLine: "Find the area of each rectangle separately before you add them.",
          reflectionPrompt: "Did you include both rectangles in the total?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "extraArea", label: "Small section area in m²", kind: "number" },
              { key: "totalArea", label: "Total area in m²", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const extraAnswer = parseNumberInput(resp.extraArea);
            const totalAnswer = parseNumberInput(resp.totalArea);
            let score = 0;
            if (extraAnswer === extraArea) score += 1;
            if (totalAnswer === totalArea) score += 1;
            const answerText = `Small section ${extraArea} m²; total ${totalArea} m²`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The small section is ${extraArea} m², so the total area is ${totalArea} m².`,
                answerText
              });
            }
            const misconception = extraAnswer === extraArea || totalAnswer === mainLength * mainWidth
              ? "skipped_step"
              : "area_perimeter_confusion";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The small section is ${extraArea} m², so the total area is ${totalArea} m².`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "gm_joined_rectangles_perimeter",
      label: "Perimeter of joined rectangles",
      domain: "Geometry and measure",
      skillIds: ["perimeter_area", "inverse_missing"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const mainLength = randInt(rng, 7, 12);
        const mainWidth = randInt(rng, 6, 10);
        const smallLength = randInt(rng, 2, 6);
        const sharedEdge = randInt(rng, 3, mainWidth - 1);
        const separatePerimeter = 2 * (mainLength + mainWidth) + 2 * (smallLength + sharedEdge);
        const perimeter = 2 * (mainLength + mainWidth) + 2 * (smallLength + sharedEdge) - 2 * sharedEdge;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A building is made by joining two rectangles.</p><p>The main room is <strong>${mainLength} m</strong> by <strong>${mainWidth} m</strong>.</p><p>A smaller room is <strong>${smallLength} m</strong> by <strong>${sharedEdge} m</strong>, attached along one full side.</p><p>What is the total perimeter if you count the two rooms separately, and what is the correct outer perimeter of the whole building?</p>`,
          solutionLines: [
            `The shared wall is ${sharedEdge} m long.`,
            `Perimeter of the two rooms separately is ${2 * (mainLength + mainWidth)} m + ${2 * (smallLength + sharedEdge)} m = ${separatePerimeter} m.`,
            `Subtract the shared wall twice: outer perimeter = ${perimeter} m.`
          ],
          checkLine: "A shared edge is inside the shape, so it should not be counted on the outside.",
          reflectionPrompt: "Did you remove the shared wall from the outside perimeter?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "separate", label: "Perimeter of the two rooms separately in m", kind: "number" },
              { key: "perimeter", label: "Outer perimeter in m", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const separateAnswer = parseNumberInput(resp.separate);
            const perimeterAnswer = parseNumberInput(resp.perimeter);
            let score = 0;
            if (separateAnswer === separatePerimeter) score += 1;
            if (perimeterAnswer === perimeter) score += 1;
            const answerText = `Separate perimeter ${separatePerimeter} m; outer perimeter ${perimeter} m`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The two rooms separately give ${separatePerimeter} m, so the correct outer perimeter is ${perimeter} m.`,
                answerText
              });
            }
            const misconception = separateAnswer === separatePerimeter || perimeterAnswer === separatePerimeter
              ? "skipped_step"
              : "inverse_error";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The two rooms separately give ${separatePerimeter} m, so the correct outer perimeter is ${perimeter} m.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "gm_table_perimeter_area",
      label: "Perimeter and area table",
      domain: "Geometry and measure",
      skillIds: ["perimeter_area", "inverse_missing"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const lengthA = randInt(rng, 6, 12);
        const widthA = randInt(rng, 3, 8);
        const perimeterA = 2 * (lengthA + widthA);
        const lengthB = randInt(rng, 4, 10);
        const widthB = randInt(rng, 3, 8);
        const areaB = lengthB * widthB;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Complete the missing values in the table.</p>`,
          visualHtml: tableHtml(
            ["Rectangle", "Length", "Width", "Perimeter", "Area"],
            [
              ["A", `${lengthA} cm`, `${widthA} cm`, "?", `${lengthA * widthA} cm²`],
              ["B", `${lengthB} cm`, "?", "?", `${areaB} cm²`]
            ]
          ),
          solutionLines: [
            `Rectangle A has perimeter 2 × (${lengthA} + ${widthA}) = ${perimeterA} cm.`,
            `Rectangle B has width ${areaB} ÷ ${lengthB} = ${widthB} cm.`,
            `The missing values are ${perimeterA} cm and ${widthB} cm.`
          ],
          checkLine: "One row needs perimeter. The other row needs an unknown side from the area.",
          reflectionPrompt: "Did you notice that the two rows need different methods?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "perimeterA", label: "Perimeter of A in cm", kind: "number" },
              { key: "widthB", label: "Width of B in cm", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const perimeterAnswer = parseNumberInput(resp.perimeterA);
            const widthAnswer = parseNumberInput(resp.widthB);
            let score = 0;
            if (perimeterAnswer === perimeterA) score += 1;
            if (widthAnswer === widthB) score += 1;
            const answerText = `Perimeter of A ${perimeterA} cm; width of B ${widthB} cm`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `Rectangle A has perimeter ${perimeterA} cm and rectangle B has width ${widthB} cm.`,
                answerText
              });
            }
            const misconception = widthAnswer === widthB
              ? "skipped_step"
              : (perimeterAnswer === lengthA * widthA ? "area_perimeter_confusion" : "inverse_error");
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `Rectangle A has perimeter ${perimeterA} cm and rectangle B has width ${widthB} cm.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "gm_square_from_perimeter",
      label: "Square from the same perimeter",
      domain: "Geometry and measure",
      skillIds: ["perimeter_area", "inverse_missing"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const pairs = [
          [8, 4],
          [9, 5],
          [10, 6],
          [11, 7],
          [12, 4],
          [13, 5]
        ];
        const [length, width] = pick(rng, pairs);
        const perimeter = 2 * (length + width);
        const squareSide = perimeter / 4;
        const squareArea = squareSide * squareSide;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A rectangle measures <strong>${length} cm</strong> by <strong>${width} cm</strong>.</p><p>A square has the same perimeter as the rectangle.</p><p>What is the side length of the square, and what is its area?</p>`,
          solutionLines: [
            `Perimeter of the rectangle = 2 × (${length} + ${width}) = ${perimeter} cm.`,
            `Each side of the square is ${perimeter} ÷ 4 = ${squareSide} cm.`,
            `Area of the square = ${squareSide} × ${squareSide} = ${squareArea} cm².`
          ],
          checkLine: "Find the perimeter first, then share it equally between the four sides of the square.",
          reflectionPrompt: "Did you turn the rectangle into a perimeter before thinking about the square?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "side", label: "Square side in cm", kind: "number" },
              { key: "area", label: "Square area in cm²", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const sideAnswer = parseNumberInput(resp.side);
            const areaAnswer = parseNumberInput(resp.area);
            let score = 0;
            if (sideAnswer === squareSide) score += 1;
            if (areaAnswer === squareArea) score += 1;
            const answerText = `Square side ${squareSide} cm; area ${squareArea} cm²`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The square side is ${squareSide} cm, so the area is ${squareArea} cm².`,
                answerText
              });
            }
            const misconception = sideAnswer === squareSide
              ? "skipped_step"
              : (areaAnswer === perimeter ? "area_perimeter_confusion" : "inverse_error");
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The square side is ${squareSide} cm, so the area is ${squareArea} cm².`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "gm_area_error_add_sides",
      label: "Error analysis: adding sides for area",
      domain: "Geometry and measure",
      skillIds: ["perimeter_area", "error_analysis"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const length = randInt(rng, 6, 12);
        const width = randInt(rng, 3, 8);
        const wrong = length + width;
        const area = length * width;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `
            <p>A pupil says:</p>
            <div class="callout">“The area of a rectangle that is <strong>${length} cm</strong> by <strong>${width} cm</strong> is <strong>${wrong} cm²</strong> because ${length} + ${width} = ${wrong}.”</div>
            <p>Which mistake has the pupil made, and what is the correct area?</p>`,
          solutionLines: [
            `The pupil added the side lengths instead of multiplying them.`,
            `Area of a rectangle = length × width.`,
            `${length} × ${width} = ${area} cm².`
          ],
          checkLine: "Area uses multiplication of the side lengths, not addition.",
          reflectionPrompt: "Did you separate the rule for area from the rule for perimeter?",
          inputSpec: {
            type: "multi",
            fields: [
              {
                key: "reason",
                label: "Mistake",
                kind: "radio",
                options: [
                  ["add", "They added the side lengths instead of multiplying them."],
                  ["perimeter", "They found the perimeter instead."],
                  ["units", "They only used the wrong units."]
                ]
              },
              { key: "area", label: "Correct area in cm²", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const areaAnswer = parseNumberInput(resp.area);
            let score = 0;
            if (resp.reason === "add") score += 1;
            if (areaAnswer === area) score += 1;
            const answerText = `Added sides instead of multiplying; area ${area} cm²`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The pupil added the sides. The correct area is ${area} cm².`,
                answerText
              });
            }
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception: "area_perimeter_confusion",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The pupil added the sides. The correct area is ${area} cm².`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "gm_scaled_rectangle",
      label: "Scaled rectangle perimeter and area",
      domain: "Geometry and measure",
      skillIds: ["perimeter_area"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const length = randInt(rng, 4, 10);
        const width = randInt(rng, 3, 8);
        const factor = pick(rng, [2, 3]);
        const newLength = length * factor;
        const newWidth = width * factor;
        const newPerimeter = 2 * (newLength + newWidth);
        const oldArea = length * width;
        const newArea = newLength * newWidth;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A rectangle measures <strong>${length} cm</strong> by <strong>${width} cm</strong>.</p><p>A larger similar rectangle is made with every side <strong>${factor}</strong> times as long.</p><p>What is the new perimeter, and what is the new area?</p>`,
          solutionLines: [
            `The new side lengths are ${newLength} cm and ${newWidth} cm.`,
            `New perimeter = 2 × (${newLength} + ${newWidth}) = ${newPerimeter} cm.`,
            `New area = ${newLength} × ${newWidth} = ${newArea} cm².`
          ],
          checkLine: "Perimeter and area do not scale in the same way.",
          reflectionPrompt: "Did you resize both side lengths before working out the new perimeter and area?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "perimeter", label: "New perimeter in cm", kind: "number" },
              { key: "area", label: "New area in cm²", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const perimeterAnswer = parseNumberInput(resp.perimeter);
            const areaAnswer = parseNumberInput(resp.area);
            let score = 0;
            if (perimeterAnswer === newPerimeter) score += 1;
            if (areaAnswer === newArea) score += 1;
            const answerText = `Perimeter ${newPerimeter} cm; area ${newArea} cm²`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The new perimeter is ${newPerimeter} cm and the new area is ${newArea} cm².`,
                answerText
              });
            }
            const misconception = areaAnswer === oldArea * factor || perimeterAnswer === 2 * (length + width)
              ? "scaling_confusion"
              : "area_perimeter_confusion";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The new perimeter is ${newPerimeter} cm and the new area is ${newArea} cm².`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "geom_straight_line_difference",
      label: "Straight line and right-angle difference",
      domain: "Geometry",
      skillIds: ["geometry_angles"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const given = pick(rng, [35, 40, 45, 50, 55, 60, 65, 70, 75]);
        const missing = 180 - given;
        const biggerThanRight = missing - 90;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Two angles make a straight line.</p><p>One angle is <strong>${given}°</strong>.</p><p>What is the missing angle, and how many degrees bigger is it than a right angle?</p>`,
          solutionLines: [
            `Angles on a straight line add to 180°.`,
            `Missing angle = 180° - ${given}° = ${missing}°.`,
            `${missing}° is ${biggerThanRight}° bigger than 90°.`
          ],
          checkLine: "Use 180° for a straight line, then compare with 90°.",
          reflectionPrompt: "Did you use the straight-line total before comparing with a right angle?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "missing", label: "Missing angle", kind: "number" },
              { key: "difference", label: "Degrees bigger than a right angle", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const missingAnswer = parseNumberInput(resp.missing);
            const differenceAnswer = parseNumberInput(resp.difference);
            let score = 0;
            if (missingAnswer === missing) score += 1;
            if (differenceAnswer === biggerThanRight) score += 1;
            const answerText = `Missing angle ${missing}°; ${biggerThanRight}° bigger than a right angle`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The missing angle is ${missing}°, which is ${biggerThanRight}° bigger than a right angle.`,
                answerText
              });
            }
            const misconception = missingAnswer === 360 - given || differenceAnswer === missing
              ? "angle_total_confusion"
              : "skipped_step";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The missing angle is ${missing}°, which is ${biggerThanRight}° bigger than a right angle.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "geom_crossing_lines_pair",
      label: "Crossing lines: opposite and adjacent",
      domain: "Geometry",
      skillIds: ["geometry_angles"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const given = pick(rng, [35, 40, 45, 50, 55, 60, 65, 70, 75, 80]);
        const opposite = given;
        const adjacent = 180 - given;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Two straight lines cross.</p><p>One of the angles is <strong>${given}°</strong>.</p><p>What is the vertically opposite angle, and what is the size of an adjacent angle?</p>`,
          solutionLines: [
            `Vertically opposite angles are equal, so the opposite angle is ${opposite}°.`,
            `Adjacent angles on a straight line add to 180°, so the adjacent angle is ${adjacent}°.`
          ],
          checkLine: "Opposite angles are equal. Adjacent angles on a straight line total 180°.",
          reflectionPrompt: "Did you use two different angle facts for the two answers?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "opposite", label: "Vertically opposite angle", kind: "number" },
              { key: "adjacent", label: "Adjacent angle", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const oppositeAnswer = parseNumberInput(resp.opposite);
            const adjacentAnswer = parseNumberInput(resp.adjacent);
            let score = 0;
            if (oppositeAnswer === opposite) score += 1;
            if (adjacentAnswer === adjacent) score += 1;
            const answerText = `Opposite ${opposite}°; adjacent ${adjacent}°`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The vertically opposite angle is ${opposite}° and an adjacent angle is ${adjacent}°.`,
                answerText
              });
            }
            const misconception = oppositeAnswer === adjacent || adjacentAnswer === opposite
              ? "angle_total_confusion"
              : "skipped_step";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The vertically opposite angle is ${opposite}° and an adjacent angle is ${adjacent}°.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "geom_right_angle_three_parts",
      label: "Right angle split into three parts",
      domain: "Geometry",
      skillIds: ["geometry_angles"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const options = [
          [15, 20],
          [15, 25],
          [20, 25],
          [20, 30],
          [25, 30],
          [25, 35]
        ];
        const [a, b] = pick(rng, options);
        const missing = 90 - a - b;
        const twoSmallest = [a, b, missing].sort((x, y) => x - y).slice(0, 2).reduce((sum, value) => sum + value, 0);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A right angle is split into three smaller angles.</p><p>Two of the angles are <strong>${a}°</strong> and <strong>${b}°</strong>.</p><p>What is the missing angle, and what do the two smallest angles add to?</p>`,
          solutionLines: [
            `Angles in a right angle add to 90°.`,
            `Missing angle = 90° - ${a}° - ${b}° = ${missing}°.`,
            `The two smallest angles add to ${twoSmallest}°.`
          ],
          checkLine: "Use 90° for the whole corner, then compare the three parts.",
          reflectionPrompt: "Did you find the missing part before choosing the two smallest angles?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "missing", label: "Missing angle", kind: "number" },
              { key: "smallTotal", label: "Total of the two smallest angles", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const missingAnswer = parseNumberInput(resp.missing);
            const smallTotalAnswer = parseNumberInput(resp.smallTotal);
            let score = 0;
            if (missingAnswer === missing) score += 1;
            if (smallTotalAnswer === twoSmallest) score += 1;
            const answerText = `Missing angle ${missing}°; two smallest total ${twoSmallest}°`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The missing angle is ${missing}°, and the two smallest angles add to ${twoSmallest}°.`,
                answerText
              });
            }
            const misconception = missingAnswer === 180 - a - b
              ? "angle_total_confusion"
              : "skipped_step";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The missing angle is ${missing}°, and the two smallest angles add to ${twoSmallest}°.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "geom_triangle_missing_type",
      label: "Triangle missing angle and type",
      domain: "Geometry",
      skillIds: ["geometry_angles"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const cases = [
          { a: 50, b: 60 },
          { a: 35, b: 55 },
          { a: 30, b: 35 },
          { a: 40, b: 70 },
          { a: 45, b: 45 },
          { a: 25, b: 65 }
        ];
        const chosen = pick(rng, cases);
        const a = chosen.a;
        const b = chosen.b;
        const missing = 180 - a - b;
        const type = angleTypeName(Math.max(a, b, missing));
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A triangle has angles <strong>${a}°</strong> and <strong>${b}°</strong>.</p><p>What is the missing angle, and what type of triangle is it: acute-angled, right-angled or obtuse-angled?</p>`,
          solutionLines: [
            `Angles in a triangle add to 180°.`,
            `Missing angle = 180° - ${a}° - ${b}° = ${missing}°.`,
            `The largest angle is ${Math.max(a, b, missing)}°, so the triangle is ${type}.`
          ],
          checkLine: "Find the third angle first, then decide the triangle type from the largest angle.",
          reflectionPrompt: "Did you classify the triangle after all three angles were known?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "missing", label: "Missing angle", kind: "number" },
              {
                key: "type",
                label: "Triangle type",
                kind: "radio",
                options: [
                  ["acute-angled", "Acute-angled"],
                  ["right-angled", "Right-angled"],
                  ["obtuse-angled", "Obtuse-angled"]
                ]
              }
            ]
          },
          evaluate: (resp) => {
            const missingAnswer = parseNumberInput(resp.missing);
            let score = 0;
            if (missingAnswer === missing) score += 1;
            if (resp.type === type) score += 1;
            const answerText = `Missing angle ${missing}°; ${type}`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The missing angle is ${missing}°, so the triangle is ${type}.`,
                answerText
              });
            }
            const misconception = missingAnswer === 360 - a - b
              ? "angle_total_confusion"
              : "skipped_step";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The missing angle is ${missing}°, so the triangle is ${type}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "geom_isosceles_base_angles",
      label: "Isosceles triangle base angles",
      domain: "Geometry",
      skillIds: ["geometry_angles"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const apex = pick(rng, [30, 40, 50, 60, 70, 80, 100]);
        const baseAngle = (180 - apex) / 2;
        const pairTotal = 180 - apex;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>An isosceles triangle has one angle of <strong>${apex}°</strong>.</p><p>The other two angles are equal.</p><p>What is the size of each equal angle, and what do the two equal angles add to?</p>`,
          solutionLines: [
            `The two equal angles add to 180° - ${apex}° = ${pairTotal}°.`,
            `Each equal angle is ${pairTotal}° ÷ 2 = ${baseAngle}°.`
          ],
          checkLine: "Take the apex angle away from 180° before sharing the rest equally.",
          reflectionPrompt: "Did you split the remaining angle total equally between the two base angles?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "baseAngle", label: "Each equal angle", kind: "number" },
              { key: "pairTotal", label: "Total of the two equal angles", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const baseAngleAnswer = parseNumberInput(resp.baseAngle);
            const pairTotalAnswer = parseNumberInput(resp.pairTotal);
            let score = 0;
            if (baseAngleAnswer === baseAngle) score += 1;
            if (pairTotalAnswer === pairTotal) score += 1;
            const answerText = `Each equal angle ${baseAngle}°; pair total ${pairTotal}°`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `Each equal angle is ${baseAngle}°, so together they add to ${pairTotal}°.`,
                answerText
              });
            }
            const misconception = baseAngleAnswer === pairTotal || pairTotalAnswer === baseAngle
              ? "inverse_error"
              : "skipped_step";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `Each equal angle is ${baseAngle}°, so together they add to ${pairTotal}°.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "geom_quadrilateral_missing_compare",
      label: "Quadrilateral missing angle",
      domain: "Geometry",
      skillIds: ["geometry_angles"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const cases = [
          [75, 85, 95],
          [80, 85, 95],
          [65, 95, 105],
          [70, 110, 85],
          [60, 95, 105]
        ];
        const [a, b, c] = pick(rng, cases);
        const missing = 360 - a - b - c;
        const moreThanRight = missing - 90;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A quadrilateral has angles <strong>${a}°</strong>, <strong>${b}°</strong> and <strong>${c}°</strong>.</p><p>What is the missing angle, and how many degrees more than a right angle is it?</p>`,
          solutionLines: [
            `Angles in a quadrilateral add to 360°.`,
            `Missing angle = 360° - ${a}° - ${b}° - ${c}° = ${missing}°.`,
            `${missing}° is ${moreThanRight}° more than 90°.`
          ],
          checkLine: "A quadrilateral uses a total of 360°, not 180°.",
          reflectionPrompt: "Did you use the quadrilateral total before comparing with a right angle?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "missing", label: "Missing angle", kind: "number" },
              { key: "difference", label: "Degrees more than a right angle", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const missingAnswer = parseNumberInput(resp.missing);
            const differenceAnswer = parseNumberInput(resp.difference);
            let score = 0;
            if (missingAnswer === missing) score += 1;
            if (differenceAnswer === moreThanRight) score += 1;
            const answerText = `Missing angle ${missing}°; ${moreThanRight}° more than a right angle`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The missing angle is ${missing}°, which is ${moreThanRight}° more than a right angle.`,
                answerText
              });
            }
            const misconception = missingAnswer === 180 - a - b - c
              ? "angle_total_confusion"
              : "skipped_step";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The missing angle is ${missing}°, which is ${moreThanRight}° more than a right angle.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "geom_angle_table_mixed",
      label: "Angle table with mixed facts",
      domain: "Geometry",
      skillIds: ["geometry_angles"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const straightGiven = pick(rng, [105, 110, 115, 120, 125, 130, 135]);
        const straightMissing = 180 - straightGiven;
        const aroundKnownA = pick(rng, [50, 60, 70, 80]);
        const aroundKnownB = pick(rng, [65, 75, 85, 95].filter(value => value + aroundKnownA < 250));
        const aroundMissing = 360 - aroundKnownA - aroundKnownB - 90;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Complete the two missing angles in the table.</p>`,
          visualHtml: tableHtml(
            ["Situation", "Known angles", "Missing angle"],
            [
              ["Straight line", `${straightGiven}° and ?`, "?"],
              ["Around a point", `${aroundKnownA}°, ${aroundKnownB}°, 90° and ?`, "?"]
            ]
          ),
          solutionLines: [
            `Straight line missing angle = 180° - ${straightGiven}° = ${straightMissing}°.`,
            `Around a point missing angle = 360° - ${aroundKnownA}° - ${aroundKnownB}° - 90° = ${aroundMissing}°.`
          ],
          checkLine: "One row totals 180°. The other row totals 360°.",
          reflectionPrompt: "Did you match the correct total to each row?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "straight", label: "Missing angle on the straight line", kind: "number" },
              { key: "around", label: "Missing angle around the point", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const straightAnswer = parseNumberInput(resp.straight);
            const aroundAnswer = parseNumberInput(resp.around);
            let score = 0;
            if (straightAnswer === straightMissing) score += 1;
            if (aroundAnswer === aroundMissing) score += 1;
            const answerText = `Straight line ${straightMissing}°; around a point ${aroundMissing}°`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The missing angles are ${straightMissing}° and ${aroundMissing}°.`,
                answerText
              });
            }
            const misconception = straightAnswer === aroundMissing || aroundAnswer === straightMissing
              ? "angle_total_confusion"
              : "skipped_step";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The missing angles are ${straightMissing}° and ${aroundMissing}°.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "geom_angle_error_analysis",
      label: "Error analysis: wrong angle total",
      domain: "Geometry",
      skillIds: ["geometry_angles", "error_analysis"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const a = pick(rng, [20, 25, 30, 35]);
        const b = pick(rng, [20, 25, 30, 35, 40].filter(value => value + a < 90));
        const correct = 360 - a - b - 90;
        const wrong = 180 - a - b - 90;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `
            <p>A pupil says:</p>
            <div class="callout">“The missing angle is <strong>${wrong}°</strong> because ${a}° + ${b}° + 90° + ? = 180°.”</div>
            <p>Which mistake has the pupil made, and what is the correct missing angle?</p>`,
          solutionLines: [
            `The pupil used 180°, but these angles are around a point so they should add to 360°.`,
            `Correct missing angle = 360° - ${a}° - ${b}° - 90° = ${correct}°.`
          ],
          checkLine: "Choose the total that matches the diagram or description before subtracting.",
          reflectionPrompt: "Did you check whether the angles were on a line or around a point?",
          inputSpec: {
            type: "multi",
            fields: [
              {
                key: "reason",
                label: "Mistake",
                kind: "radio",
                options: [
                  ["total", "They used 180° instead of 360°."],
                  ["subtract", "They should have added instead of subtracting."],
                  ["none", "There is no mistake."]
                ]
              },
              { key: "angle", label: "Correct missing angle", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const angleAnswer = parseNumberInput(resp.angle);
            let score = 0;
            if (resp.reason === "total") score += 1;
            if (angleAnswer === correct) score += 1;
            const answerText = `Used 180° instead of 360°; correct angle ${correct}°`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The pupil used the wrong total. The correct missing angle is ${correct}°.`,
                answerText
              });
            }
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception: "angle_total_confusion",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The pupil used the wrong total. The correct missing angle is ${correct}°.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "geom_fraction_turns_total",
      label: "Fraction turns to degrees",
      domain: "Geometry",
      skillIds: ["geometry_angles"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const [first, second] = pick(rng, [
          [1, 1],
          [1, 2],
          [2, 1]
        ]);
        const totalDegrees = (first + second) * 90;
        const remaining = 360 - totalDegrees;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A robot makes a <strong>${turnPhrase(first)}</strong>, then a <strong>${turnPhrase(second)}</strong>.</p><p>How many degrees has it turned altogether, and how many more degrees would make a full turn?</p>`,
          solutionLines: [
            `${turnPhrase(first)} = ${first * 90}° and ${turnPhrase(second)} = ${second * 90}°.`,
            `Total turn = ${first * 90}° + ${second * 90}° = ${totalDegrees}°.`,
            `A full turn is 360°, so ${remaining}° more are needed.`
          ],
          checkLine: "Convert each fraction of a turn into degrees before adding.",
          reflectionPrompt: "Did you compare the total turn with 360° at the end?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "total", label: "Total turn in degrees", kind: "number" },
              { key: "remaining", label: "More degrees to make a full turn", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const totalAnswer = parseNumberInput(resp.total);
            const remainingAnswer = parseNumberInput(resp.remaining);
            let score = 0;
            if (totalAnswer === totalDegrees) score += 1;
            if (remainingAnswer === remaining) score += 1;
            const answerText = `Total turn ${totalDegrees}°; remaining ${remaining}°`;
            if (score === 2) {
              return mkResult({
                correct: true,
                score: 2,
                maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The robot turns ${totalDegrees}° altogether, so ${remaining}° more would make a full turn.`,
                answerText
              });
            }
            const misconception = remainingAnswer === totalDegrees
              ? "angle_total_confusion"
              : "skipped_step";
            return mkResult({
              correct: false,
              score,
              maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The robot turns ${totalDegrees}° altogether, so ${remaining}° more would make a full turn.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "stats_bar_high_low_gap",
      label: "Bar chart: highest and gap",
      domain: "Statistics",
      skillIds: ["statistics_reading", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const labels = ["Mon", "Tue", "Wed", "Thu"];
        const values = shuffle([18, 24, 30, 36], rng).map((value, index) => value + index * 2);
        const maxValue = Math.max(...values);
        const minValue = Math.min(...values);
        const bestDay = labels[values.indexOf(maxValue)];
        const gap = maxValue - minValue;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>The bar chart shows how many postcards were sold on four days.</p><p>Which day sold the most postcards, and how many more postcards was that than the lowest day?</p>`,
          visualHtml: barChartSvg(values, labels, 5, "Postcards sold"),
          solutionLines: [
            `The highest bar is ${bestDay} with ${maxValue} postcards.`,
            `The lowest bar is ${minValue} postcards, so the gap is ${maxValue} - ${minValue} = ${gap}.`
          ],
          checkLine: "Read the highest and lowest bars before subtracting.",
          reflectionPrompt: "Did you identify both bars before finding the difference?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "day", label: "Day with the highest sales", kind: "radio", options: labels.map(label => [label, label]) },
              { key: "gap", label: "Difference in postcards", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const gapAnswer = parseNumberInput(resp.gap);
            let score = 0;
            if (resp.day === bestDay) score += 1;
            if (gapAnswer === gap) score += 1;
            const answerText = `${bestDay}; gap ${gap}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${bestDay} sold the most, and the difference from the lowest day is ${gap}.`,
                answerText
              });
            }
            const misconception = resp.day === bestDay || gapAnswer === maxValue
              ? "skipped_step"
              : "data_misread";
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${bestDay} sold the most, and the difference from the lowest day is ${gap}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "stats_bar_total_shortfall",
      label: "Bar chart: total and shortfall",
      domain: "Statistics",
      skillIds: ["statistics_reading", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const labels = ["Class 3", "Class 4", "Class 5", "Class 6"];
        const values = labels.map(() => pick(rng, [12, 15, 18, 21, 24, 27, 30]));
        const chosen = [0, 2];
        const total = values[chosen[0]] + values[chosen[1]];
        const target = total + pick(rng, [6, 9, 12, 15]);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>The bar chart shows how many reading certificates each class won.</p><p>How many certificates did <strong>${labels[chosen[0]]}</strong> and <strong>${labels[chosen[1]]}</strong> win altogether, and how many more would be needed to make <strong>${target}</strong>?</p>`,
          visualHtml: barChartSvg(values, labels, 3, "Certificates won"),
          solutionLines: [
            `${labels[chosen[0]]} and ${labels[chosen[1]]} altogether: ${values[chosen[0]]} + ${values[chosen[1]]} = ${total}.`,
            `To make ${target}, ${target} - ${total} = ${target - total}.`
          ],
          checkLine: "Find the combined total first, then compare it with the target.",
          reflectionPrompt: "Did you subtract from the target after adding the two classes?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "total", label: "Total certificates", kind: "number" },
              { key: "needed", label: "More needed", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const totalAnswer = parseNumberInput(resp.total);
            const neededAnswer = parseNumberInput(resp.needed);
            let score = 0;
            if (totalAnswer === total) score += 1;
            if (neededAnswer === target - total) score += 1;
            const answerText = `Total ${total}; need ${target - total}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The two classes won ${total} altogether, so ${target - total} more are needed.`,
                answerText
              });
            }
            const misconception = totalAnswer === total || neededAnswer === total
              ? "skipped_step"
              : "data_misread";
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The two classes won ${total} altogether, so ${target - total} more are needed.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "stats_tally_total_mode",
      label: "Tally chart: total and most popular",
      domain: "Statistics",
      skillIds: ["statistics_reading", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const rows = [
          ["Apple", pick(rng, [6, 7, 8, 9])],
          ["Banana", pick(rng, [10, 11, 12])],
          ["Orange", pick(rng, [5, 6, 7])],
          ["Pear", pick(rng, [8, 9, 10])]
        ];
        const total = rows[0][1] + rows[3][1];
        const mostPopular = rows.reduce((best, row) => row[1] > best[1] ? row : best, rows[0])[0];
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>The tally chart shows the fruit chosen by a class.</p><p>How many children chose <strong>Apple or Pear</strong>, and which fruit was the most popular?</p>`,
          visualHtml: tableHtml(
            ["Fruit", "Tally", "Frequency"],
            rows.map(([label, count]) => [label, tallyMarks(count), String(count)])
          ),
          solutionLines: [
            `Apple or Pear = ${rows[0][1]} + ${rows[3][1]} = ${total}.`,
            `The highest frequency is ${mostPopular}.`
          ],
          checkLine: "Read the tally or frequency carefully before adding.",
          reflectionPrompt: "Did you compare all four frequencies before choosing the most popular fruit?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "total", label: "Apple or Pear total", kind: "number" },
              { key: "fruit", label: "Most popular fruit", kind: "radio", options: rows.map(([label]) => [label, label]) }
            ]
          },
          evaluate: (resp) => {
            const totalAnswer = parseNumberInput(resp.total);
            let score = 0;
            if (totalAnswer === total) score += 1;
            if (resp.fruit === mostPopular) score += 1;
            const answerText = `Total ${total}; most popular ${mostPopular}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${total} children chose Apple or Pear, and ${mostPopular} was the most popular fruit.`,
                answerText
              });
            }
            const misconception = totalAnswer === rows[0][1] || resp.fruit === mostPopular
              ? "skipped_step"
              : "data_misread";
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${total} children chose Apple or Pear, and ${mostPopular} was the most popular fruit.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "stats_frequency_missing",
      label: "Frequency table: missing value",
      domain: "Statistics",
      skillIds: ["statistics_reading", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const rows = [
          ["Red", pick(rng, [7, 8, 9, 10])],
          ["Blue", pick(rng, [5, 6, 7, 8])],
          ["Green", pick(rng, [6, 7, 8, 9])],
          ["Yellow", pick(rng, [4, 5, 6, 7])]
        ];
        const total = rows.reduce((sum, row) => sum + row[1], 0);
        const missingIndex = 2;
        const missing = rows[missingIndex][1];
        const visibleTotal = total - missing;
        const compare = missing - rows[1][1];
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>The table shows the colours chosen in a survey. The total number of votes is <strong>${total}</strong>.</p><p>What is the missing frequency for <strong>${rows[missingIndex][0]}</strong>, and how many more votes is that than <strong>${rows[1][0]}</strong>?</p>`,
          visualHtml: tableHtml(
            ["Colour", "Frequency"],
            rows.map(([label, count], index) => [label, index === missingIndex ? "?" : String(count)])
          ),
          solutionLines: [
            `The known frequencies add to ${visibleTotal}.`,
            `Missing frequency = ${total} - ${visibleTotal} = ${missing}.`,
            `${rows[missingIndex][0]} has ${compare} more votes than ${rows[1][0]}.`
          ],
          checkLine: "Use the overall total to find the missing frequency first.",
          reflectionPrompt: "Did you subtract the known total before comparing the two colours?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "missing", label: `Missing frequency for ${rows[missingIndex][0]}`, kind: "number" },
              { key: "difference", label: `More votes than ${rows[1][0]}`, kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const missingAnswer = parseNumberInput(resp.missing);
            const differenceAnswer = parseNumberInput(resp.difference);
            let score = 0;
            if (missingAnswer === missing) score += 1;
            if (differenceAnswer === compare) score += 1;
            const answerText = `Missing frequency ${missing}; difference ${compare}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The missing frequency is ${missing}, which is ${compare} more than ${rows[1][0]}.`,
                answerText
              });
            }
            const misconception = missingAnswer === missing || differenceAnswer === missing
              ? "skipped_step"
              : "data_misread";
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The missing frequency is ${missing}, which is ${compare} more than ${rows[1][0]}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "stats_line_graph_change_peak",
      label: "Line graph: change and peak",
      domain: "Statistics",
      skillIds: ["statistics_reading", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const labels = ["Mon", "Tue", "Wed", "Thu", "Fri"];
        const values = [12, 16, 22, 18, 26].map(value => value + pick(rng, [0, 2, 4]));
        const change = values[4] - values[1];
        const peakDay = labels[values.indexOf(Math.max(...values))];
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>The line graph shows the number of laps run in PE each day.</p><p>How many more laps were run on <strong>Friday</strong> than on <strong>Tuesday</strong>, and which day had the highest number of laps?</p>`,
          visualHtml: lineGraphSvg(values, labels, 5, "Laps run"),
          solutionLines: [
            `Friday compared with Tuesday: ${values[4]} - ${values[1]} = ${change}.`,
            `The highest point is ${peakDay}.`
          ],
          checkLine: "Read the two named points before comparing them.",
          reflectionPrompt: "Did you read the peak from the graph instead of assuming it was the last day?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "change", label: "Difference in laps", kind: "number" },
              { key: "peak", label: "Day with the highest number of laps", kind: "radio", options: labels.map(label => [label, label]) }
            ]
          },
          evaluate: (resp) => {
            const changeAnswer = parseNumberInput(resp.change);
            let score = 0;
            if (changeAnswer === change) score += 1;
            if (resp.peak === peakDay) score += 1;
            const answerText = `Difference ${change}; highest day ${peakDay}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `Friday has ${change} more laps than Tuesday, and ${peakDay} is the highest day.`,
                answerText
              });
            }
            const misconception = changeAnswer === values[4] || resp.peak === peakDay
              ? "skipped_step"
              : "data_misread";
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `Friday has ${change} more laps than Tuesday, and ${peakDay} is the highest day.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "stats_pictogram_compare",
      label: "Pictogram: total and comparison",
      domain: "Statistics",
      skillIds: ["statistics_reading", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rows = [
          ["Cats", 8],
          ["Dogs", 12],
          ["Rabbits", 6],
          ["Hamsters", 10]
        ];
        const scale = 2;
        const total = rows[1][1] + rows[3][1];
        const difference = total - rows[0][1];
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>The pictogram shows how many pets were chosen in a vote.</p><p>How many votes did <strong>Dogs and Hamsters</strong> get altogether, and how many more is that than <strong>Cats</strong>?</p>`,
          visualHtml: pictogramHtml(rows, scale),
          solutionLines: [
            `Dogs and Hamsters altogether: ${rows[1][1]} + ${rows[3][1]} = ${total}.`,
            `Compared with Cats: ${total} - ${rows[0][1]} = ${difference}.`
          ],
          checkLine: "Use the key first so each symbol is counted correctly.",
          reflectionPrompt: "Did you convert the symbols into values before adding?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "total", label: "Dogs and Hamsters total", kind: "number" },
              { key: "difference", label: "How many more than Cats", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const totalAnswer = parseNumberInput(resp.total);
            const differenceAnswer = parseNumberInput(resp.difference);
            let score = 0;
            if (totalAnswer === total) score += 1;
            if (differenceAnswer === difference) score += 1;
            const answerText = `Total ${total}; difference ${difference}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `Dogs and Hamsters got ${total} votes altogether, which is ${difference} more than Cats.`,
                answerText
              });
            }
            const misconception = totalAnswer === total || differenceAnswer === total
              ? "skipped_step"
              : "data_misread";
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `Dogs and Hamsters got ${total} votes altogether, which is ${difference} more than Cats.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "stats_two_way_table",
      label: "Two-way table: total and difference",
      domain: "Statistics",
      skillIds: ["statistics_reading", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const football = [pick(rng, [6, 7, 8]), pick(rng, [5, 6, 7])];
        const chess = [pick(rng, [4, 5, 6]), pick(rng, [6, 7, 8])];
        const art = [pick(rng, [5, 6, 7]), pick(rng, [4, 5, 6])];
        const rows = [
          ["Football", football[0], football[1]],
          ["Chess", chess[0], chess[1]],
          ["Art", art[0], art[1]]
        ];
        const footballTotal = football[0] + football[1];
        const difference = chess[1] - chess[0];
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>The table shows which after-school club pupils chose.</p><p>How many pupils chose <strong>Football</strong> altogether, and how many more <strong>girls than boys</strong> chose <strong>Chess</strong>?</p>`,
          visualHtml: tableHtml(
            ["Club", "Boys", "Girls"],
            rows.map(([club, boys, girls]) => [club, String(boys), String(girls)])
          ),
          solutionLines: [
            `Football altogether: ${football[0]} + ${football[1]} = ${footballTotal}.`,
            `For Chess, ${chess[1]} - ${chess[0]} = ${difference} more girls than boys.`
          ],
          checkLine: "Read across the correct row before adding or subtracting.",
          reflectionPrompt: "Did you stay in the right row for each part of the question?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "football", label: "Football total", kind: "number" },
              { key: "difference", label: "More girls than boys for Chess", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const footballAnswer = parseNumberInput(resp.football);
            const differenceAnswer = parseNumberInput(resp.difference);
            let score = 0;
            if (footballAnswer === footballTotal) score += 1;
            if (differenceAnswer === difference) score += 1;
            const answerText = `Football total ${footballTotal}; Chess difference ${difference}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${footballTotal} pupils chose Football, and Chess has ${difference} more girls than boys.`,
                answerText
              });
            }
            const misconception = footballAnswer === footballTotal || differenceAnswer === chess[1]
              ? "skipped_step"
              : "data_misread";
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${footballTotal} pupils chose Football, and Chess has ${difference} more girls than boys.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "stats_error_analysis_scale",
      label: "Error analysis: wrong graph scale",
      domain: "Statistics",
      skillIds: ["statistics_reading", "error_analysis"],
      satsFriendly: true,
      generator(seed) {
        const labels = ["A", "B", "C", "D"];
        const values = [4, 8, 12, 16];
        const correct = values[2];
        const wrong = 3;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `
            <p>A pupil looks at a bar chart where the scale goes up in <strong>4s</strong>.</p>
            <p>The bar for <strong>${labels[2]}</strong> reaches the third grid line.</p>
            <div class="callout">“The value for ${labels[2]} is <strong>${wrong}</strong> because it reaches line 3.”</div>
            <p>Which mistake has the pupil made, and what is the correct value?</p>`,
          visualHtml: barChartSvg(values, labels, 4, "Values on a scale of 4"),
          solutionLines: [
            `The pupil counted grid lines instead of using the scale.`,
            `Each step is 4, so line 3 means ${correct}.`
          ],
          checkLine: "Read the size of each scale step before reading the bar height.",
          reflectionPrompt: "Did you use the scale value, not the line number?",
          inputSpec: {
            type: "multi",
            fields: [
              {
                key: "reason",
                label: "Mistake",
                kind: "radio",
                options: [
                  ["scale", "They counted the lines instead of using the scale."],
                  ["add", "They should have added the bars."],
                  ["none", "There is no mistake."]
                ]
              },
              { key: "value", label: "Correct value", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const valueAnswer = parseNumberInput(resp.value);
            let score = 0;
            if (resp.reason === "scale") score += 1;
            if (valueAnswer === correct) score += 1;
            const answerText = `Used line number instead of scale; correct value ${correct}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The pupil ignored the scale. The correct value is ${correct}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: "data_misread",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The pupil ignored the scale. The correct value is ${correct}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "stats_table_range_and_total",
      label: "Table: range and selected total",
      domain: "Statistics",
      skillIds: ["statistics_reading", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const rows = [
          ["Team A", pick(rng, [11, 12, 13, 14])],
          ["Team B", pick(rng, [15, 16, 17, 18])],
          ["Team C", pick(rng, [9, 10, 11, 12])],
          ["Team D", pick(rng, [13, 14, 15, 16])]
        ];
        const values = rows.map(row => row[1]);
        const range = Math.max(...values) - Math.min(...values);
        const selectedTotal = rows[1][1] + rows[3][1];
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>The table shows how many points each team scored.</p><p>What is the range of the scores, and what is the total for <strong>Team B and Team D</strong>?</p>`,
          visualHtml: tableHtml(
            ["Team", "Points"],
            rows.map(([team, points]) => [team, String(points)])
          ),
          solutionLines: [
            `Range = highest - lowest = ${Math.max(...values)} - ${Math.min(...values)} = ${range}.`,
            `Team B and Team D together = ${rows[1][1]} + ${rows[3][1]} = ${selectedTotal}.`
          ],
          checkLine: "Range means highest minus lowest.",
          reflectionPrompt: "Did you find the range and the selected total separately?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "range", label: "Range", kind: "number" },
              { key: "total", label: "Team B and Team D total", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const rangeAnswer = parseNumberInput(resp.range);
            const totalAnswer = parseNumberInput(resp.total);
            let score = 0;
            if (rangeAnswer === range) score += 1;
            if (totalAnswer === selectedTotal) score += 1;
            const answerText = `Range ${range}; selected total ${selectedTotal}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The range is ${range}, and Team B plus Team D gives ${selectedTotal}.`,
                answerText
              });
            }
            const misconception = rangeAnswer === Math.max(...values) || totalAnswer === selectedTotal
              ? "skipped_step"
              : "data_misread";
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The range is ${range}, and Team B plus Team D gives ${selectedTotal}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "reason_sum_estimate_direction",
      label: "Estimate a sum and compare",
      domain: "Reasoning and checking",
      skillIds: ["reasonableness"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const a = randInt(rng, 240, 780);
        const b = randInt(rng, 230, 790);
        const roundedA = Math.round(a / 100) * 100;
        const roundedB = Math.round(b / 100) * 100;
        const estimate = roundedA + roundedB;
        const exact = a + b;
        if (exact === estimate) return this.generator(seed + 17);
        const direction = exact > estimate ? "greater" : "less";
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Estimate <strong>${a} + ${b}</strong> by rounding each number to the nearest hundred.</p><p>What is the estimate, and is the exact total greater or less than this estimate?</p>`,
          solutionLines: [
            `${a} rounds to ${roundedA} and ${b} rounds to ${roundedB}.`,
            `Estimated total = ${roundedA} + ${roundedB} = ${estimate}.`,
            `The exact total is ${exact}, so it is ${direction} than the estimate.`
          ],
          checkLine: "Round both numbers first, then compare the exact total with the estimate.",
          reflectionPrompt: "Did you compare the exact and estimated totals after rounding?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "estimate", label: "Estimated total", kind: "number" },
              { key: "direction", label: "Exact total is...", kind: "radio", options: [["greater", "Greater"], ["less", "Less"]] }
            ]
          },
          evaluate: (resp) => {
            const estimateAnswer = parseNumberInput(resp.estimate);
            let score = 0;
            if (estimateAnswer === estimate) score += 1;
            if (resp.direction === direction) score += 1;
            const answerText = `Estimate ${estimate}; exact total is ${direction}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The estimate is ${estimate}, and the exact total is ${direction} than that.`,
                answerText
              });
            }
            const misconception = estimateAnswer === exact ? "estimation_failure" : "skipped_step";
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The estimate is ${estimate}, and the exact total is ${direction} than that.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "reason_budget_estimate",
      label: "Estimate a total cost and budget check",
      domain: "Reasoning and checking",
      skillIds: ["reasonableness"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const tickets = pick(rng, [23, 27, 31, 34, 36, 42, 47]);
        const cost = pick(rng, [16, 18, 19, 21, 24, 26, 29]);
        const roundedTickets = Math.round(tickets / 10) * 10;
        const roundedCost = Math.round(cost / 10) * 10;
        const estimate = roundedTickets * roundedCost;
        const enough = pick(rng, [true, false]);
        const budget = enough ? estimate + pick(rng, [100, 150, 200]) : estimate - pick(rng, [100, 150, 200]);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A trip needs <strong>${tickets}</strong> tickets costing <strong>£${cost}</strong> each.</p><p>Use a quick estimate to decide whether <strong>£${budget}</strong> should be enough.</p><p>What is the estimated total cost, and should the budget be enough?</p>`,
          solutionLines: [
            `${tickets} rounds to ${roundedTickets} and £${cost} rounds to £${roundedCost}.`,
            `Estimated total = ${roundedTickets} × ${roundedCost} = £${estimate}.`,
            `£${budget} is ${enough ? "enough" : "not enough"} compared with the estimate.`
          ],
          checkLine: "Round both factors before multiplying, then compare with the budget.",
          reflectionPrompt: "Did you estimate the cost before judging the budget?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "estimate", label: "Estimated total cost", kind: "number" },
              { key: "enough", label: "Budget enough?", kind: "radio", options: [["yes", "Yes"], ["no", "No"]] }
            ]
          },
          evaluate: (resp) => {
            const estimateAnswer = parseNumberInput(resp.estimate);
            let score = 0;
            if (estimateAnswer === estimate) score += 1;
            if ((resp.enough === "yes") === enough) score += 1;
            const answerText = `Estimate £${estimate}; budget ${enough ? "enough" : "not enough"}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The estimate is £${estimate}, so £${budget} is ${enough ? "enough" : "not enough"}.`,
                answerText
              });
            }
            const misconception = estimateAnswer === tickets * cost ? "estimation_failure" : "skipped_step";
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The estimate is £${estimate}, so £${budget} is ${enough ? "enough" : "not enough"}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "reason_choose_reasonable_answer",
      label: "Choose the most sensible answer",
      domain: "Reasoning and checking",
      skillIds: ["reasonableness"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const trays = pick(rng, [18, 24, 28, 31, 34, 38, 42]);
        const plants = pick(rng, [19, 21, 24, 26]);
        const exact = trays * plants;
        const roundedEstimate = (Math.round(trays / 10) * 10) * (Math.round(plants / 10) * 10);
        const options = shuffle([
          ["A", String(Math.round(exact / 10))],
          ["B", String(exact)],
          ["C", String(exact * 10)],
          ["D", String(trays + plants)]
        ], rng);
        const correctLetter = options.find(([_, value]) => Number(value) === exact)[0];
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A gardener places <strong>${plants}</strong> plants in each of <strong>${trays}</strong> trays.</p><p>Which answer is most sensible, and what quick estimate supports it?</p>`,
          visualHtml: renderChoiceList(options),
          solutionLines: [
            `A quick estimate is ${Math.round(trays / 10) * 10} × ${Math.round(plants / 10) * 10} = ${roundedEstimate}.`,
            `So the most sensible answer is ${exact}, which is option ${correctLetter}.`
          ],
          checkLine: "Use a rounded multiplication to eliminate silly answers first.",
          reflectionPrompt: "Did you check which option is close to the estimate?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "letter", label: "Most sensible option", kind: "radio", options: options.map(([letter]) => [letter, letter]) },
              { key: "estimate", label: "Quick estimate", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const estimateAnswer = parseNumberInput(resp.estimate);
            let score = 0;
            if (resp.letter === correctLetter) score += 1;
            if (estimateAnswer === roundedEstimate) score += 1;
            const answerText = `Option ${correctLetter}; estimate ${roundedEstimate}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The best answer is option ${correctLetter}, supported by an estimate of ${roundedEstimate}.`,
                answerText
              });
            }
            const misconception = resp.letter === correctLetter || estimateAnswer === exact
              ? "skipped_step"
              : "estimation_failure";
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The best answer is option ${correctLetter}, supported by an estimate of ${roundedEstimate}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "reason_better_estimate",
      label: "Choose the better estimate",
      domain: "Reasoning and checking",
      skillIds: ["reasonableness"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const a = pick(rng, [184, 196, 198, 205, 214, 223]);
        const b = pick(rng, [176, 187, 202, 206, 214, 219]);
        const better = Math.round(a / 100) * 100 + Math.round(b / 100) * 100;
        const worse = Math.floor(a / 100) * 100 + Math.floor(b / 100) * 100;
        if (better === worse) return this.generator(seed + 23);
        const betterName = better > worse ? "Suki" : "Amir";
        const otherName = betterName === "Suki" ? "Amir" : "Suki";
        const exact = a + b;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A theatre sold <strong>${a}</strong> tickets on Friday and <strong>${b}</strong> on Saturday.</p><p>${betterName} says the total is about <strong>${better}</strong>. ${otherName} says the total is about <strong>${worse}</strong>.</p><p>Whose estimate is better, and what is the better rounded estimate?</p>`,
          solutionLines: [
            `${a} rounds to ${Math.round(a / 100) * 100} and ${b} rounds to ${Math.round(b / 100) * 100}.`,
            `A better estimate is ${better}.`,
            `The exact total is ${exact}, so ${betterName}'s estimate is closer.`
          ],
          checkLine: "Round each number to the nearest hundred, not always down.",
          reflectionPrompt: "Did you compare the estimates with the exact total at the end?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "name", label: "Better estimate", kind: "radio", options: [[betterName, betterName], [otherName, otherName]] },
              { key: "estimate", label: "Better rounded estimate", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const estimateAnswer = parseNumberInput(resp.estimate);
            let score = 0;
            if (resp.name === betterName) score += 1;
            if (estimateAnswer === better) score += 1;
            const answerText = `${betterName}; estimate ${better}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${betterName}'s estimate of ${better} is better.`,
                answerText
              });
            }
            const misconception = estimateAnswer === worse ? "estimation_failure" : "skipped_step";
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception,
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${betterName}'s estimate of ${better} is better.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "reason_error_addition_regroup",
      label: "Error analysis: missed regrouping in addition",
      domain: "Reasoning and checking",
      skillIds: ["error_analysis"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const a = pick(rng, [368, 457, 286, 594, 678]);
        const b = pick(rng, [257, 186, 347, 238, 145]);
        const exact = a + b;
        const wrong = exact - 10;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `
            <p>A pupil says:</p>
            <div class="callout">“${a} + ${b} = <strong>${wrong}</strong>.”</div>
            <p>Which mistake has the pupil made, and what is the correct total?</p>`,
          solutionLines: [
            `The ones column needs regrouping because the ones make more than 10.`,
            `After regrouping, the correct total is ${exact}.`
          ],
          checkLine: "Check whether the ones column makes a ten that must be regrouped.",
          reflectionPrompt: "Did you look for a carried ten from the ones column?",
          inputSpec: {
            type: "multi",
            fields: [
              {
                key: "reason",
                label: "Mistake",
                kind: "radio",
                options: [
                  ["carry", "They forgot to regroup a ten."],
                  ["subtract", "They subtracted instead of adding."],
                  ["none", "There is no mistake."]
                ]
              },
              { key: "total", label: "Correct total", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const totalAnswer = parseNumberInput(resp.total);
            let score = 0;
            if (resp.reason === "carry") score += 1;
            if (totalAnswer === exact) score += 1;
            const answerText = `Forgot to regroup; total ${exact}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The pupil missed the regrouping step. The correct total is ${exact}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: "misread_question",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The pupil missed the regrouping step. The correct total is ${exact}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "reason_error_subtraction_exchange",
      label: "Error analysis: subtraction without exchange",
      domain: "Reasoning and checking",
      skillIds: ["error_analysis"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const a = pick(rng, [542, 631, 724, 853, 764]);
        const b = pick(rng, [286, 257, 368, 475, 486]);
        if (a <= b) return this.generator(seed + 19);
        const exact = a - b;
        const digitsA = String(a).padStart(3, "0").split("").map(Number);
        const digitsB = String(b).padStart(3, "0").split("").map(Number);
        const wrong = Number(digitsA.map((digit, index) => Math.abs(digit - digitsB[index])).join(""));
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `
            <p>A pupil says:</p>
            <div class="callout">“${a} - ${b} = <strong>${wrong}</strong>.”</div>
            <p>Which mistake has the pupil made, and what is the correct answer?</p>`,
          solutionLines: [
            `The pupil subtracted each digit separately instead of exchanging where needed.`,
            `The correct answer is ${exact}.`
          ],
          checkLine: "Look for a column where the top digit is smaller than the bottom digit.",
          reflectionPrompt: "Did you check whether exchanging was needed before subtracting?",
          inputSpec: {
            type: "multi",
            fields: [
              {
                key: "reason",
                label: "Mistake",
                kind: "radio",
                options: [
                  ["exchange", "They subtracted digits separately without exchanging."],
                  ["add", "They added instead of subtracting."],
                  ["none", "There is no mistake."]
                ]
              },
              { key: "answer", label: "Correct answer", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const answer = parseNumberInput(resp.answer);
            let score = 0;
            if (resp.reason === "exchange") score += 1;
            if (answer === exact) score += 1;
            const answerText = `Needed exchange; answer ${exact}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The pupil ignored the exchange. The correct answer is ${exact}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: "inverse_error",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The pupil ignored the exchange. The correct answer is ${exact}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "reason_error_multiplication_concat",
      label: "Error analysis: joining partial products",
      domain: "Reasoning and checking",
      skillIds: ["error_analysis"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const tens = pick(rng, [20, 30, 40, 50]);
        const ones = pick(rng, [3, 4, 5, 6, 7]);
        const multiplier = pick(rng, [3, 4, 5, 6]);
        const firstFactor = tens + ones;
        const partA = tens * multiplier;
        const partB = ones * multiplier;
        const wrong = Number(`${partA}${partB}`);
        const exact = firstFactor * multiplier;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `
            <p>A pupil says:</p>
            <div class="callout">“${firstFactor} × ${multiplier} = <strong>${wrong}</strong> because ${tens} × ${multiplier} = ${partA} and ${ones} × ${multiplier} = ${partB}.”</div>
            <p>Which mistake has the pupil made, and what is the correct product?</p>`,
          solutionLines: [
            `The partial products should be added, not joined together.`,
            `${partA} + ${partB} = ${exact}.`
          ],
          checkLine: "Split the number into tens and ones, then add the partial products.",
          reflectionPrompt: "Did you add the partial products instead of writing them side by side?",
          inputSpec: {
            type: "multi",
            fields: [
              {
                key: "reason",
                label: "Mistake",
                kind: "radio",
                options: [
                  ["join", "They joined the partial products instead of adding them."],
                  ["subtract", "They should have subtracted the partial products."],
                  ["none", "There is no mistake."]
                ]
              },
              { key: "product", label: "Correct product", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const product = parseNumberInput(resp.product);
            let score = 0;
            if (resp.reason === "join") score += 1;
            if (product === exact) score += 1;
            const answerText = `Joined partial products; product ${exact}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The pupil joined the partial products. The correct product is ${exact}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: "scaling_confusion",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The pupil joined the partial products. The correct product is ${exact}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "reason_error_ignored_remainder",
      label: "Error analysis: ignored remainder in context",
      domain: "Reasoning and checking",
      skillIds: ["error_analysis", "reasonableness"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const seats = pick(rng, [6, 7, 8, 9]);
        const pupils = randInt(rng, seats * 4 + 1, seats * 8 - 1);
        const base = Math.floor(pupils / seats);
        const correct = Math.ceil(pupils / seats);
        const spare = correct * seats - pupils;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `
            <p>A pupil says:</p>
            <div class="callout">“${base} tables are enough for ${pupils} pupils because ${pupils} ÷ ${seats} = ${base} remainder ${pupils - base * seats}.”</div>
            <p>Which mistake has the pupil made, and how many spare seats would there be with the correct number of tables?</p>`,
          solutionLines: [
            `The remainder means another full table is needed, so the pupil rounded down when the context needed a round up.`,
            `With ${correct} tables there would be ${spare} spare seats.`
          ],
          checkLine: "In seating problems, a remainder usually means one more group is needed.",
          reflectionPrompt: "Did you think about whether the remainder still needs a seat?",
          inputSpec: {
            type: "multi",
            fields: [
              {
                key: "reason",
                label: "Mistake",
                kind: "radio",
                options: [
                  ["remainder", "They ignored the remainder and rounded down."],
                  ["multiply", "They should have multiplied instead of dividing."],
                  ["none", "There is no mistake."]
                ]
              },
              { key: "spare", label: "Spare seats with the correct number of tables", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const spareAnswer = parseNumberInput(resp.spare);
            let score = 0;
            if (resp.reason === "remainder") score += 1;
            if (spareAnswer === spare) score += 1;
            const answerText = `Ignored remainder; spare seats ${spare}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The pupil ignored the remainder. With the correct number of tables there would be ${spare} spare seats.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: "estimation_failure",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The pupil ignored the remainder. With the correct number of tables there would be ${spare} spare seats.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "reason_error_rounding_boundary",
      label: "Error analysis: rounding at the boundary",
      domain: "Reasoning and checking",
      skillIds: ["error_analysis", "reasonableness"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const hundreds = pick(rng, [200, 300, 400, 500, 600]);
        const number = hundreds + 50;
        const wrong = hundreds;
        const correct = hundreds + 100;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `
            <p>A pupil says:</p>
            <div class="callout">“${number} rounds to <strong>${wrong}</strong> to the nearest hundred.”</div>
            <p>Which mistake has the pupil made, and what is the correct rounded number?</p>`,
          solutionLines: [
            `A number ending in 50 is exactly halfway, so it rounds up to the next hundred.`,
            `${number} rounds to ${correct}.`
          ],
          checkLine: "Halfway cases go up when rounding to the nearest hundred.",
          reflectionPrompt: "Did you notice that 50 is exactly halfway between the two hundreds?",
          inputSpec: {
            type: "multi",
            fields: [
              {
                key: "reason",
                label: "Mistake",
                kind: "radio",
                options: [
                  ["halfway", "They rounded a halfway number down instead of up."],
                  ["tens", "They rounded to the nearest ten instead of hundred."],
                  ["none", "There is no mistake."]
                ]
              },
              { key: "rounded", label: "Correct rounded number", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const rounded = parseNumberInput(resp.rounded);
            let score = 0;
            if (resp.reason === "halfway") score += 1;
            if (rounded === correct) score += 1;
            const answerText = `Halfway should round up; ${number} rounds to ${correct}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${number} is a halfway case, so it rounds up to ${correct}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: "estimation_failure",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${number} is a halfway case, so it rounds up to ${correct}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "fdp_fraction_to_decimal_percent",
      label: "Fraction to decimal and percentage",
      domain: "Fractions, decimals and percentages",
      skillIds: ["fdp_equiv"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const item = pick(rng, FDP_LINK_CASES);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Write <strong>${fractionToText(item.n, item.d)}</strong> as a decimal and as a percentage.</p>`,
          solutionLines: [
            `${fractionToText(item.n, item.d)} = ${formatDecimalString(item.decimal)} as a decimal.`,
            `${fractionToText(item.n, item.d)} = ${item.percent}% as a percentage.`
          ],
          checkLine: "Convert the fraction to a decimal first if that helps, then turn the decimal into a percentage.",
          reflectionPrompt: "Did you keep the decimal and percentage for the same value?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "decimal", label: "Decimal", kind: "text", placeholder: "e.g. 0.25" },
              { key: "percent", label: "Percentage", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const decimalAnswer = parseFractionOrNumber(resp.decimal);
            const percentAnswer = parseNumberInput(resp.percent);
            let score = 0;
            if (equalNumeric(decimalAnswer, item.decimal)) score += 1;
            if (percentAnswer === item.percent) score += 1;
            const answerText = `${formatDecimalString(item.decimal)} and ${item.percent}%`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${fractionToText(item.n, item.d)} = ${formatDecimalString(item.decimal)} = ${item.percent}%.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "fraction_misconception",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${fractionToText(item.n, item.d)} = ${formatDecimalString(item.decimal)} = ${item.percent}%.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "fdp_decimal_to_fraction_percent",
      label: "Decimal to fraction and percentage",
      domain: "Fractions, decimals and percentages",
      skillIds: ["fdp_equiv"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const item = pick(rng, FDP_LINK_CASES.filter(entry => entry.decimal !== 0.5));
        const simplified = simplifyFraction(item.n, item.d);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Write <strong>${formatDecimalString(item.decimal)}</strong> as a simplified fraction and as a percentage.</p>`,
          solutionLines: [
            `${formatDecimalString(item.decimal)} = ${fractionToText(simplified.n, simplified.d)}.`,
            `${formatDecimalString(item.decimal)} = ${item.percent}%.`
          ],
          checkLine: "Think in tenths or hundredths, then simplify the fraction if possible.",
          reflectionPrompt: "Did you simplify the fraction after converting from the decimal?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "fraction", label: "Simplified fraction", kind: "text", placeholder: "e.g. 3/4" },
              { key: "percent", label: "Percentage", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const fractionAnswer = parseFractionOrNumber(resp.fraction);
            const percentAnswer = parseNumberInput(resp.percent);
            let score = 0;
            if (equalNumeric(fractionAnswer, item.n / item.d)) score += 1;
            if (percentAnswer === item.percent) score += 1;
            const answerText = `${fractionToText(simplified.n, simplified.d)} and ${item.percent}%`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${formatDecimalString(item.decimal)} = ${fractionToText(simplified.n, simplified.d)} = ${item.percent}%.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "fraction_misconception",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${formatDecimalString(item.decimal)} = ${fractionToText(simplified.n, simplified.d)} = ${item.percent}%.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "fdp_conversion_table",
      label: "Conversion table",
      domain: "Fractions, decimals and percentages",
      skillIds: ["fdp_equiv"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const first = pick(rng, FDP_LINK_CASES);
        const second = pick(rng, FDP_LINK_CASES.filter(item => item.percent !== first.percent));
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Complete the missing values in the table.</p>`,
          visualHtml: tableHtml(
            ["Fraction", "Decimal", "Percentage"],
            [
              [fractionToText(first.n, first.d), "?", `${first.percent}%`],
              ["?", formatDecimalString(second.decimal), `${second.percent}%`]
            ]
          ),
          solutionLines: [
            `${fractionToText(first.n, first.d)} = ${formatDecimalString(first.decimal)}.`,
            `${formatDecimalString(second.decimal)} = ${fractionToText(second.n, second.d)}.`
          ],
          checkLine: "Each row shows the same value in three forms.",
          reflectionPrompt: "Did you treat each row as one linked value?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "decimal", label: `Decimal for ${fractionToText(first.n, first.d)}`, kind: "text", placeholder: "e.g. 0.4" },
              { key: "fraction", label: `Fraction for ${formatDecimalString(second.decimal)}`, kind: "text", placeholder: "e.g. 2/5" }
            ]
          },
          evaluate: (resp) => {
            const decimalAnswer = parseFractionOrNumber(resp.decimal);
            const fractionAnswer = parseFractionOrNumber(resp.fraction);
            let score = 0;
            if (equalNumeric(decimalAnswer, first.decimal)) score += 1;
            if (equalNumeric(fractionAnswer, second.n / second.d)) score += 1;
            const answerText = `${formatDecimalString(first.decimal)} and ${fractionToText(second.n, second.d)}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The missing values are ${formatDecimalString(first.decimal)} and ${fractionToText(second.n, second.d)}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "fraction_misconception",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The missing values are ${formatDecimalString(first.decimal)} and ${fractionToText(second.n, second.d)}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "fdp_missing_whole_from_percent",
      label: "Find the whole from a percentage",
      domain: "Fractions, decimals and percentages",
      skillIds: ["percent_number", "fdp_equiv"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const pct = pick(rng, [20, 25, 50, 75]);
        const whole = randInt(rng, 6, 18) * 20;
        const part = whole * pct / 100;
        const tenPercent = whole / 10;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p><strong>${pct}%</strong> of a collection is <strong>${part}</strong>.</p><p>How many are there altogether, and what is <strong>10%</strong> of the whole collection?</p>`,
          solutionLines: [
            `If ${pct}% is ${part}, the whole collection is ${whole}.`,
            `10% of ${whole} is ${tenPercent}.`
          ],
          checkLine: "Work out the whole first before finding 10% of it.",
          reflectionPrompt: "Did you rebuild 100% before calculating 10%?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "whole", label: "Whole collection", kind: "number" },
              { key: "tenPercent", label: "10% of the whole", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const wholeAnswer = parseNumberInput(resp.whole);
            const tenAnswer = parseNumberInput(resp.tenPercent);
            let score = 0;
            if (wholeAnswer === whole) score += 1;
            if (tenAnswer === tenPercent) score += 1;
            const answerText = `Whole ${whole}; 10% is ${tenPercent}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The whole collection is ${whole}, so 10% is ${tenPercent}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "fraction_misconception",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The whole collection is ${whole}, so 10% is ${tenPercent}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "fdp_discount_price",
      label: "Discount and sale price",
      domain: "Fractions, decimals and percentages",
      skillIds: ["percent_number"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const pct = pick(rng, [10, 20, 25, 50]);
        const price = pct === 25 ? randInt(rng, 8, 24) * 4 : randInt(rng, 12, 40) * (100 / gcd(100, pct));
        const saving = price * pct / 100;
        const salePrice = price - saving;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A game costs <strong>£${price}</strong> and is reduced by <strong>${pct}%</strong>.</p><p>What is the saving, and what is the sale price?</p>`,
          solutionLines: [
            `${pct}% of £${price} is £${saving}.`,
            `Sale price = £${price} - £${saving} = £${salePrice}.`
          ],
          checkLine: "Find the discount first, then subtract it from the original price.",
          reflectionPrompt: "Did you subtract the saving after finding the percentage discount?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "saving", label: "Saving", kind: "number" },
              { key: "salePrice", label: "Sale price", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const savingAnswer = parseNumberInput(resp.saving);
            const saleAnswer = parseNumberInput(resp.salePrice);
            let score = 0;
            if (savingAnswer === saving) score += 1;
            if (saleAnswer === salePrice) score += 1;
            const answerText = `Saving £${saving}; sale price £${salePrice}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The saving is £${saving}, so the sale price is £${salePrice}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: savingAnswer === saving || saleAnswer === saving ? "skipped_step" : "fraction_misconception",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The saving is £${saving}, so the sale price is £${salePrice}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "fdp_compare_percent_amounts",
      label: "Compare two percentage amounts",
      domain: "Fractions, decimals and percentages",
      skillIds: ["percent_number", "fdp_equiv"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const options = [
          { leftPct: 50, leftWhole: 80, rightPct: 25, rightWhole: 120 },
          { leftPct: 75, leftWhole: 40, rightPct: 50, rightWhole: 70 },
          { leftPct: 20, leftWhole: 150, rightPct: 25, rightWhole: 100 },
          { leftPct: 40, leftWhole: 90, rightPct: 50, rightWhole: 60 }
        ];
        const choice = pick(rng, options);
        const left = choice.leftWhole * choice.leftPct / 100;
        const right = choice.rightWhole * choice.rightPct / 100;
        const larger = left > right ? "A" : "B";
        const difference = Math.abs(left - right);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Compare these two amounts.</p><p><strong>A</strong>: ${choice.leftPct}% of ${choice.leftWhole}</p><p><strong>B</strong>: ${choice.rightPct}% of ${choice.rightWhole}</p><p>Which is larger, and by how much?</p>`,
          solutionLines: [
            `A = ${choice.leftPct}% of ${choice.leftWhole} = ${left}.`,
            `B = ${choice.rightPct}% of ${choice.rightWhole} = ${right}.`,
            `${larger} is larger by ${difference}.`
          ],
          checkLine: "Work out both percentage amounts before comparing them.",
          reflectionPrompt: "Did you calculate A and B separately first?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "larger", label: "Larger amount", kind: "radio", options: [["A", "A"], ["B", "B"]] },
              { key: "difference", label: "Difference", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const differenceAnswer = parseNumberInput(resp.difference);
            let score = 0;
            if (resp.larger === larger) score += 1;
            if (differenceAnswer === difference) score += 1;
            const answerText = `${larger}; difference ${difference}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${larger} is larger by ${difference}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "fraction_misconception",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${larger} is larger by ${difference}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "fdp_order_mixed_values",
      label: "Order mixed representations",
      domain: "Fractions, decimals and percentages",
      skillIds: ["fdp_equiv"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const items = shuffle(FDP_LINK_CASES, rng).slice(0, 4).sort((a, b) => a.decimal - b.decimal);
        const shuffled = shuffle(items.map(item => {
          const display = pick(rng, [
            fractionToText(item.n, item.d),
            formatDecimalString(item.decimal),
            `${item.percent}%`
          ]);
          return { value: item.decimal, display };
        }), rng);
        const letters = ["A", "B", "C", "D"];
        const options = shuffled.map((item, index) => [letters[index], item.display]);
        const smallest = letters[shuffled.findIndex(item => item.value === Math.min(...shuffled.map(x => x.value)))];
        const largest = letters[shuffled.findIndex(item => item.value === Math.max(...shuffled.map(x => x.value)))];
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Look at the four equivalent-value cards.</p><p>Which card shows the smallest value, and which shows the largest value?</p>`,
          visualHtml: renderChoiceList(options),
          solutionLines: [
            `Convert each card to decimals to compare them fairly.`,
            `The smallest card is ${smallest} and the largest card is ${largest}.`
          ],
          checkLine: "Change the cards into one form before ordering them.",
          reflectionPrompt: "Did you compare like with like before choosing the smallest and largest cards?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "smallest", label: "Smallest card", kind: "radio", options: letters.map(letter => [letter, letter]) },
              { key: "largest", label: "Largest card", kind: "radio", options: letters.map(letter => [letter, letter]) }
            ]
          },
          evaluate: (resp) => {
            let score = 0;
            if (resp.smallest === smallest) score += 1;
            if (resp.largest === largest) score += 1;
            const answerText = `Smallest ${smallest}; largest ${largest}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The smallest card is ${smallest} and the largest card is ${largest}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: "fraction_misconception",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The smallest card is ${smallest} and the largest card is ${largest}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "fdp_error_decimal_percent",
      label: "Error analysis: decimal to percentage",
      domain: "Fractions, decimals and percentages",
      skillIds: ["fdp_equiv", "error_analysis"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const item = pick(rng, FDP_LINK_CASES.filter(entry => entry.percent >= 20 && entry.percent <= 80));
        const wrong = item.percent / 10;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `
            <p>A pupil says:</p>
            <div class="callout">“${formatDecimalString(item.decimal)} = <strong>${wrong}%</strong>.”</div>
            <p>Which mistake has the pupil made, and what is the correct percentage?</p>`,
          solutionLines: [
            `To change a decimal to a percentage, multiply by 100, not by 10.`,
            `${formatDecimalString(item.decimal)} = ${item.percent}%.`
          ],
          checkLine: "A percentage is 'out of 100'.",
          reflectionPrompt: "Did you scale the decimal to hundredths before writing the percentage?",
          inputSpec: {
            type: "multi",
            fields: [
              {
                key: "reason",
                label: "Mistake",
                kind: "radio",
                options: [
                  ["times100", "They multiplied by 10 instead of 100."],
                  ["divide", "They should have divided by 100."],
                  ["none", "There is no mistake."]
                ]
              },
              { key: "percent", label: "Correct percentage", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const percentAnswer = parseNumberInput(resp.percent);
            let score = 0;
            if (resp.reason === "times100") score += 1;
            if (percentAnswer === item.percent) score += 1;
            const answerText = `Multiplied by 10 instead of 100; ${item.percent}%`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${formatDecimalString(item.decimal)} = ${item.percent}%.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: "fraction_misconception",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${formatDecimalString(item.decimal)} = ${item.percent}%.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "fdp_error_percent_fraction",
      label: "Error analysis: percentage to fraction",
      domain: "Fractions, decimals and percentages",
      skillIds: ["fdp_equiv", "error_analysis"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const pct = pick(rng, [20, 30, 40, 60, 70, 80]);
        const correct = simplifyFraction(pct, 100);
        const wrongN = pct;
        const wrongD = 10;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `
            <p>A pupil says:</p>
            <div class="callout">“${pct}% = <strong>${fractionToText(wrongN, wrongD)}</strong>.”</div>
            <p>Which mistake has the pupil made, and what is the correct simplified fraction?</p>`,
          solutionLines: [
            `A percentage means 'out of 100', so ${pct}% = ${fractionToText(pct, 100)} before simplifying.`,
            `${fractionToText(pct, 100)} simplifies to ${fractionToText(correct.n, correct.d)}.`
          ],
          checkLine: "Write the percentage over 100 first, then simplify.",
          reflectionPrompt: "Did you start with a denominator of 100 before simplifying the fraction?",
          inputSpec: {
            type: "multi",
            fields: [
              {
                key: "reason",
                label: "Mistake",
                kind: "radio",
                options: [
                  ["denominator", "They used 10 as the denominator instead of 100."],
                  ["numerator", "They should have changed the numerator only."],
                  ["none", "There is no mistake."]
                ]
              },
              { key: "fraction", label: "Correct simplified fraction", kind: "text", placeholder: "e.g. 3/5" }
            ]
          },
          evaluate: (resp) => {
            const fractionAnswer = parseFractionOrNumber(resp.fraction);
            let score = 0;
            if (resp.reason === "denominator") score += 1;
            if (equalNumeric(fractionAnswer, correct.n / correct.d)) score += 1;
            const answerText = `Use denominator 100 first; ${fractionToText(correct.n, correct.d)}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${pct}% = ${fractionToText(correct.n, correct.d)}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: "fraction_denominator_error",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${pct}% = ${fractionToText(correct.n, correct.d)}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "ratio_share_total",
      label: "Share a total in a ratio",
      domain: "Ratio and proportion",
      skillIds: ["ratio_scale"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const [a, b] = pick(rng, [[2, 3], [3, 4], [3, 5], [4, 5], [2, 5], [4, 7]]);
        const unit = randInt(rng, 2, 6);
        const first = a * unit;
        const second = b * unit;
        const total = first + second;
        const [firstName, secondName, collection] = pick(rng, [
          ["red counters", "blue counters", "box"],
          ["apple slices", "orange slices", "fruit tray"],
          ["fiction books", "non-fiction books", "shelf"],
          ["girls", "boys", "club"]
        ]);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>In a ${collection}, the ratio of <strong>${firstName}</strong> to <strong>${secondName}</strong> is <strong>${a}:${b}</strong>.</p><p>There are <strong>${total}</strong> items altogether. How many are ${firstName} and how many are ${secondName}?</p>`,
          solutionLines: [
            `The total number of parts is ${a} + ${b} = ${a + b}.`,
            `Each part is worth ${total} ÷ ${a + b} = ${unit}.`,
            `${firstName}: ${a} × ${unit} = ${first}; ${secondName}: ${b} × ${unit} = ${second}.`
          ],
          checkLine: "Find the total number of equal parts first.",
          reflectionPrompt: "Did you split the total into ratio parts before finding each amount?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "first", label: firstName, kind: "number" },
              { key: "second", label: secondName, kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const firstAnswer = parseNumberInput(resp.first);
            const secondAnswer = parseNumberInput(resp.second);
            let score = 0;
            if (firstAnswer === first) score += 1;
            if (secondAnswer === second) score += 1;
            const answerText = `${first} and ${second}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${firstName}: ${first}; ${secondName}: ${second}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "scaling_confusion",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${firstName}: ${first}; ${secondName}: ${second}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "ratio_share_difference",
      label: "Find amounts from a ratio difference",
      domain: "Ratio and proportion",
      skillIds: ["ratio_scale"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const [a, b] = pick(rng, [[2, 5], [3, 6], [3, 7], [4, 7], [5, 8]]);
        const unit = randInt(rng, 2, 5);
        const first = a * unit;
        const second = b * unit;
        const difference = second - first;
        const [firstName, secondName, context] = pick(rng, [
          ["green beads", "silver beads", "bracelet order"],
          ["child tickets", "adult tickets", "cinema booking"],
          ["small plants", "large plants", "garden display"],
          ["white cubes", "black cubes", "pattern build"]
        ]);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>In a ${context}, the ratio of <strong>${firstName}</strong> to <strong>${secondName}</strong> is <strong>${a}:${b}</strong>.</p><p>There are <strong>${difference}</strong> more ${secondName} than ${firstName}. How many of each are there?</p>`,
          solutionLines: [
            `The difference in the ratio is ${b} - ${a} = ${b - a} parts.`,
            `Each part is worth ${difference} ÷ ${b - a} = ${unit}.`,
            `${firstName}: ${a} × ${unit} = ${first}; ${secondName}: ${b} × ${unit} = ${second}.`
          ],
          checkLine: "Use the difference in the ratio parts, not the total parts.",
          reflectionPrompt: "Did you match the real difference to the difference in the ratio first?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "first", label: firstName, kind: "number" },
              { key: "second", label: secondName, kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const firstAnswer = parseNumberInput(resp.first);
            const secondAnswer = parseNumberInput(resp.second);
            let score = 0;
            if (firstAnswer === first) score += 1;
            if (secondAnswer === second) score += 1;
            const answerText = `${first} and ${second}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${firstName}: ${first}; ${secondName}: ${second}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "scaling_confusion",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${firstName}: ${first}; ${secondName}: ${second}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "ratio_recipe_scale_factor",
      label: "Recipe scale factor and missing amount",
      domain: "Ratio and proportion",
      skillIds: ["ratio_scale", "mul_div_structure"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const factor = randInt(rng, 2, 5);
        const [baseServes, firstBase, secondBase, firstName, secondName, product] = pick(rng, [
          [2, 4, 6, "cups of oats", "spoons of yoghurt", "breakfast pots"],
          [4, 6, 10, "strawberries", "banana slices", "smoothies"],
          [3, 3, 9, "scoops of rice", "carrot sticks", "lunch boxes"],
          [5, 10, 15, "tomato slices", "cucumber slices", "wraps"]
        ]);
        const newServes = baseServes * factor;
        const secondNew = secondBase * factor;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A recipe for <strong>${baseServes}</strong> ${product} uses <strong>${firstBase}</strong> ${firstName} and <strong>${secondBase}</strong> ${secondName}.</p><p>The recipe is scaled to make <strong>${newServes}</strong> ${product}. What is the scale factor, and how many ${secondName} are needed?</p>`,
          solutionLines: [
            `The recipe goes from ${baseServes} to ${newServes}, so the scale factor is ${factor}.`,
            `${secondBase} × ${factor} = ${secondNew}.`
          ],
          checkLine: "Compare the number made first, then scale each ingredient by the same factor.",
          reflectionPrompt: "Did you use the same multiplier for the servings and the ingredient?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "factor", label: "Scale factor", kind: "number" },
              { key: "amount", label: secondName, kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const factorAnswer = parseNumberInput(resp.factor);
            const amountAnswer = parseNumberInput(resp.amount);
            let score = 0;
            if (factorAnswer === factor) score += 1;
            if (amountAnswer === secondNew) score += 1;
            const answerText = `Factor ${factor}; ${secondNew}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The scale factor is ${factor}, so ${secondNew} ${secondName} are needed.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "scaling_confusion",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The scale factor is ${factor}, so ${secondNew} ${secondName} are needed.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "ratio_equivalent_table",
      label: "Equivalent ratio table",
      domain: "Ratio and proportion",
      skillIds: ["ratio_scale"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const [a, b] = pick(rng, [[2, 3], [3, 4], [3, 5], [4, 7], [5, 6]]);
        const factorA = randInt(rng, 2, 4);
        const factorB = randInt(rng, 2, 5);
        const missingSecond = b * factorA;
        const missingFirst = a * factorB;
        const [firstName, secondName] = pick(rng, [
          ["red cubes", "blue cubes"],
          ["cups of squash", "cups of water"],
          ["fiction books", "poetry books"],
          ["chocolate buttons", "marshmallows"]
        ]);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Complete the equivalent ratio table.</p>`,
          visualHtml: tableHtml(
            [firstName, secondName],
            [
              [String(a), String(b)],
              [String(a * factorA), "?"],
              ["?", String(b * factorB)]
            ]
          ),
          solutionLines: [
            `${a} to ${b} scales by ${factorA}, so the missing ${secondName} value is ${missingSecond}.`,
            `${a} to ${b} scales by ${factorB}, so the missing ${firstName} value is ${missingFirst}.`
          ],
          checkLine: "Both parts of an equivalent ratio must be multiplied by the same factor.",
          reflectionPrompt: "Did you keep the scale factor the same across each row?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "second", label: `Missing ${secondName}`, kind: "number" },
              { key: "first", label: `Missing ${firstName}`, kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const secondAnswer = parseNumberInput(resp.second);
            const firstAnswer = parseNumberInput(resp.first);
            let score = 0;
            if (secondAnswer === missingSecond) score += 1;
            if (firstAnswer === missingFirst) score += 1;
            const answerText = `${missingSecond} and ${missingFirst}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The missing values are ${missingSecond} and ${missingFirst}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "scaling_confusion",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The missing values are ${missingSecond} and ${missingFirst}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "ratio_exact_groups_check",
      label: "Check whether a ratio share is exact",
      domain: "Ratio and proportion",
      skillIds: ["ratio_scale"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const [a, b] = pick(rng, [[2, 3], [3, 5], [4, 5], [2, 7], [5, 6]]);
        const groupSize = a + b;
        const groups = randInt(rng, 3, 7);
        const remainder = pick(rng, [0, 1, 2, 3].filter(n => n < groupSize));
        const total = groupSize * groups + remainder;
        const exact = remainder === 0;
        const [firstName, secondName, itemName] = pick(rng, [
          ["red stickers", "green stickers", "stickers"],
          ["strawberry sweets", "lemon sweets", "sweets"],
          ["science books", "history books", "books"],
          ["blue cubes", "yellow cubes", "cubes"]
        ]);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>${total} ${itemName} are to be shared in the ratio <strong>${a}:${b}</strong> of ${firstName} to ${secondName}.</p><p>Can this be done exactly? Answer yes or no, and say how many would be left over after making as many full ratio groups as possible.</p>`,
          solutionLines: [
            `One full ratio group uses ${a + b} ${itemName}.`,
            `${total} = ${groupSize} × ${groups} + ${remainder}.`,
            exact ? `Yes, the share is exact, so the leftover is 0.` : `No, the share is not exact, so ${remainder} would be left over.`
          ],
          checkLine: "See whether the total is a multiple of the whole ratio group.",
          reflectionPrompt: "Did you check the size of one complete ratio group first?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "exact", label: "Can it be exact?", kind: "radio", options: [["yes", "Yes"], ["no", "No"]] },
              { key: "leftover", label: "Left over", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const leftoverAnswer = parseNumberInput(resp.leftover);
            let score = 0;
            if (resp.exact === (exact ? "yes" : "no")) score += 1;
            if (leftoverAnswer === remainder) score += 1;
            const answerText = `${exact ? "Yes" : "No"}; leftover ${remainder}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: exact ? "The total makes complete ratio groups exactly." : `${remainder} would be left over.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "scaling_confusion",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: exact ? "The total makes complete ratio groups exactly." : `${remainder} would be left over.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "ratio_compare_mixtures",
      label: "Compare two mixtures",
      domain: "Ratio and proportion",
      skillIds: ["ratio_scale"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const choice = pick(rng, [
          { leftF: 2, leftW: 3, rightF: 1, rightW: 3, compareWater: 3, leftScaled: 2, rightScaled: 1, larger: "A", difference: 1 },
          { leftF: 2, leftW: 5, rightF: 3, rightW: 10, compareWater: 10, leftScaled: 4, rightScaled: 3, larger: "A", difference: 1 },
          { leftF: 3, leftW: 5, rightF: 4, rightW: 10, compareWater: 10, leftScaled: 6, rightScaled: 4, larger: "A", difference: 2 },
          { leftF: 2, leftW: 6, rightF: 2, rightW: 4, compareWater: 12, leftScaled: 4, rightScaled: 6, larger: "B", difference: 2 },
          { leftF: 3, leftW: 8, rightF: 1, rightW: 2, compareWater: 8, leftScaled: 3, rightScaled: 4, larger: "B", difference: 1 }
        ]);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Compare these juice mixes.</p><p><strong>A</strong>: ${choice.leftF} cups of juice to ${choice.leftW} cups of water</p><p><strong>B</strong>: ${choice.rightF} cups of juice to ${choice.rightW} cups of water</p><p>Which mix is more fruity, and by how many cups of juice per ${choice.compareWater} cups of water?</p>`,
          solutionLines: [
            `For ${choice.compareWater} cups of water, mix A has ${choice.leftScaled} cups of juice.`,
            `For ${choice.compareWater} cups of water, mix B has ${choice.rightScaled} cups of juice.`,
            `${choice.larger} is more fruity by ${choice.difference} cup${choice.difference === 1 ? "" : "s"} of juice.`
          ],
          checkLine: "Scale both mixes so the water amount matches before you compare them.",
          reflectionPrompt: "Did you compare the mixes for the same amount of water?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "larger", label: "More fruity mix", kind: "radio", options: [["A", "A"], ["B", "B"]] },
              { key: "difference", label: `Difference per ${choice.compareWater} cups of water`, kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const differenceAnswer = parseNumberInput(resp.difference);
            let score = 0;
            if (resp.larger === choice.larger) score += 1;
            if (differenceAnswer === choice.difference) score += 1;
            const answerText = `${choice.larger}; difference ${choice.difference}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${choice.larger} is more fruity by ${choice.difference}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "scaling_confusion",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${choice.larger} is more fruity by ${choice.difference}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "ratio_error_additive_scaling",
      label: "Error analysis: additive scaling",
      domain: "Ratio and proportion",
      skillIds: ["ratio_scale", "error_analysis"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const choice = pick(rng, [
          { a: 2, b: 3, factor: 4 },
          { a: 3, b: 5, factor: 4 },
          { a: 4, b: 7, factor: 3 },
          { a: 5, b: 6, factor: 4 }
        ]);
        const targetFirst = choice.a * choice.factor;
        const correctSecond = choice.b * choice.factor;
        const wrongSecond = choice.b + (targetFirst - choice.a);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `
            <p>A pupil says:</p>
            <div class="callout">“If the ratio is ${choice.a}:${choice.b}, then when the first number becomes <strong>${targetFirst}</strong>, the second number becomes <strong>${wrongSecond}</strong>.”</div>
            <p>Which mistake has the pupil made, and what should the second number really be?</p>`,
          solutionLines: [
            `The first number has been multiplied by ${choice.factor}, so the second number must also be multiplied by ${choice.factor}.`,
            `${choice.b} × ${choice.factor} = ${correctSecond}.`
          ],
          checkLine: "Equivalent ratios are made by multiplying or dividing both parts by the same factor.",
          reflectionPrompt: "Did you multiply both parts, rather than add the same amount?",
          inputSpec: {
            type: "multi",
            fields: [
              {
                key: "reason",
                label: "Mistake",
                kind: "radio",
                options: [
                  ["multiply", "They added instead of multiplying by the same factor."],
                  ["swap", "They swapped the two parts of the ratio."],
                  ["none", "There is no mistake."]
                ]
              },
              { key: "second", label: "Correct second number", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const secondAnswer = parseNumberInput(resp.second);
            let score = 0;
            if (resp.reason === "multiply") score += 1;
            if (secondAnswer === correctSecond) score += 1;
            const answerText = `Multiply both parts; ${correctSecond}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The correct second number is ${correctSecond}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "scaling_confusion",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The correct second number is ${correctSecond}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "ratio_simplify_then_scale",
      label: "Simplify a ratio and keep scaling",
      domain: "Ratio and proportion",
      skillIds: ["ratio_scale"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const [simpleA, simpleB] = pick(rng, [[2, 3], [3, 4], [4, 5], [3, 5], [5, 6]]);
        const simplifyFactor = randInt(rng, 2, 5);
        const shownA = simpleA * simplifyFactor;
        const shownB = simpleB * simplifyFactor;
        const targetScale = randInt(rng, 4, 8);
        const targetFirst = simpleA * targetScale;
        const targetSecond = simpleB * targetScale;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>The ratio <strong>${shownA}:${shownB}</strong> can be simplified.</p><p>Write the simplest ratio. Then if the first quantity is <strong>${targetFirst}</strong>, what is the second quantity in the same ratio?</p>`,
          solutionLines: [
            `${shownA}:${shownB} simplifies to ${simpleA}:${simpleB}.`,
            `If the first quantity is ${targetFirst}, the second quantity is ${targetSecond}.`
          ],
          checkLine: "Simplify first so you can see the basic ratio clearly.",
          reflectionPrompt: "Did you find the simplest ratio before scaling it again?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "simpleFirst", label: "First number in simplest ratio", kind: "number" },
              { key: "simpleSecond", label: "Second number in simplest ratio", kind: "number" },
              { key: "scaledSecond", label: "Second quantity", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const simpleFirstAnswer = parseNumberInput(resp.simpleFirst);
            const simpleSecondAnswer = parseNumberInput(resp.simpleSecond);
            const scaledSecondAnswer = parseNumberInput(resp.scaledSecond);
            let score = 0;
            if (simpleFirstAnswer === simpleA && simpleSecondAnswer === simpleB) score += 1;
            if (scaledSecondAnswer === targetSecond) score += 1;
            const answerText = `${simpleA}:${simpleB} and ${targetSecond}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The simplest ratio is ${simpleA}:${simpleB}, so the second quantity is ${targetSecond}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "scaling_confusion",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The simplest ratio is ${simpleA}:${simpleB}, so the second quantity is ${targetSecond}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "ratio_matching_cards",
      label: "Match equivalent ratio cards",
      domain: "Ratio and proportion",
      skillIds: ["ratio_scale"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const [baseA, baseB] = pick(rng, [[2, 3], [3, 5], [4, 7], [5, 6], [3, 4]]);
        const factor = randInt(rng, 2, 4);
        const matching = [baseA * factor, baseB * factor];
        const distractorPool = shuffle([
          [2, 5], [3, 4], [4, 5], [5, 8], [6, 9], [4, 9], [7, 10], [6, 7], [8, 11], [9, 14]
        ].filter(([x, y]) => x * baseB !== y * baseA && x !== matching[0] && y !== matching[1]), rng);
        const wrongCards = distractorPool.slice(0, 2);
        const optionLetters = ["B", "C", "D"];
        const optionPairs = shuffle([
          { letter: "B", pair: matching, correct: true },
          { letter: "C", pair: wrongCards[0], correct: false },
          { letter: "D", pair: wrongCards[1], correct: false }
        ], rng).map((entry, index) => ({ ...entry, letter: optionLetters[index] }));
        const correctLetter = optionPairs.find(entry => entry.correct).letter;
        const options = [["A", `${baseA}:${baseB}`], ...optionPairs.map(entry => [entry.letter, `${entry.pair[0]}:${entry.pair[1]}`])];
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Card <strong>A</strong> shows the ratio <strong>${baseA}:${baseB}</strong>.</p><p>Which other card shows an equivalent ratio, and by what factor has card A been scaled?</p>`,
          visualHtml: renderChoiceList(options),
          solutionLines: [
            `The matching card is ${correctLetter}.`,
            `${baseA}:${baseB} scales by ${factor} to make ${matching[0]}:${matching[1]}.`
          ],
          checkLine: "Check whether both parts have been multiplied by the same factor.",
          reflectionPrompt: "Did you test the same multiplier on both parts of the ratio?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "card", label: "Matching card", kind: "radio", options: optionLetters.map(letter => [letter, letter]) },
              { key: "factor", label: "Scale factor", kind: "number" }
            ]
          },
          evaluate: (resp) => {
            const factorAnswer = parseNumberInput(resp.factor);
            let score = 0;
            if (resp.card === correctLetter) score += 1;
            if (factorAnswer === factor) score += 1;
            const answerText = `${correctLetter}; factor ${factor}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `Card ${correctLetter} matches A, using a scale factor of ${factor}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "scaling_confusion",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `Card ${correctLetter} matches A, using a scale factor of ${factor}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "money_budget_balance_check",
      label: "Budget balance and extra item",
      domain: "Measure and money",
      skillIds: ["add_sub_multistep", "reasonableness"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const firstName = pick(rng, ["notebooks", "plant pots", "museum guides", "juice cartons"]);
        const secondName = pick(rng, ["pens", "stickers", "postcards", "seed packets"]);
        const extraName = pick(rng, ["rubber", "bookmark", "pencil case", "small drink"]);
        const qtyA = randInt(rng, 2, 4);
        const qtyB = randInt(rng, 2, 5);
        const priceA = pick(rng, [125, 150, 175, 220, 240, 275]);
        const priceB = pick(rng, [45, 60, 75, 80, 95, 110, 125]);
        const extraPrice = pick(rng, [55, 70, 85, 90, 110, 125, 140]);
        const enough = pick(rng, [true, false]);
        const remaining = enough ? extraPrice + pick(rng, [10, 15, 20, 25, 30]) : extraPrice - pick(rng, [5, 10, 15, 20]);
        const totalCost = qtyA * priceA + qtyB * priceB;
        const budget = totalCost + remaining;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A pupil has <strong>${formatPenceMoney(budget)}</strong>.</p><p>They buy <strong>${qtyA}</strong> ${firstName} at <strong>${formatPenceMoney(priceA)}</strong> each and <strong>${qtyB}</strong> ${secondName} at <strong>${formatPenceMoney(priceB)}</strong> each.</p><p>How much money is left, and is that enough to buy a ${extraName} costing <strong>${formatPenceMoney(extraPrice)}</strong>?</p>`,
          solutionLines: [
            `Total cost = ${qtyA} × ${formatPenceMoney(priceA)} + ${qtyB} × ${formatPenceMoney(priceB)} = ${formatPenceMoney(totalCost)}.`,
            `${formatPenceMoney(budget)} - ${formatPenceMoney(totalCost)} = ${formatPenceMoney(remaining)} left.`,
            `${formatPenceMoney(remaining)} is ${enough ? "" : "not "}enough for the ${extraName}.`
          ],
          checkLine: "Work out the total cost first, then compare what is left with the extra price.",
          reflectionPrompt: "Did you find the amount left before deciding whether the extra item was affordable?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "left", label: "Money left", kind: "text", placeholder: "e.g. 2.35 or £2.35" },
              { key: "enough", label: "Enough for the extra item?", kind: "radio", options: [["yes", "Yes"], ["no", "No"]] }
            ]
          },
          evaluate: (resp) => {
            const leftAnswer = parseMoneyToPence(resp.left);
            let score = 0;
            if (leftAnswer === remaining) score += 1;
            if (resp.enough === (enough ? "yes" : "no")) score += 1;
            const answerText = `${formatPenceMoney(remaining)}; ${enough ? "yes" : "no"}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${formatPenceMoney(remaining)} is left, so the extra item is ${enough ? "affordable" : "not affordable"}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "reasonableness",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${formatPenceMoney(remaining)} is left, so the extra item is ${enough ? "affordable" : "not affordable"}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "money_best_value_compare",
      label: "Best value offer",
      domain: "Measure and money",
      skillIds: ["mul_div_structure", "reasonableness"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const itemName = pick(rng, ["yoghurt pots", "tennis balls", "muffins", "marker pens"]);
        const choice = pick(rng, [
          { aPack: 4, aPrice: 180, bPack: 6, bPrice: 240, target: 12, better: "B", diff: 60, costA: 540, costB: 480 },
          { aPack: 3, aPrice: 150, bPack: 5, bPrice: 260, target: 15, better: "A", diff: 30, costA: 750, costB: 780 },
          { aPack: 6, aPrice: 330, bPack: 8, bPrice: 420, target: 24, better: "B", diff: 60, costA: 1320, costB: 1260 },
          { aPack: 4, aPrice: 260, bPack: 10, bPrice: 600, target: 20, better: "B", diff: 100, costA: 1300, costB: 1200 }
        ]);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>Shop A sells <strong>${choice.aPack}</strong> ${itemName} for <strong>${formatPenceMoney(choice.aPrice)}</strong>.</p><p>Shop B sells <strong>${choice.bPack}</strong> ${itemName} for <strong>${formatPenceMoney(choice.bPrice)}</strong>.</p><p>Which shop is cheaper for buying <strong>${choice.target}</strong> ${itemName}, and by how much?</p>`,
          solutionLines: [
            `For ${choice.target} ${itemName}, shop A costs ${formatPenceMoney(choice.costA)}.`,
            `For ${choice.target} ${itemName}, shop B costs ${formatPenceMoney(choice.costB)}.`,
            `Shop ${choice.better} is cheaper by ${formatPenceMoney(choice.diff)}.`
          ],
          checkLine: "Scale both offers to the same number of items before comparing prices.",
          reflectionPrompt: "Did you compare the cost for the same quantity, not just the pack prices?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "shop", label: "Cheaper shop", kind: "radio", options: [["A", "A"], ["B", "B"]] },
              { key: "difference", label: "Difference", kind: "text", placeholder: "e.g. 0.60 or £0.60" }
            ]
          },
          evaluate: (resp) => {
            const differenceAnswer = parseMoneyToPence(resp.difference);
            let score = 0;
            if (resp.shop === choice.better) score += 1;
            if (differenceAnswer === choice.diff) score += 1;
            const answerText = `${choice.better}; ${formatPenceMoney(choice.diff)}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `Shop ${choice.better} is cheaper by ${formatPenceMoney(choice.diff)}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "reasonableness",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `Shop ${choice.better} is cheaper by ${formatPenceMoney(choice.diff)}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "money_max_items_with_budget",
      label: "Maximum items from a budget",
      domain: "Measure and money",
      skillIds: ["mul_div_structure", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const itemName = pick(rng, ["cupcakes", "comic books", "bus tickets", "fruit drinks"]);
        const price = pick(rng, [45, 65, 75, 85, 125, 140, 175, 225]);
        const maxItems = randInt(rng, 3, 7);
        const leftover = pick(rng, [5, 10, 15, 20, 25, 30, 35, 40, 50].filter(value => value < price));
        const budget = price * maxItems + leftover;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>One ${itemName.slice(0, -1)} costs <strong>${formatPenceMoney(price)}</strong>.</p><p>A pupil has <strong>${formatPenceMoney(budget)}</strong>.</p><p>What is the greatest number of ${itemName} they can buy, and how much money will be left?</p>`,
          solutionLines: [
            `${formatPenceMoney(budget)} ÷ ${formatPenceMoney(price)} gives ${maxItems} whole ${itemName}.`,
            `The money left is ${formatPenceMoney(leftover)}.`
          ],
          checkLine: "Use division to find the whole number of items, then use the remainder as the money left.",
          reflectionPrompt: "Did you stop at the greatest whole number of items before finding the money left?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "count", label: `Number of ${itemName}`, kind: "number" },
              { key: "leftover", label: "Money left", kind: "text", placeholder: "e.g. 0.25 or £0.25" }
            ]
          },
          evaluate: (resp) => {
            const countAnswer = parseNumberInput(resp.count);
            const leftoverAnswer = parseMoneyToPence(resp.leftover);
            let score = 0;
            if (countAnswer === maxItems) score += 1;
            if (leftoverAnswer === leftover) score += 1;
            const answerText = `${maxItems}; ${formatPenceMoney(leftover)}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `They can buy ${maxItems} ${itemName} and have ${formatPenceMoney(leftover)} left.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "reasonableness",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `They can buy ${maxItems} ${itemName} and have ${formatPenceMoney(leftover)} left.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "money_receipt_missing_price",
      label: "Receipt with a missing price",
      domain: "Measure and money",
      skillIds: ["inverse_missing", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const firstName = pick(rng, ["sketchbook", "museum guide", "plant pot", "lunch box"]);
        const secondName = pick(rng, ["ruler", "postcard", "seed packet", "pencil"]);
        const qtyMissing = randInt(rng, 2, 4);
        const unitMissing = pick(rng, [125, 150, 175, 225, 240, 275]);
        const qtyKnown = randInt(rng, 2, 5);
        const unitKnown = pick(rng, [45, 60, 80, 95, 110, 125]);
        const missingSubtotal = qtyMissing * unitMissing;
        const knownSubtotal = qtyKnown * unitKnown;
        const total = missingSubtotal + knownSubtotal;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A receipt shows <strong>${qtyMissing}</strong> ${firstName}s and <strong>${qtyKnown}</strong> ${secondName}s.</p><p>Each ${secondName} costs <strong>${formatPenceMoney(unitKnown)}</strong>.</p><p>The total bill is <strong>${formatPenceMoney(total)}</strong>.</p><p>What is the price of one ${firstName}, and what is the total cost of all the ${firstName}s?</p>`,
          solutionLines: [
            `${qtyKnown} × ${formatPenceMoney(unitKnown)} = ${formatPenceMoney(knownSubtotal)} for the ${secondName}s.`,
            `${formatPenceMoney(total)} - ${formatPenceMoney(knownSubtotal)} = ${formatPenceMoney(missingSubtotal)} for the ${firstName}s.`,
            `${formatPenceMoney(missingSubtotal)} ÷ ${qtyMissing} = ${formatPenceMoney(unitMissing)} each.`
          ],
          checkLine: "Subtract the known cost from the total before dividing by the number of missing items.",
          reflectionPrompt: "Did you find the subtotal for the missing items before working out one item?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "unitPrice", label: `Price of one ${firstName}`, kind: "text", placeholder: "e.g. 1.25 or £1.25" },
              { key: "subtotal", label: `Cost of all the ${firstName}s`, kind: "text", placeholder: "e.g. 5.00 or £5.00" }
            ]
          },
          evaluate: (resp) => {
            const unitAnswer = parseMoneyToPence(resp.unitPrice);
            const subtotalAnswer = parseMoneyToPence(resp.subtotal);
            let score = 0;
            if (unitAnswer === unitMissing) score += 1;
            if (subtotalAnswer === missingSubtotal) score += 1;
            const answerText = `${formatPenceMoney(unitMissing)} and ${formatPenceMoney(missingSubtotal)}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `One ${firstName} costs ${formatPenceMoney(unitMissing)}, so the ${qtyMissing} ${firstName}s cost ${formatPenceMoney(missingSubtotal)}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "inverse_error",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `One ${firstName} costs ${formatPenceMoney(unitMissing)}, so the ${qtyMissing} ${firstName}s cost ${formatPenceMoney(missingSubtotal)}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "money_voucher_and_gift_card",
      label: "Voucher and gift card balance",
      domain: "Measure and money",
      skillIds: ["add_sub_multistep", "reasonableness"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const total = pick(rng, [1680, 1925, 2140, 2360, 2585, 2890]);
        const voucher = pick(rng, [200, 300, 500, 750]);
        const afterVoucher = total - voucher;
        const cardLeft = pick(rng, [50, 75, 100, 125, 150, 200]);
        const cardBalance = afterVoucher + cardLeft;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A basket costs <strong>${formatPenceMoney(total)}</strong>.</p><p>A voucher takes off <strong>${formatPenceMoney(voucher)}</strong>.</p><p>The shopper pays the rest using a gift card with <strong>${formatPenceMoney(cardBalance)}</strong> on it.</p><p>How much is left to pay after the voucher, and how much money will remain on the gift card?</p>`,
          solutionLines: [
            `${formatPenceMoney(total)} - ${formatPenceMoney(voucher)} = ${formatPenceMoney(afterVoucher)} to pay.`,
            `${formatPenceMoney(cardBalance)} - ${formatPenceMoney(afterVoucher)} = ${formatPenceMoney(cardLeft)} left on the gift card.`
          ],
          checkLine: "Take off the voucher first before comparing with the gift card balance.",
          reflectionPrompt: "Did you work out the reduced price before subtracting from the gift card?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "toPay", label: "Left to pay", kind: "text", placeholder: "e.g. 18.25 or £18.25" },
              { key: "cardLeft", label: "Gift card left", kind: "text", placeholder: "e.g. 1.50 or £1.50" }
            ]
          },
          evaluate: (resp) => {
            const payAnswer = parseMoneyToPence(resp.toPay);
            const cardLeftAnswer = parseMoneyToPence(resp.cardLeft);
            let score = 0;
            if (payAnswer === afterVoucher) score += 1;
            if (cardLeftAnswer === cardLeft) score += 1;
            const answerText = `${formatPenceMoney(afterVoucher)} and ${formatPenceMoney(cardLeft)}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${formatPenceMoney(afterVoucher)} is left to pay, so ${formatPenceMoney(cardLeft)} remains on the gift card.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "reasonableness",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${formatPenceMoney(afterVoucher)} is left to pay, so ${formatPenceMoney(cardLeft)} remains on the gift card.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "money_ticket_option_compare",
      label: "Cheaper ticket option",
      domain: "Measure and money",
      skillIds: ["mul_div_structure", "reasonableness"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const context = pick(rng, ["swimming sessions", "bus journeys", "climbing visits", "cinema trips"]);
        const choice = pick(rng, [
          { single: 190, pass: 680, visits: 4, cheaper: "single", diff: 80, singleTotal: 760 },
          { single: 175, pass: 680, visits: 5, cheaper: "pass", diff: 195, singleTotal: 875 },
          { single: 220, pass: 900, visits: 4, cheaper: "single", diff: 20, singleTotal: 880 },
          { single: 240, pass: 900, visits: 5, cheaper: "pass", diff: 300, singleTotal: 1200 }
        ]);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A single ${context.slice(0, -1)} costs <strong>${formatPenceMoney(choice.single)}</strong>.</p><p>A pass for the same day costs <strong>${formatPenceMoney(choice.pass)}</strong>.</p><p>A pupil needs <strong>${choice.visits}</strong> ${context}.</p><p>Which option is cheaper, and by how much?</p>`,
          solutionLines: [
            `${choice.visits} single ${context} cost ${formatPenceMoney(choice.singleTotal)}.`,
            `The ${choice.cheaper === "pass" ? "pass" : "single tickets"} are cheaper by ${formatPenceMoney(choice.diff)}.`
          ],
          checkLine: "Work out the cost of the singles first, then compare with the pass.",
          reflectionPrompt: "Did you compare the full cost for the number of visits needed?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "option", label: "Cheaper option", kind: "radio", options: [["single", "Single tickets"], ["pass", "Pass"]] },
              { key: "difference", label: "Difference", kind: "text", placeholder: "e.g. 1.95 or £1.95" }
            ]
          },
          evaluate: (resp) => {
            const differenceAnswer = parseMoneyToPence(resp.difference);
            let score = 0;
            if (resp.option === choice.cheaper) score += 1;
            if (differenceAnswer === choice.diff) score += 1;
            const answerText = `${choice.cheaper}; ${formatPenceMoney(choice.diff)}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The ${choice.cheaper === "pass" ? "pass" : "single tickets"} are cheaper by ${formatPenceMoney(choice.diff)}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "reasonableness",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The ${choice.cheaper === "pass" ? "pass" : "single tickets"} are cheaper by ${formatPenceMoney(choice.diff)}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "money_smallest_note_needed",
      label: "Smallest note needed",
      domain: "Measure and money",
      skillIds: ["add_sub_multistep", "reasonableness"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const choice = pick(rng, [
          { coins: 185, total: 635, note: 500, change: 50 },
          { coins: 95, total: 865, note: 1000, change: 230 },
          { coins: 240, total: 1145, note: 1000, change: 95 },
          { coins: 95, total: 1835, note: 2000, change: 260 }
        ]);
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>A pupil already has <strong>${formatPenceMoney(choice.coins)}</strong> in coins.</p><p>An item costs <strong>${formatPenceMoney(choice.total)}</strong>.</p><p>Which is the smallest single note they could add: <strong>£5</strong>, <strong>£10</strong> or <strong>£20</strong>? How much change would they get?</p>`,
          solutionLines: [
            `${formatPenceMoney(choice.coins)} plus the smallest possible note is ${formatPenceMoney(choice.coins + choice.note)}.`,
            `The change would be ${formatPenceMoney(choice.change)}.`
          ],
          checkLine: "Test the smallest note first and only move up if it is still not enough.",
          reflectionPrompt: "Did you choose the smallest note that covers the cost, not just any note that works?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "note", label: "Smallest note", kind: "radio", options: [["500", "£5"], ["1000", "£10"], ["2000", "£20"]] },
              { key: "change", label: "Change", kind: "text", placeholder: "e.g. 0.50 or £0.50" }
            ]
          },
          evaluate: (resp) => {
            const noteAnswer = parseNumberInput(resp.note);
            const changeAnswer = parseMoneyToPence(resp.change);
            let score = 0;
            if (noteAnswer === choice.note) score += 1;
            if (changeAnswer === choice.change) score += 1;
            const answerText = `${formatPenceMoney(choice.note)}; ${formatPenceMoney(choice.change)}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The smallest note is ${formatPenceMoney(choice.note)}, and the change is ${formatPenceMoney(choice.change)}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "reasonableness",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The smallest note is ${formatPenceMoney(choice.note)}, and the change is ${formatPenceMoney(choice.change)}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "money_error_ignore_quantity",
      label: "Error analysis: quantity ignored",
      domain: "Measure and money",
      skillIds: ["error_analysis", "mul_div_structure", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const firstName = pick(rng, ["juice boxes", "exercise books", "seed packets", "postcards"]);
        const secondName = pick(rng, ["muffins", "pens", "plant pots", "museum guides"]);
        const qtyA = randInt(rng, 2, 4);
        const qtyB = randInt(rng, 2, 4);
        const priceA = pick(rng, [120, 135, 150, 180, 225]);
        const priceB = pick(rng, [65, 80, 95, 110, 125]);
        const correctTotal = qtyA * priceA + qtyB * priceB;
        const wrongTotal = priceA + priceB;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `
            <p>A pupil says:</p>
            <div class="callout">“${qtyA} ${firstName} at ${formatPenceMoney(priceA)} and ${qtyB} ${secondName} at ${formatPenceMoney(priceB)} cost <strong>${formatPenceMoney(wrongTotal)}</strong> altogether.”</div>
            <p>Which mistake has the pupil made, and what is the correct total cost?</p>`,
          solutionLines: [
            `The pupil added the unit prices without multiplying by the quantities.`,
            `${qtyA} × ${formatPenceMoney(priceA)} + ${qtyB} × ${formatPenceMoney(priceB)} = ${formatPenceMoney(correctTotal)}.`
          ],
          checkLine: "Multiply each price by its quantity before adding the costs together.",
          reflectionPrompt: "Did you account for how many of each item were bought before adding?",
          inputSpec: {
            type: "multi",
            fields: [
              {
                key: "reason",
                label: "Mistake",
                kind: "radio",
                options: [
                  ["quantity", "They ignored the quantities and only added the unit prices."],
                  ["change", "They worked out the change instead of the total."],
                  ["none", "There is no mistake."]
                ]
              },
              { key: "total", label: "Correct total cost", kind: "text", placeholder: "e.g. 5.20 or £5.20" }
            ]
          },
          evaluate: (resp) => {
            const totalAnswer = parseMoneyToPence(resp.total);
            let score = 0;
            if (resp.reason === "quantity") score += 1;
            if (totalAnswer === correctTotal) score += 1;
            const answerText = `Quantity ignored; ${formatPenceMoney(correctTotal)}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `The correct total cost is ${formatPenceMoney(correctTotal)}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "misread_question",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `The correct total cost is ${formatPenceMoney(correctTotal)}.`,
              answerText
            });
          }
        });
      }
    },
    {
      id: "money_start_amount_after_spending",
      label: "Start amount after spending",
      domain: "Measure and money",
      skillIds: ["inverse_missing", "add_sub_multistep"],
      satsFriendly: true,
      generator(seed) {
        const rng = mulberry32(seed);
        const name = pick(rng, ["Amira", "Ben", "Cara", "Dev"]);
        const itemName = pick(rng, ["museum tickets", "juice cartons", "story books", "fruit tubs"]);
        const qty = randInt(rng, 2, 5);
        const unitPrice = pick(rng, [95, 125, 150, 175, 220, 245]);
        const spent = qty * unitPrice;
        const remaining = pick(rng, [180, 225, 260, 315, 400, 475]);
        const start = spent + remaining;
        return makeBaseQuestion(this, seed, {
          marks: 2,
          stemHtml: `<p>${name} had some money.</p><p>${name} bought <strong>${qty}</strong> ${itemName} at <strong>${formatPenceMoney(unitPrice)}</strong> each and then had <strong>${formatPenceMoney(remaining)}</strong> left.</p><p>How much did ${name} spend, and how much money did ${name} have at the start?</p>`,
          solutionLines: [
            `${qty} × ${formatPenceMoney(unitPrice)} = ${formatPenceMoney(spent)} spent.`,
            `${formatPenceMoney(spent)} + ${formatPenceMoney(remaining)} = ${formatPenceMoney(start)} at the start.`
          ],
          checkLine: "Work out the total spent first, then add the amount left to find the start.",
          reflectionPrompt: "Did you find the spending amount before undoing the story back to the start?",
          inputSpec: {
            type: "multi",
            fields: [
              { key: "spent", label: "Money spent", kind: "text", placeholder: "e.g. 4.50 or £4.50" },
              { key: "start", label: "Money at the start", kind: "text", placeholder: "e.g. 8.25 or £8.25" }
            ]
          },
          evaluate: (resp) => {
            const spentAnswer = parseMoneyToPence(resp.spent);
            const startAnswer = parseMoneyToPence(resp.start);
            let score = 0;
            if (spentAnswer === spent) score += 1;
            if (startAnswer === start) score += 1;
            const answerText = `${formatPenceMoney(spent)} and ${formatPenceMoney(start)}`;
            if (score === 2) {
              return mkResult({
                correct: true, score: 2, maxScore: 2,
                feedbackShort: "Correct.",
                feedbackLong: `${name} spent ${formatPenceMoney(spent)} and started with ${formatPenceMoney(start)}.`,
                answerText
              });
            }
            return mkResult({
              correct: false, score, maxScore: 2,
              misconception: score ? "skipped_step" : "inverse_error",
              feedbackShort: score ? "One part is right." : "Not quite.",
              feedbackLong: `${name} spent ${formatPenceMoney(spent)} and started with ${formatPenceMoney(start)}.`,
              answerText
            });
          }
        });
      }
    }
  ];

  registerExtraTemplates(extraTemplates);

  if (typeof renderAnalytics === "function") renderAnalytics();
})();
