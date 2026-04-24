import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldDispatchClickAction } from '../src/platform/core/dom-actions.js';

function target(tagName, extra = {}) {
  return {
    tagName,
    ...extra,
  };
}

test('native form controls do not dispatch data-action click handlers', () => {
  assert.equal(shouldDispatchClickAction(target('SELECT')), false);
  assert.equal(shouldDispatchClickAction(target('INPUT', { type: 'checkbox' })), false);
  assert.equal(shouldDispatchClickAction(target('TEXTAREA')), false);
  assert.equal(shouldDispatchClickAction(target('FORM')), false);
  assert.equal(shouldDispatchClickAction(target('BUTTON')), true);
});
