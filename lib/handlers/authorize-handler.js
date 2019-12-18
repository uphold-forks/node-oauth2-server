'use strict';

/**
 * Module dependencies.
 */

var _ = require('lodash');
var AccessDeniedError = require('../errors/access-denied-error');
var AuthenticateHandler = require('../handlers/authenticate-handler');
var InvalidArgumentError = require('../errors/invalid-argument-error');
var InvalidClientError = require('../errors/invalid-client-error');
var InvalidRequestError = require('../errors/invalid-request-error');
var Promise = require('bluebird');
var Request = require('../request');
var Response = require('../response');
var ServerError = require('../errors/server-error');
var UnsupportedResponseTypeError = require('../errors/unsupported-response-type-error');
var is = require('../validator/is');
var url = require('url');

/**
 * Response types.
 */

var responseTypes = {
  code: require('../response-types/code-response-type')
};

/**
 * Constructor.
 */

function AuthorizeHandler(options) {
  options = options || {};

  if (options.authenticateHandler && !options.authenticateHandler.handle) {
    throw new InvalidArgumentError('Invalid argument: authenticateHandler does not implement `handle()`');
  }

  if (!options.model) {
    throw new InvalidArgumentError('Missing parameter: `model`');
  }

  if (!options.model.getClient) {
    throw new InvalidArgumentError('Invalid argument: model does not implement `getClient()`');
  }

  this.allowEmptyState = options.allowEmptyState;
  this.authenticateHandler = options.authenticateHandler || new AuthenticateHandler(options);
  this.authorizationCodeLifetime = options.authorizationCodeLifetime;
  this.model = options.model;
  this.responseTypes = _.assign({}, responseTypes, options.extendedResponseTypes);
}

/**
 * Authorize Handler.
 */

AuthorizeHandler.prototype.handle = function(request, response) {
  if (!(request instanceof Request)) {
    throw new InvalidArgumentError('Invalid argument: `request` must be an instance of Request');
  }

  if (!(response instanceof Response)) {
    throw new InvalidArgumentError('Invalid argument: `response` must be an instance of Response');
  }

  if ('false' === request.query.allowed) {
    return Promise.reject(new AccessDeniedError('Access denied: user denied access to application'));
  }

  var fns = [
    this.getClient(request),
    this.getUser(request, response)
  ];

  return Promise.all(fns)
    .bind(this)
    .spread(function(client, user) {
      return Promise.bind(this)
        .then(function() {
          return this.handleResponseType(request, client, user);
        })
        .then(function(data) {
          this.updateResponse(response, data.redirectUri);

          return data.result;
        });
    });
};

/**
 * Handle response type.
 */

AuthorizeHandler.prototype.handleResponseType = function(request, client, user) {
  var responseType = request.body.response_type || request.query.response_type;

  if (!responseType) {
    throw new InvalidRequestError('Missing parameter: `response_type`');
  }

  if (!is.nchar(responseType) && !is.uri(responseType)) {
    throw new InvalidRequestError('Invalid parameter: `response_type`');
  }

  if (!_.has(this.responseTypes, responseType)) {
    throw new UnsupportedResponseTypeError('Unsupported response type: `response_type` is invalid');
  }

  var Type = this.responseTypes[responseType];
  var options = {
    allowEmptyState: this.allowEmptyState,
    authorizationCodeLifetime: this.authorizationCodeLifetime,
    model: this.model,
  };

  return new Type(options)
    .handle(request, client, user);
};

/**
 * Get the client from the model.
 */

AuthorizeHandler.prototype.getClient = function(request) {
  var clientId = request.body.client_id || request.query.client_id;

  if (!clientId) {
    throw new InvalidRequestError('Missing parameter: `client_id`');
  }

  if (!is.vschar(clientId)) {
    throw new InvalidRequestError('Invalid parameter: `client_id`');
  }

  var redirectUri = request.body.redirect_uri || request.query.redirect_uri;

  if (redirectUri && !is.uri(redirectUri)) {
    throw new InvalidRequestError('Invalid request: `redirect_uri` is not a valid URI');
  }

  return Promise.try(this.model.getClient, [clientId, { request }], this.model)
    .then(function(client) {
      if (!client) {
        throw new InvalidClientError('Invalid client: client credentials are invalid');
      }

      if (!client.grants) {
        throw new InvalidClientError('Invalid client: missing client `grants`');
      }

      if (!(client.grants instanceof Array)) {
        throw new InvalidClientError('Invalid client: `grants` must be an array');
      }

      if (!client.redirectUris || 0 === client.redirectUris.length) {
        throw new InvalidClientError('Invalid client: missing client `redirectUri`');
      }

      if (redirectUri && !_.includes(client.redirectUris, redirectUri)) {
        throw new InvalidClientError('Invalid client: `redirect_uri` does not match client value');
      }

      return client;
    });
};

/**
 * Get user by calling the authenticate middleware.
 */

AuthorizeHandler.prototype.getUser = function(request, response) {
  if (this.authenticateHandler instanceof AuthenticateHandler) {
    return this.authenticateHandler.handle(request, response).get('user');
  }

  return Promise.try(this.authenticateHandler.handle, [request, response]).then(function(user) {
    if (!user) {
      throw new ServerError('Server error: `handle()` did not return a `user` object');
    }

    return user;
  });
};

/**
 * Get redirect URI.
 */

AuthorizeHandler.prototype.getRedirectUri = function(request, client) {
  return request.body.redirect_uri || request.query.redirect_uri || client.redirectUris[0];
};

/**
 * Update response with the redirect uri.
 */

AuthorizeHandler.prototype.updateResponse = function(response, redirectUri) {
  redirectUri.query = redirectUri.query || {};

  response.redirect(url.format(redirectUri));
};

/**
 * Export constructor.
 */

module.exports = AuthorizeHandler;
