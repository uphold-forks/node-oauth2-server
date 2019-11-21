'use strict';

/**
 * Module dependencies.
 */

var AbstractResponseType = require('../../../lib/response-types/abstract-response-type');
var InvalidArgumentError = require('../../../lib/errors/invalid-argument-error');
var InvalidClientError = require('../../../lib/errors/invalid-client-error');
var Request = require('../../../lib/request');
var should = require('should');
var url = require('url');

/**
 * Test `AbstractResponseType` integration.
 */

describe('AbstractResponseType integration', function() {
  describe('constructor()', function() {
    it('should throw an error if `options.authorizationCodeLifetime` is missing', function() {
      try {
        new AbstractResponseType();

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidArgumentError);
        e.message.should.equal('Missing parameter: `authorizationCodeLifetime`');
      }
    });

    it('should throw an error if `options.model` is missing', function() {
      try {
        new AbstractResponseType({ authorizationCodeLifetime: 123 });

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidArgumentError);
        e.message.should.equal('Missing parameter: `model`');
      }
    });

    it('should set the `authorizationCodeLifetime`', function() {
      var grantType = new AbstractResponseType({ authorizationCodeLifetime: 123, model: {} });

      grantType.authorizationCodeLifetime.should.equal(123);
    });

    it('should set the `model`', function() {
      var model = {};
      var grantType = new AbstractResponseType({ authorizationCodeLifetime: 123, model: model });

      grantType.model.should.equal(model);
    });
  });

  describe('buildErrorRedirectUri()', function() {
    it('should throw an error if `redirectUri` is missing', function() {
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new AbstractResponseType({ authorizationCodeLifetime: 120, model: model });

      try{
        handler.buildErrorRedirectUri();

        should.fail();
      } catch (e) {
        e.should.be.instanceOf(InvalidArgumentError);
        e.message.should.equal('Missing parameter: `redirectUri`');
      }
    });

    it('should set `error_description` if available', function() {
      var error = new InvalidClientError('foo bar');
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new AbstractResponseType({ authorizationCodeLifetime: 120, model: model });
      var redirectUri = handler.buildErrorRedirectUri('http://example.com/cb', { error });

      url.format(redirectUri).should.equal('http://example.com/cb?error=invalid_client&error_description=foo%20bar');
    });

    it('should set query params if available', function() {
      var error = new InvalidClientError('foo bar');
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new AbstractResponseType({ authorizationCodeLifetime: 120, model: model });
      var redirectUri = handler.buildErrorRedirectUri('http://example.com/cb', { error, query: { state: 'foobar' } });

      url.format(redirectUri).should.equal('http://example.com/cb?error=invalid_client&error_description=foo%20bar&state=foobar');
    });

    it('should return a redirect uri', function() {
      var error = new InvalidClientError();
      var model = {
        getAccessToken: function() {},
        getClient: function() {},
        saveAuthorizationCode: function() {}
      };
      var handler = new AbstractResponseType({ authorizationCodeLifetime: 120, model: model });
      var redirectUri = handler.buildErrorRedirectUri('http://example.com/cb', { error });

      url.format(redirectUri).should.equal('http://example.com/cb?error=invalid_client&error_description=Bad%20Request');
    });
  });

  describe('getScope()', function() {
    it('should throw an error if `scope` is invalid', function() {
      var handler = new AbstractResponseType({ authorizationCodeLifetime: 123, model: {}, });
      var request = new Request({ body: { scope: 'øå€£‰' }, headers: {}, method: {}, query: {} });

      try {
        handler.getScope(request);

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidArgumentError);
        e.message.should.equal('Invalid parameter: `scope`');
      }
    });

    it('should allow the `scope` to be `undefined`', function() {
      var handler = new AbstractResponseType({ authorizationCodeLifetime: 123, model: {}, });
      var request = new Request({ body: {}, headers: {}, method: {}, query: {} });

      should.not.exist(handler.getScope(request));
    });

    it('should return the scope', function() {
      var handler = new AbstractResponseType({ authorizationCodeLifetime: 123, model: {}, });
      var request = new Request({ body: { scope: 'foo' }, headers: {}, method: {}, query: {} });

      handler.getScope(request).should.equal('foo');
    });
  });
});
