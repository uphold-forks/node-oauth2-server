'use strict';

/**
 * Module dependencies.
 */

var AbstractGrantType = require('./abstract-grant-type');
var InvalidArgumentError = require('../errors/invalid-argument-error');
var InvalidGrantError = require('../errors/invalid-grant-error');
var Promise = require('bluebird');
var util = require('util');

/**
 * Constructor.
 */

function ClientCredentialsGrantType(options) {
  options = options || {};

  if (!options.model) {
    throw new InvalidArgumentError('Missing parameter: `model`');
  }

  if (!options.model.getUserFromClient) {
    throw new InvalidArgumentError('Invalid argument: model does not implement `getUserFromClient()`');
  }

  if (!options.model.saveToken) {
    throw new InvalidArgumentError('Invalid argument: model does not implement `saveToken()`');
  }

  AbstractGrantType.call(this, options);
}

/**
 * Inherit prototype.
 */

util.inherits(ClientCredentialsGrantType, AbstractGrantType);

/**
 * Handle client credentials grant.
 *
 * @see https://tools.ietf.org/html/rfc6749#section-4.4.2
 */

ClientCredentialsGrantType.prototype.handle = function(request, client) {
  if (!request) {
    throw new InvalidArgumentError('Missing parameter: `request`');
  }

  if (!client) {
    throw new InvalidArgumentError('Missing parameter: `client`');
  }

  var scope = this.getScope(request);

  return Promise.bind(this)
    .then(function() {
      return this.getUserFromClient(request, client);
    })
    .then(function(user) {
      return this.saveToken(request, user, client, scope);
    });
};

/**
 * Retrieve the user using client credentials.
 */

ClientCredentialsGrantType.prototype.getUserFromClient = function(request, client) {
  return Promise.try(this.model.getUserFromClient, [{ client }, { request }], this.model)
    .then(function(user) {
      if (!user) {
        throw new InvalidGrantError('Invalid grant: user credentials are invalid');
      }

      return user;
    });
};

/**
 * Save token.
 */

ClientCredentialsGrantType.prototype.saveToken = function(request, user, client, scope) {
  var fns = [
    this.generateAccessToken(request),
    this.getAccessTokenExpiresAt()
  ];

  return Promise.all(fns)
    .bind(this)
    .spread(function(accessToken, accessTokenExpiresAt) {
      var token = {
        accessToken: accessToken,
        accessTokenExpiresAt: accessTokenExpiresAt,
        grant: 'client_credentials',
        scope: scope
      };

      return this.model.saveToken({ client, token, user }, { request });
    });
};

/**
 * Export constructor.
 */

module.exports = ClientCredentialsGrantType;
