import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {StandaloneStakeholderAcceptance} from '../src/components/StandaloneStakeholderAcceptance';
test('isolated screen advertises real authorization boundary, not public signup',()=>{
 const rendered=renderToStaticMarkup(React.createElement(StandaloneStakeholderAcceptance));
 for(const value of ['NexusTalent','type="email"','type="password"','Public registration is not active','Sign in'])assert.ok(rendered.includes(value),value);
 assert.equal(rendered.includes('firebase'),false);
 assert.equal(rendered.includes('Create account'),false);
});
