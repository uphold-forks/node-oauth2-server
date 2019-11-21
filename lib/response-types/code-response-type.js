'use strict';

/**
 * Module dependencies.
 */

var _ = require('lodash');
var AbstractResponseType = require('./abstract-response-type');
var InvalidArgumentError = require('../errors/invalid-argument-error');
var InvalidRequestError = require('../errors/invalid-request-error');
var InvalidScopeError = require('../errors/invalid-scope-error');
var OAuthError = require('../errors/oauth-error');
var Promise = require('bluebird');
var ServerError = require('../errors/server-error');
var UnauthorizedClientError = require('../errors/unauthorized-client-error');
var is = require('../validator/is');
var tokenUtil = require('../utils/token-util');
var url = require('url');
var util = require('util');

/**
 * Constructor.
 */

function CodeResponseType(options) {
  options = options || {};

  AbstractResponseType.call(this, options);

  if (!options.model.saveAuthorizationCode) {
    throw new InvalidArgumentError('Invalid argument: model does not implement `saveAuthorizationCode()`');
  }


  this.allowEmptyState = options.allowEmptyState;
}

/**
 * Inherit prototype.
 */

util.inherits(CodeResponseType, AbstractResponseType);

/**
 * Handle `code` response type.
 *
 * @see https://tools.ietf.org/html/rfc6749#section-4.1.3
 */

CodeResponseType.prototype.handle = function(request, client, user) {
  if (!request) {
    throw new InvalidArgumentError('Missing parameter: `request`');
  }

  if (!client) {
    throw new InvalidArgumentError('Missing parameter: `client`');
  }

  if (!_.includes(client.grants, 'authorization_code')) {
    throw new UnauthorizedClientError('Unauthorized client: `grant_type` is invalid');
  }

  var uri = this.getRedirectUri(request, client);
  var state;

  return Promise.bind(this)
    .then(function() {
      return this.generateAuthorizationCode();
    })
    .then(function(authorizationCode) {
      var scope = this.getScope(request);
      var expiresAt = this.getAuthorizationCodeLifetime();

      return this.saveAuthorizationCode(authorizationCode, expiresAt, scope, client, uri, user);
    })
    .tap(function() {
      state = this.getState(request);
    })
    .then(function(code) {
      return { redirectUri: this.buildSuccessRedirectUri(uri, { code: code.authorizationCode, state }), result: code };
    })
    .catch(function(e) {
      if (!(e instanceof OAuthError)) {
        e = new ServerError(e);
      }

      if (state) {
        return { redirectUri: this.buildErrorRedirectUri(uri, { error: e, query: { state } }), result: e };
      } else {
        return { redirectUri: this.buildErrorRedirectUri(uri, { error: e }), result: e };
      }
    });

};

/**
 * Generate authorization code.
 */

CodeResponseType.prototype.generateAuthorizationCode = function() {
  if (this.model.generateAuthorizationCode) {
    return Promise.try(this.model.generateAuthorizationCode, [], this.model);
  }

  return tokenUtil.generateRandomToken();
};

/**
 * Get authorization code lifetime.
 */

CodeResponseType.prototype.getAuthorizationCodeLifetime = function() {
  var expires = new Date();

  expires.setSeconds(expires.getSeconds() + this.authorizationCodeLifetime);

  return expires;
};

/**
 * Get scope from the request.
 */

CodeResponseType.prototype.getScope = function(request) {
  var scope = request.body.scope || request.query.scope;

  if (!is.nqschar(scope)) {
    throw new InvalidScopeError('Invalid parameter: `scope`');
  }

  return scope;
};

/**
 * Get state from the request.
 */

CodeResponseType.prototype.getState = function(request) {
  var state = request.body.state || request.query.state;

  if (!this.allowEmptyState && !state) {
    throw new InvalidRequestError('Missing parameter: `state`');
  }

  if (!is.vschar(state)) {
    throw new InvalidRequestError('Invalid parameter: `state`');
  }

  return state;
};

/**
 * Get redirect URI.
 */

CodeResponseType.prototype.getRedirectUri = function(request, client) {
  return request.body.redirect_uri || request.query.redirect_uri || client.redirectUris[0];
};

/**
 * Save authorization code.
 */

CodeResponseType.prototype.saveAuthorizationCode = function(authorizationCode, expiresAt, scope, client, redirectUri, user) {
  var code = {
    authorizationCode: authorizationCode,
    expiresAt: expiresAt,
    redirectUri: redirectUri,
    scope: scope
  };

  return Promise.try(this.model.saveAuthorizationCode, [code, client, user], this.model);
};

/**
 * Build a successful response that redirects the user-agent to the client-provided url.
 */

CodeResponseType.prototype.buildSuccessRedirectUri = function(redirectUri, query) {
  if (!redirectUri) {
    throw new InvalidArgumentError('Missing parameter: `redirectUri`');
  }

  var uri = url.parse(redirectUri, true);

  Object.assign(uri.query, query);

  uri.search = null;

  return uri;
};

/**
 * Export constructor.
 */

module.exports = CodeResponseType;
