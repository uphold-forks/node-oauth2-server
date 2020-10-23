'use strict';

/**
 * Module dependencies.
 */

var AccessDeniedError = require('../../../lib/errors/access-denied-error');
var AuthenticateHandler = require('../../../lib/handlers/authenticate-handler');
var AuthorizeHandler = require('../../../lib/handlers/authorize-handler');
var InvalidArgumentError = require('../../../lib/errors/invalid-argument-error');
var InvalidClientError = require('../../../lib/errors/invalid-client-error');
var InvalidRequestError = require('../../../lib/errors/invalid-request-error');
var Promise = require('bluebird');
var Request = require('../../../lib/request');
var Response = require('../../../lib/response');
var ServerError = require('../../../lib/errors/server-error');
var UnsupportedResponseType = require('../../../lib/errors/unsupported-response-type-error');
var should = require('should');
var url = require('url');

/**
 * Test `AuthorizeHandler` integration.
 */

describe('AuthorizeHandler integration', function() {
  describe('constructor()', function() {
    it('should throw an error if `options.model` is missing', function() {
      try {
        new AuthorizeHandler({ authorizationCodeLifetime: 120 });

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidArgumentError);
        e.message.should.equal('Missing parameter: `model`');
      }
    });

    it('should throw an error if the model does not implement `getClient()`', function() {
      try {
        new AuthorizeHandler({ authorizationCodeLifetime: 120, model: {} });

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidArgumentError);
        e.message.should.equal('Invalid argument: model does not implement `getClient()`');
      }
    });

    it('should throw an error if the model does not implement `getAccessToken()`', function() {
      var model = {
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };

      try {
        new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidArgumentError);
        e.message.should.equal('Invalid argument: model does not implement `getAccessToken()`');
      }
    });

    it('should set the `authenticateHandler`', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });

      handler.authenticateHandler.should.be.an.instanceOf(AuthenticateHandler);
    });

    it('should set the `model`', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });

      handler.model.should.equal(model);
    });
  });

  describe('handle()', function() {
    it('should throw an error if `request` is missing', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });

      try {
        handler.handle();

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidArgumentError);
        e.message.should.equal('Invalid argument: `request` must be an instance of Request');
      }
    });

    it('should throw an error if `response` is missing', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({ body: {}, headers: {}, method: {}, query: {} });

      try {
        handler.handle(request);

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidArgumentError);
        e.message.should.equal('Invalid argument: `response` must be an instance of Response');
      }
    });

    it('should throw an error if `allowed` is `false`', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({ body: {}, headers: {}, method: {}, query: { allowed: 'false' } });
      var response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(should.fail, function(e) {
          e.should.be.an.instanceOf(AccessDeniedError);
          e.message.should.equal('Access denied: user denied access to application');
        });
    });

    it('should redirect to an error response if a non-oauth error is thrown', function() {
      var model = {
        getAccessToken: function() {
          return { user: {} };
        },
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
        },
        saveAuthorizationCode: function() {
          throw new Error('Unhandled exception');
        }
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({
        body: {
          client_id: 12345,
          grant_type: 'authorization_code',
          response_type: 'code'
        },
        headers: {
          'Authorization': 'Bearer foo'
        },
        method: {},
        query: {
          state: 'foobar'
        }
      });
      var response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(should.fail)
        .catch(function() {
          response.get('location').should.equal('http://example.com/cb?error=server_error&error_description=Unhandled%20exception');
      });
    });

    it('should redirect to an error response if an oauth error is thrown', function() {
      var model = {
        getAccessToken: function() {
          return { user: {} };
        },
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
        },
        saveAuthorizationCode: function() {
          throw new AccessDeniedError('Cannot request this auth code');
        }
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({
        body: {
          client_id: 12345,
          grant_type: 'authorization_code',
          response_type: 'code'
        },
        headers: {
          'Authorization': 'Bearer foo'
        },
        method: {},
        query: {
          state: 'foobar'
        }
      });
      var response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(should.fail)
        .catch(function() {
          response.get('location').should.equal('http://example.com/cb?error=access_denied&error_description=Cannot%20request%20this%20auth%20code');
        });
    });

    it('should redirect to a successful response with `code` and `state` if successful', function() {
      var client = { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
      var model = {
        getAccessToken: function() {
          return { client: client, user: {} };
        },
        getClient: function() {
          return client;
        },
        saveAuthorizationCode: function() {
          return { authorizationCode: 12345, client: client };
        }
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({
        body: {
          client_id: 12345,
          grant_type: 'authorization_code',
          response_type: 'code'
        },
        headers: {
          'Authorization': 'Bearer foo'
        },
        method: {},
        query: {
          state: 'foobar'
        }
      });
      var response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(function() {
          response.get('location').should.equal('http://example.com/cb?code=12345&state=foobar');
        })
        .catch(should.fail);
    });

    it('should redirect to an error response if `scope` is invalid', function() {
      var model = {
        getAccessToken: function() {
          return { user: {} };
        },
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
        },
        saveAuthorizationCode: function() {
          return {};
        }
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({
        body: {
          client_id: 12345,
          grant_type: 'authorization_code',
          response_type: 'code'
        },
        headers: {
          'Authorization': 'Bearer foo'
        },
        method: {},
        query: {
          scope: [],
          state: 'foobar'
        }
      });
      var response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(should.fail)
        .catch(function() {
          response.get('location').should.equal('http://example.com/cb?error=invalid_scope&error_description=Invalid%20parameter%3A%20%60scope%60');
        });
    });

    it('should redirect to an error response if `state` is missing', function() {
      var client = { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
      var model = {
        getAccessToken: function() {
          return { user: {} };
        },
        getClient: function() {
          return client;
        },
        saveAuthorizationCode: function() {
          return { authorizationCode: 12345, client: client };
        }
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({
        body: {
          client_id: 12345,
          grant_type: 'authorization_code',
          response_type: 'code'
        },
        headers: {
          'Authorization': 'Bearer foo'
        },
        method: {},
        query: {}
      });
      var response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(should.fail)
        .catch(function() {
          response.get('location').should.equal('http://example.com/cb?error=invalid_request&error_description=Missing%20parameter%3A%20%60state%60');
        });
    });

    it('should throw an error if `response_type` is missing', function() {
      var model = {
        getAccessToken: function() {
          return {
            user: {},
            accessTokenExpiresAt: new Date(new Date().getTime() + 10000)
          };
        },
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
        },
        saveAuthorizationCode: function() {
          return { authorizationCode: 12345, client: {} };
        }
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({
        body: {
          client_id: 12345,
          grant_type: 'authorization_code'
        },
        headers: {
          'Authorization': 'Bearer foo'
        },
        method: {},
        query: {
          state: 'foobar'
        }
      });
      var response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(should.fail, function(e) {
          e.should.be.an.instanceOf(InvalidRequestError);
          e.message.should.equal('Missing parameter: `response_type`');
        });
    });

    it('should throw an error if `response_type` is not invalid', function() {
      var model = {
        getAccessToken: function() {
          return {
            user: {},
            accessTokenExpiresAt: new Date(new Date().getTime() + 10000)
          };
        },
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
        },
        saveAuthorizationCode: function(code) {
          return code;
        }
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({
        body: {
          client_id: 12345,
          grant_type: 'authorization_code',
          response_type: {}
        },
        headers: {
          'Authorization': 'Bearer foo'
        },
        method: {},
        query: {
          state: 'foobar'
        }
      });
      var response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(should.fail, function(e) {
          e.should.be.an.instanceOf(InvalidRequestError);
          e.message.should.equal('Invalid parameter: `response_type`');
        });
    });

    it('should throw an error if `response_type` is not supported', function() {
      var model = {
        getAccessToken: function() {
          return {
            user: {},
            accessTokenExpiresAt: new Date(new Date().getTime() + 10000)
          };
        },
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
        },
        saveAuthorizationCode: function(code) {
          return code;
        }
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({
        body: {
          client_id: 12345,
          grant_type: 'authorization_code',
          response_type: 'test'
        },
        headers: {
          'Authorization': 'Bearer foo'
        },
        method: {},
        query: {
          state: 'foobar'
        }
      });
      var response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(should.fail, function(e) {
          e.should.be.an.instanceOf(UnsupportedResponseType);
          e.message.should.equal('Unsupported response type: `response_type` is invalid');
        });
    });

    it('should rethrow errors', function() {
      var model = {
        getAccessToken: function() {
          return { user: {} };
        },
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
        },
        saveAuthorizationCode: function() {
          return {};
        }
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({
        body: {
          client_id: 12345,
          grant_type: 'authorization_code',
          response_type: 'code'
        },
        headers: {
          'Authorization': 'Bearer foo'
        },
        method: {},
        query: {
          scope: [],
          state: 'foobar'
        }
      });
      var response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(should.fail, function(e) {
          console.log('hi', e)
          response.get('location').should.equal('http://example.com/cb?error=invalid_scope&error_description=Invalid%20parameter%3A%20%60scope%60');
        });
    });

    it('should return the `code` if successful', function() {
      var client = { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
      var model = {
        getAccessToken: function() {
          return { client: client, user: {} };
        },
        getClient: function() {
          return client;
        },
        saveAuthorizationCode: function() {
          return { authorizationCode: 12345, client: client };
        }
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({
        body: {
          client_id: 12345,
          grant_type: 'authorization_code',
          response_type: 'code'
        },
        headers: {
          'Authorization': 'Bearer foo'
        },
        method: {},
        query: {
          state: 'foobar'
        }
      });
      var response = new Response({ body: {}, headers: {} });

      return handler.handle(request, response)
        .then(function() {
          response.get('location').should.equal('http://example.com/cb?code=12345&state=foobar');
        });
    });
  });

  describe('getClient()', function() {
    it('should throw an error if `client_id` is missing', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({ body: { response_type: 'code' }, headers: {}, method: {}, query: {} });

      try {
        handler.getClient(request);

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidRequestError);
        e.message.should.equal('Missing parameter: `client_id`');
      }
    });

    it('should throw an error if `client_id` is invalid', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({ body: { client_id: 'øå€£‰', response_type: 'code' }, headers: {}, method: {}, query: {} });

      try {
        handler.getClient(request);

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidRequestError);
        e.message.should.equal('Invalid parameter: `client_id`');
      }
    });

    it('should throw an error if `client.redirectUri` is invalid', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({ body: { client_id: 12345, response_type: 'code', redirect_uri: 'foobar' }, headers: {}, method: {}, query: {} });

      try {
        handler.getClient(request);

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidRequestError);
        e.message.should.equal('Invalid request: `redirect_uri` is not a valid URI');
      }
    });

    it('should throw an error if `client` is missing', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({ body: { client_id: 12345, response_type: 'code' }, headers: {}, method: {}, query: {} });

      return handler.getClient(request)
        .then(should.fail, function(e) {
          e.should.be.an.instanceOf(InvalidClientError);
          e.message.should.equal('Invalid client: client credentials are invalid');
        });
    });

    it('should throw an error if `client` is missing', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({ body: { client_id: 12345, response_type: 'code' }, headers: {}, method: {}, query: {} });

      return handler.getClient(request)
        .then(should.fail, function(e) {
          e.should.be.an.instanceOf(InvalidClientError);
          e.message.should.equal('Invalid client: client credentials are invalid');
        });
    });

    it('should throw an error if `client.grants` is missing', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {
          return {};
        },
        saveAuthorizationCode: function() {}
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({ body: { client_id: 12345, response_type: 'code' }, headers: {}, method: {}, query: {} });

      return handler.getClient(request)
        .then(should.fail, function(e) {
          e.should.be.an.instanceOf(InvalidClientError);
          e.message.should.equal('Invalid client: missing client `grants`');
        });
    });

    it('should throw an error if `client.grants` is invalid', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {
          return { grants: 'foobar' };
        },
        saveAuthorizationCode: function() {}
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({ body: { client_id: 12345, response_type: 'code' }, headers: {}, method: {}, query: {} });

      return handler.getClient(request)
        .then(should.fail, function(e) {
          e.should.be.an.instanceOf(InvalidClientError);
          e.message.should.equal('Invalid client: `grants` must be an array');
        });
    });

    it('should throw an error if `client.redirectUri` is missing', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() { return { grants: ['authorization_code'] }; },
        saveAuthorizationCode: function() {}
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({ body: { client_id: 12345, response_type: 'code' }, headers: {}, method: {}, query: {} });

      return handler.getClient(request)
        .then(should.fail, function(e) {
          e.should.be.an.instanceOf(InvalidClientError);
          e.message.should.equal('Invalid client: missing client `redirectUri`');
        });
    });

    it('should throw an error if `client.redirectUri` is not equal to `redirectUri`', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['https://example.com'] };
        },
        saveAuthorizationCode: function() {}
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({ body: { client_id: 12345, response_type: 'code', redirect_uri: 'https://foobar.com' }, headers: {}, method: {}, query: {} });

      return handler.getClient(request)
        .then(should.fail, function(e) {
          e.should.be.an.instanceOf(InvalidClientError);
          e.message.should.equal('Invalid client: `redirect_uri` does not match client value');
        });
    });

    it('should support promises', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {
          return Promise.resolve({ grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] });
        },
        saveAuthorizationCode: function() {}
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({
        body: { client_id: 12345 },
        headers: {},
        method: {},
        query: {}
      });

      handler.getClient(request).should.be.an.instanceOf(Promise);
    });

    it('should support non-promises', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
        },
        saveAuthorizationCode: function() {}
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({
        body: { client_id: 12345 },
        headers: {},
        method: {},
        query: {}
      });

      handler.getClient(request).should.be.an.instanceOf(Promise);
    });

    describe('with `client_id` in the request body', function() {
      it('should return a client', function() {
        var client = { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
        var model = {
          getAccessToken: function() {},
          getClient: function() {
            return client;
          },
          saveAuthorizationCode: function() {}
        };
        var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
        var request = new Request({ body: { client_id: 12345, response_type: 'code' }, headers: {}, method: {}, query: {} });

        return handler.getClient(request)
          .then(function(data) {
            data.should.equal(client);
          })
          .catch(should.fail);
      });
    });

    describe('with `client_id` in the request query', function() {
      it('should return a client', function() {
        var client = { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
        var model = {
          getAccessToken: function() {},
          getClient: function() {
            return client;
          },
          saveAuthorizationCode: function() {}
        };
        var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
        var request = new Request({ body: { response_type: 'code' }, headers: {}, method: {}, query: { client_id: 12345 } });

        return handler.getClient(request)
          .then(function(data) {
            data.should.equal(client);
          })
          .catch(should.fail);
      });
    });
  });

  describe('getUser()', function() {
    it('should throw an error if `user` is missing', function() {
      var authenticateHandler = { handle: function() {} };
      var model = {
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new AuthorizeHandler({ authenticateHandler: authenticateHandler, authorizationCodeLifetime: 120, model: model });
      var request = new Request({ body: {}, headers: {}, method: {}, query: {} });
      var response = new Response();

      return handler.getUser(request, response)
        .then(should.fail, function(e) {
          e.should.be.an.instanceOf(ServerError);
          e.message.should.equal('Server error: `handle()` did not return a `user` object');
        });
    });

    it('should return a user', function() {
      var user = {};
      var model = {
        getAccessToken: function() {
          return { user: user };
        },
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({ body: {}, headers: { 'Authorization': 'Bearer foo' }, method: {}, query: {} });
      var response = new Response({ body: {}, headers: {} });

      return handler.getUser(request, response)
        .then(function(data) {
          data.should.equal(user);
        })
        .catch(should.fail);
    });
  });

  describe('updateResponse()', function() {
    it('should set the `location` header', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new AuthorizeHandler({ authorizationCodeLifetime: 120, model: model });
      var response = new Response({ body: {}, headers: {} });
      var uri = url.parse('http://example.com/cb?state=foobar');

      handler.updateResponse(response, uri);

      response.get('location').should.equal('http://example.com/cb?state=foobar');
    });
  });
});
