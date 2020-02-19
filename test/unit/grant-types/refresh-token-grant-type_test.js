'use strict';

/**
 * Module dependencies.
 */

var InvalidScopeError = require('../../../lib/errors/invalid-scope-error');
var RefreshTokenGrantType = require('../../../lib/grant-types/refresh-token-grant-type');
var Request = require('../../../lib/request');
var sinon = require('sinon');
var should = require('should');

/**
 * Test `RefreshTokenGrantType`.
 */

describe('RefreshTokenGrantType', function() {
  describe('handle()', function() {
    it('should revoke the previous token', function() {
      var token = { accessToken: 'foo', client: {}, user: {} };
      var model = {
        getRefreshToken: function() { return token; },
        saveToken: function() { return { accessToken: 'bar', client: {}, user: {} }; },
        revokeToken: sinon.stub().returns({ accessToken: 'foo', client: {}, refreshTokenExpiresAt: new Date(new Date() / 2), user: {} })
      };
      var handler = new RefreshTokenGrantType({ accessTokenLifetime: 120, model: model });
      var request = new Request({ body: { refresh_token: 'bar' }, headers: {}, method: {}, query: {} });
      var client = {};

      return handler.handle(request, client)
        .then(function() {
          model.revokeToken.callCount.should.equal(1);
          model.revokeToken.firstCall.args.should.have.length(2);
          model.revokeToken.firstCall.args[0].should.eql({ token });
          model.revokeToken.firstCall.args[1].should.eql({ request });
        })
        .catch(should.fail);
    });
  });

  describe('getRefreshToken()', function() {
    it('should call `model.getRefreshToken()`', function() {
      var model = {
        getRefreshToken: sinon.stub().returns({ accessToken: 'foo', client: {}, user: {} }),
        saveToken: function() {},
        revokeToken: function() {}
      };
      var handler = new RefreshTokenGrantType({ accessTokenLifetime: 120, model: model });
      var request = new Request({ body: { refresh_token: 'bar' }, headers: {}, method: {}, query: {} });
      var client = {};

      return handler.getRefreshToken(request, client)
        .then(function() {
          model.getRefreshToken.callCount.should.equal(1);
          model.getRefreshToken.firstCall.args.should.have.length(2);
          model.getRefreshToken.firstCall.args[0].should.eql({ refreshToken: 'bar' });
          model.getRefreshToken.firstCall.args[1].should.eql({ request });
        })
        .catch(should.fail);
    });
  });

  describe('revokeToken()', function() {
    it('should call `model.revokeToken()`', function() {
      var model = {
        getRefreshToken: function() {},
        revokeToken: sinon.stub().returns({ accessToken: 'foo', client: {}, refreshTokenExpiresAt: new Date(new Date() / 2), user: {} }),
        saveToken: function() {}
      };
      var handler = new RefreshTokenGrantType({ accessTokenLifetime: 120, model: model });
      var request = new Request({ body: { refresh_token: 'bar' }, headers: {}, method: {}, query: {} });
      var token = {};

      return handler.revokeToken(request, token)
        .then(function() {
          model.revokeToken.callCount.should.equal(1);
          model.revokeToken.firstCall.args.should.have.length(2);
          model.revokeToken.firstCall.args[0].should.eql({ token });
          model.revokeToken.firstCall.args[1].should.eql({ request });
        })
        .catch(should.fail);
    });
  });

  describe('saveToken()', function() {
    it('should call `model.saveToken()`', function() {
      var client = {};
      var user = {};
      var model = {
        getRefreshToken: function() {},
        revokeToken: function() {},
        saveToken: sinon.stub().returns(true)
      };
      var handler = new RefreshTokenGrantType({ accessTokenLifetime: 120, model: model });
      var request = new Request({ body: { refresh_token: 'bar' }, headers: {}, method: {}, query: {} });

      sinon.stub(handler, 'generateAccessToken').returns('foo');
      sinon.stub(handler, 'generateRefreshToken').returns('bar');
      sinon.stub(handler, 'getAccessTokenExpiresAt').returns('biz');
      sinon.stub(handler, 'getRefreshTokenExpiresAt').returns('baz');

      return handler.saveToken(request, user, client, 'foobar')
        .then(function() {
          model.saveToken.callCount.should.equal(1);
          model.saveToken.firstCall.args.should.have.length(2);
          model.saveToken.firstCall.args[0].should.eql({
            client,
            token: { accessToken: 'foo', accessTokenExpiresAt: 'biz', grant: 'refresh_token', refreshToken: 'bar', refreshTokenExpiresAt: 'baz', scope: 'foobar' },
            user
          });
          model.saveToken.firstCall.args[1].should.eql({ request });
        })
        .catch(should.fail);
    });
  });

  describe('validateScope()', function () {
    it('should return token scope if there is no request scope', function () {
      var model = {
        getRefreshToken: function () {},
        revokeToken: function () {},
        saveToken: function () {},
      };
      var handler = new RefreshTokenGrantType({ accessTokenLifetime: 120, model: model });
      var request = new Request({ body: { refresh_token: 'bar' }, headers: {}, method: {}, query: {} });
      var token = { scope: 'foo' };

      var scope = handler.validateScope(request, token);

      scope.should.equal('foo');
    });

    it('should call `model.validateScope()` if there is a request scope', function () {
      var model = {
        getRefreshToken: function () {},
        revokeToken: function () {},
        saveToken: function () {},
        validateScope: sinon.stub().returns(true)
      };
      var handler = new RefreshTokenGrantType({ accessTokenLifetime: 120, model: model });
      var request = new Request({ body: { refresh_token: 'bar', scope: 'foo' }, headers: {}, method: {}, query: {} });
      var token = {};

      handler.validateScope(request, token);
      
      model.validateScope.callCount.should.equal(1);
      model.validateScope.firstCall.args.should.have.length(2);
      model.validateScope.firstCall.args[0].should.eql({ scope: 'foo', token });
      model.validateScope.firstCall.args[1].should.eql({ request });
    });

    it('should throw an error if the request scope is invalid', function () {
      var model = {
        getRefreshToken: function () {},
        revokeToken: function () {},
        saveToken: function () {},
        validateScope: sinon.stub().returns(false)
      };
      var handler = new RefreshTokenGrantType({ accessTokenLifetime: 120, model: model });
      var request = new Request({ body: { refresh_token: 'bar', scope: 'biz' }, headers: {}, method: {}, query: {} });
      var token = { scope: 'foo bar' };

      try {
        handler.validateScope(request, token);
      } catch (e) {
        e.should.be.instanceOf(InvalidScopeError);
      }
    });

    it('should return the request scope if the scope is valid', function () {
      var model = {
        getRefreshToken: function () {},
        revokeToken: function () {},
        saveToken: function () {},
        validateScope: sinon.stub().returns(true)
      };
      var handler = new RefreshTokenGrantType({ accessTokenLifetime: 120, model: model });
      var request = new Request({ body: { refresh_token: 'bar', scope: 'foo' }, headers: {}, method: {}, query: {} });
      var token = { scope: 'foo bar' };

      var scope = handler.validateScope(request, token);

      scope.should.equal('foo');
    });
  });
});
