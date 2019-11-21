'use strict';

/**
 * Expose constants, server and request/response classes.
 */

exports = module.exports = require('./lib/server');
exports.Request = require('./lib/request');
exports.Response = require('./lib/response');
exports.constants = require('./lib/constants');

/**
 * Export helpers for extension grants.
 */

exports.AbstractResponseType = require('./lib/response-types/abstract-response-type');
exports.AbstractGrantType = require('./lib/grant-types/abstract-grant-type');

/**
 * Export error classes.
 */

exports.errors ={
  AccessDeniedError: require('./lib/errors/access-denied-error'),
  InvalidArgumentError: require('./lib/errors/invalid-argument-error'),
  InvalidClientError: require('./lib/errors/invalid-client-error'),
  InvalidGrantError: require('./lib/errors/invalid-grant-error'),
  InvalidRequestError: require('./lib/errors/invalid-request-error'),
  InvalidScopeError: require('./lib/errors/invalid-scope-error'),
  InvalidTokenError: require('./lib/errors/invalid-token-error'),
  OAuthError: require('./lib/errors/oauth-error'),
  ServerError: require('./lib/errors/server-error'),
  UnauthorizedClientError: require('./lib/errors/unauthorized-client-error'),
  UnauthorizedRequestError: require('./lib/errors/unauthorized-request-error'),
  UnsupportedGrantTypeError: require('./lib/errors/unsupported-grant-type-error'),
  UnsupportedResponseTypeError: require('./lib/errors/unsupported-response-type-error')
};
