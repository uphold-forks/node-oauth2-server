'use strict';

/**
 * Module dependencies.
 */

var OAuthError = require('../../../lib/errors/oauth-error');
var should = require('should');

/**
 * Test `OAuthError` integration.
 */

describe('OAuthError integration', function() {
  it('should append the stacktrace for inner errors', function() {
    const innerError = new OAuthError('foobar', { code: 500, name: 'inner_error' });
    const oauthError = new OAuthError(innerError, { code: 500, name: 'oauth_error' });

    oauthError.stack.should.match(/oauth_error: foobar/)
    oauthError.stack.should.match(/inner_error: foobar/)
  });
});
