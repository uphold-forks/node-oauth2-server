'use strict';

/**
 * Module dependencies.
 */

var CodeResponseType = require('../../../lib/response-types/code-response-type');
var InvalidArgumentError = require('../../../lib/errors/invalid-argument-error');
var InvalidRequestError = require('../../../lib/errors/invalid-request-error');
var InvalidScopeError = require('../../../lib/errors/invalid-scope-error');
var Promise = require('bluebird');
var Request = require('../../../lib/request');
var ServerError = require('../../../lib/errors/server-error');
var UnauthorizedClientError = require('../../../lib/errors/unauthorized-client-error');
var should = require('should');
var url = require('url');

/**
 * Test `CodeResponseType` integration.
 */

describe('CodeResponseType integration', function() {
  describe('constructor()', function() {
    it('should throw an error if the model does not implement `saveAuthorizationCode()`', function() {
      try {
        new CodeResponseType({ authorizationCodeLifetime: 120, model: {} });

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidArgumentError);
        e.message.should.equal('Invalid argument: model does not implement `saveAuthorizationCode()`');
      }
    });

    it('should set the `allowEmptyState`', function() {
      var model = {
        saveAuthorizationCode: function() {}
      };
      var handler = new CodeResponseType({ allowEmptyState: true, authorizationCodeLifetime: 120, model: model });

      handler.allowEmptyState.should.equal(true);
    });
  });

  describe('handle()', function() {
    it('should throw an error if `request` is missing', function() {
      var model = {
        generateAuthorizationCode: function() {
          return Promise.resolve({});
        },
        saveAuthorizationCode: function() {}
      };
      var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });

      try {
        handler.handle();

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidArgumentError);
        e.message.should.equal('Missing parameter: `request`');
      }
    });

    it('should throw an error if `client` is missing', function() {
      var model = {
        generateAuthorizationCode: function() {
          return Promise.resolve({});
        },
        saveAuthorizationCode: function() {}
      };
      var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({ body: { scope: 'foo' }, headers: {}, method: {}, query: {} });

      try {
        handler.handle(request);

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidArgumentError);
        e.message.should.equal('Missing parameter: `client`');
      }
    });

    it('should throw an error if client is not authorized', function() {
      var client = {
        grants: ['foobar'],
        redirectUris: ['http://example.com/cb']
      };
      var model = {
        generateAuthorizationCode: function() {
          return Promise.resolve('12345');
        },
        saveAuthorizationCode: function() {
          return Promise.resolve({ authorizationCode: '12345' });
        }
      };
      var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({ body: { scope: 'foobix' }, headers: {}, method: {}, query: {} });

      try {
        handler.handle(request, client);

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(UnauthorizedClientError);
        e.message.should.equal('Unauthorized client: `grant_type` is invalid');
      }
    });

    it('should return an error `redirect_uri` if `saveAuthorizationCode` fails', function() {
      var client = {
        grants: ['authorization_code'],
        redirectUris: ['http://example.com/cb']
      };
      var model = {
        generateAuthorizationCode: function() {
          return Promise.resolve('12345');
        },
        saveAuthorizationCode: function() {
          throw new Error('Unhandled exception');
        }
      };
      var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({ body: { state: ' foobiz', scope: 'foobix' }, headers: {}, method: {}, query: {} });

      return handler.handle(request, client)
        .then(function(data) {
          url.format(data.redirectUri).should.equal('http://example.com/cb?error=server_error&error_description=Unhandled%20exception');
          data.result.should.be.instanceOf(ServerError);
        })
        .catch(should.fail);
    });

    describe('should return an error `redirect_uri` if `getState` fails', function() {
      it('should return an error `redirect_uri` if `state` is missing and allowEmptyState is not `true`', function() {
        var client = {
          grants: ['authorization_code'],
          redirectUris: ['http://example.com/cb']
        };
        var model = {
          generateAuthorizationCode: function() {
            return Promise.resolve('12345');
          },
          saveAuthorizationCode: function() {
            return Promise.resolve({ authorizationCode: '12345' });
          }
        };
        var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });
        var request = new Request({ body: { scope: 'foobix' }, headers: {}, method: {}, query: {} });

        return handler.handle(request, client)
          .then(function(data) {
            url.format(data.redirectUri).should.equal('http://example.com/cb?error=invalid_request&error_description=Missing%20parameter%3A%20%60state%60');
            data.result.should.be.instanceOf(InvalidRequestError);
          })
          .catch(should.fail);
      });

      it('should return an error `redirect_uri` if `state` is invalid', function() {
        var client = {
          grants: ['authorization_code'],
          redirectUris: ['http://example.com/cb']
        };
        var model = {
          generateAuthorizationCode: function() {
            return Promise.resolve('12345');
          },
          saveAuthorizationCode: function() {
            return Promise.resolve({ authorizationCode: '12345' });
          }
        };
        var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });
        var request = new Request({ body: { state: [], scope: 'foobix' }, headers: {}, method: {}, query: {} });

        return handler.handle(request, client)
          .then(function(data) {
            url.format(data.redirectUri).should.equal('http://example.com/cb?error=invalid_request&error_description=Invalid%20parameter%3A%20%60state%60');
            data.result.should.be.instanceOf(InvalidRequestError);
          })
          .catch(should.fail);
      });
    });

    it('should return a sucessfull `redirect_uri` and a result', function() {
      var client = {
        grants: ['authorization_code'],
        redirectUris: ['http://example.com/cb']
      };
      var model = {
        generateAuthorizationCode: function() {
          return Promise.resolve('12345');
        },
        saveAuthorizationCode: function() {
          return Promise.resolve({ authorizationCode: '12345' });
        }
      };
      var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({ body: { response_type: 'code', state: 'bar', scope: 'biz' }, headers: {}, method: {}, query: {} });

      return handler.handle(request, client)
        .then(function(data) {
          url.format(data.redirectUri).should.equal('http://example.com/cb?code=12345&state=bar');
          data.result.should.not.be.empty;
          data.result.authorizationCode.should.equal('12345');
        })
        .catch(should.fail);
    });
  });

  describe('generateAuthorizationCode()', function() {
    it('should return an auth code', function() {
      var model = {
        saveAuthorizationCode: function() {}
      };
      var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });

      return handler.generateAuthorizationCode()
        .then(function(data) {
          data.should.be.a.sha1;
        })
        .catch(should.fail);
    });

    it('should support promises', function() {
      var model = {
        generateAuthorizationCode: function() {
          return Promise.resolve({});
        },
        saveAuthorizationCode: function() {}
      };
      var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });

      handler.generateAuthorizationCode().should.be.an.instanceOf(Promise);
    });

    it('should support non-promises', function() {
      var model = {
        generateAuthorizationCode: function() {
          return {};
        },
        saveAuthorizationCode: function() {}
      };
      var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });

      handler.generateAuthorizationCode().should.be.an.instanceOf(Promise);
    });
  });

  describe('getAuthorizationCodeLifetime()', function() {
    it('should return a date', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });

      handler.getAuthorizationCodeLifetime().should.be.an.instanceOf(Date);
    });
  });

  describe('getScope()', function() {
    it('should throw an error if `scope` is invalid', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({ body: { scope: 'øå€£‰' }, headers: {}, method: {}, query: {} });

      try {
        handler.getScope(request);

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidScopeError);
        e.message.should.equal('Invalid parameter: `scope`');
      }
    });

    describe('with `scope` in the request body', function() {
      it('should return the scope', function() {
        var model = {
          getAccessToken: function() {},
          getClient: function() {},
          saveAuthorizationCode: function() {}
        };
        var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });
        var request = new Request({ body: { scope: 'foo' }, headers: {}, method: {}, query: {} });

        handler.getScope(request).should.equal('foo');
      });
    });

    describe('with `scope` in the request query', function() {
      it('should return the scope', function() {
        var model = {
          getAccessToken: function() {},
          getClient: function() {},
          saveAuthorizationCode: function() {}
        };
        var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });
        var request = new Request({ body: {}, headers: {}, method: {}, query: { scope: 'foo' } });

        handler.getScope(request).should.equal('foo');
      });
    });
  });

  describe('getState()', function() {
    it('should throw an error if `allowEmptyState` is false and `state` is missing', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new CodeResponseType({ allowEmptyState: false, authorizationCodeLifetime: 120, model: model });
      var request = new Request({ body: {}, headers: {}, method: {}, query: {} });

      try {
        handler.getState(request);

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidRequestError);
        e.message.should.equal('Missing parameter: `state`');
      }
    });

    it('should throw an error if `state` is invalid', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({ body: {}, headers: {}, method: {}, query: { state: 'øå€£‰' } });

      try {
        handler.getState(request);

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidRequestError);
        e.message.should.equal('Invalid parameter: `state`');
      }
    });

    describe('with `state` in the request body', function() {
      it('should return the state', function() {
        var model = {
          getAccessToken: function() {},
          getClient: function() {},
          saveAuthorizationCode: function() {}
        };
        var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });
        var request = new Request({ body: { state: 'foobar' }, headers: {}, method: {}, query: {} });

        handler.getState(request).should.equal('foobar');
      });
    });

    describe('with `state` in the request query', function() {
      it('should return the state', function() {
        var model = {
          getAccessToken: function() {},
          getClient: function() {},
          saveAuthorizationCode: function() {}
        };
        var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });
        var request = new Request({ body: {}, headers: {}, method: {}, query: { state: 'foobar' } });

        handler.getState(request).should.equal('foobar');
      });
    });
  });

  describe('getRedirectUri()', function() {
    describe('with `redirect_uri` in the request body', function() {
      it('should return the redirect_uri', function() {
        var client = {
          redirectUris: []
        };
        var model = {
          getAccessToken: function() {},
          getClient: function() {},
          saveAuthorizationCode: function() {}
        };
        var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });
        var request = new Request({ body: { redirect_uri: 'foobar' }, headers: {}, method: {}, query: {} });

        handler.getRedirectUri(request, client).should.equal('foobar');
      });
    });

    describe('with `redirect_uri` in the request query', function() {
      it('should return the redirect_uri', function() {
        var client = {
          redirectUris: []
        };
        var model = {
          getAccessToken: function() {},
          getClient: function() {},
          saveAuthorizationCode: function() {}
        };
        var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });
        var request = new Request({ body: {}, headers: {}, method: {}, query: { redirect_uri: 'foobar' } });

        handler.getRedirectUri(request, client).should.equal('foobar');
      });
    });

    describe('with `redirect_uri` in the client', function() {
      it('should return the redirect_uri', function() {
        var client = {
          redirectUris: ['foobar']
        };
        var model = {
          saveAuthorizationCode: function() {}
        };
        var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });
        var request = new Request({ body: { redirect_uri: 'foobar' }, headers: {}, method: {}, query: {} });

        handler.getRedirectUri(request, client).should.equal('foobar');
      });
    });
  });

  describe('saveAuthorizationCode()', function() {
    it('should return an auth code', function() {
      var authorizationCode = {};
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {
          return authorizationCode;
        }
      };
      var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });

      return handler.saveAuthorizationCode('foo', 'bar', 'biz', 'baz')
        .then(function(data) {
          data.should.equal(authorizationCode);
        })
        .catch(should.fail);
    });

    it('should support promises when calling `model.saveAuthorizationCode()`', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {
          return Promise.resolve({});
        }
      };
      var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });

      handler.saveAuthorizationCode('foo', 'bar', 'biz', 'baz').should.be.an.instanceOf(Promise);
    });

    it('should support non-promises when calling `model.saveAuthorizationCode()`', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {
          return {};
        }
      };
      var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });

      handler.saveAuthorizationCode('foo', 'bar', 'biz', 'baz').should.be.an.instanceOf(Promise);
    });
  });

  describe('buildSuccessRedirectUri()', function() {
    it('should return the new redirect uri and set the `code` and `state` in the query', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });
      var redirectUri = handler.buildSuccessRedirectUri('http://example.com/cb', { code: 'foobar', state: 'foobiz'} );

      url.format(redirectUri).should.equal('http://example.com/cb?code=foobar&state=foobiz');
    });

    it('should return the new redirect uri and append the `code` and `state` in the query', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });

      var redirectUri = handler.buildSuccessRedirectUri('http://example.com/cb?foo=bar', { code: 'foobar', state: 'foobiz'} );

      url.format(redirectUri).should.equal('http://example.com/cb?foo=bar&code=foobar&state=foobiz');
    });
  });

});
