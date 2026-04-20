import { createPlaceholderSubject } from './module-factory.js';

export const arithmeticModule = createPlaceholderSubject({
  id: 'arithmetic',
  name: 'Arithmetic',
  blurb: 'Build speed and fluency with the four operations.',
  accent: '#C06B3E',
  accentSoft: '#F5DDCE',
  accentTint: '#FBEEE4',
  icon: 'plus',
});

export const reasoningModule = createPlaceholderSubject({
  id: 'reasoning',
  name: 'Reasoning',
  blurb: 'Multi-step maths: plan, work it out, check.',
  accent: '#8A5A9D',
  accentSoft: '#E6D9ED',
  accentTint: '#F1E9F4',
  icon: 'brain',
});

export const grammarModule = createPlaceholderSubject({
  id: 'grammar',
  name: 'Grammar',
  blurb: 'Word classes, clauses, tenses and sentence shape.',
  accent: '#2E8479',
  accentSoft: '#CFE8E3',
  accentTint: '#E3F1EE',
  icon: 'speech',
});

export const punctuationModule = createPlaceholderSubject({
  id: 'punctuation',
  name: 'Punctuation',
  blurb: 'Commas, apostrophes, speech marks and more.',
  accent: '#B8873F',
  accentSoft: '#F0E1C4',
  accentTint: '#F7EEDC',
  icon: 'quote',
});

export const readingModule = createPlaceholderSubject({
  id: 'reading',
  name: 'Reading',
  blurb: 'Retrieve, infer and explain from passages.',
  accent: '#4B7A4A',
  accentSoft: '#D9E7D7',
  accentTint: '#E8F0E6',
  icon: 'book',
});
