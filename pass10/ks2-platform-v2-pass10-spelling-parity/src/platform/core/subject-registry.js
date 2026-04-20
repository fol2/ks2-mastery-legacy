import { buildSubjectRegistry } from './subject-contract.js';
import { spellingModule } from '../../subjects/spelling/module.js';
import {
  arithmeticModule,
  reasoningModule,
  grammarModule,
  punctuationModule,
  readingModule,
} from '../../subjects/placeholders/index.js';

const RAW_SUBJECTS = [
  spellingModule,
  arithmeticModule,
  reasoningModule,
  grammarModule,
  punctuationModule,
  readingModule,
];

export const SUBJECTS = buildSubjectRegistry(RAW_SUBJECTS);

export const SUBJECT_MAP = Object.freeze(Object.fromEntries(SUBJECTS.map((subject) => [subject.id, subject])));

export function getSubject(subjectId) {
  return SUBJECT_MAP[subjectId] || SUBJECTS[0];
}

export { buildSubjectRegistry } from './subject-contract.js';
