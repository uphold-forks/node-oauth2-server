'use strict';

/**
 * Module dependencies.
 */

var InvalidArgumentError = require('../errors/invalid-argument-error');
var InvalidScopeError = require('../errors/invalid-scope-error');
var Promise = require('bluebird');
var is = require('../validator/is');
var url = require('url');

/**
 * Constructor.
 */

function AbstractResponseType(options) {
  options = options || {};

  if (!options.authorizationCodeLifetime) {
    throw new InvalidArgumentError('Missing parameter: `authorizationCodeLifetime`');
  }

  if (!options.model) {
    throw new InvalidArgumentError('Missing parameter: `model`');
  }

  this.authorizationCodeLifetime = options.authorizationCodeLifetime;
  this.model = options.model;
}

/**
 * Build an error response that redirects the user-agent to the client-provided url.
 */

AbstractResponseType.prototype.buildErrorRedirectUri = function(redirectUri, options) {
  options = options || {};

  if (!redirectUri) {
    throw new InvalidArgumentError('Missing parameter: `redirectUri`');
  }

  var uri = url.parse(redirectUri);

  uri.query = {};

  if (options.error) {
    uri.query.error = options.error.name;

    if (options.error.message) {
      uri.query.error_description = options.error.message;
    }
  }

  Object.assign(uri.query, options.query);

  return uri;
};

/**
 * Get scope from the request body.
 */

AbstractResponseType.prototype.getScope = function(request) {
  if (!is.nqschar(request.body.scope)) {
    throw new InvalidArgumentError('Invalid parameter: `scope`');
  }

  return request.body.scope;
};

/**
 * Validate requested scope.
 */

AbstractResponseType.prototype.validateScope = function(request, user, client, scope) {
  if (this.model.validateScope) {
    return Promise.try(this.model.validateScope, [{ client, scope, user }, { request }], this.model)
      .then(function(scope) {
        if (!scope) {
          throw new InvalidScopeError('Invalid scope: Requested scope is invalid');
        }

        return scope;
      });
  } else {
    return scope;
  }
};

/**
 * Export constructor.
 */

module.exports = AbstractResponseType;
