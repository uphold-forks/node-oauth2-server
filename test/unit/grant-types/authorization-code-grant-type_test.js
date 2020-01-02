'use strict';

/**
 * Module dependencies.
 */

var AuthorizationCodeGrantType = require('../../../lib/grant-types/authorization-code-grant-type');
var Promise = require('bluebird');
var Request = require('../../../lib/request');
var sinon = require('sinon');
var should = require('should');

/**
 * Test `AuthorizationCodeGrantType`.
 */

describe('AuthorizationCodeGrantType', function() {
  describe('getAuthorizationCode()', function() {
    it('should call `model.getAuthorizationCode()`', function() {
      var model = {
        getAuthorizationCode: sinon.stub().returns({ authorizationCode: 12345, client: {}, expiresAt: new Date(new Date() * 2), user: {} }),
        revokeAuthorizationCode: function() {},
        saveToken: function() {}
      };
      var handler = new AuthorizationCodeGrantType({ accessTokenLifetime: 120, model: model });
      var request = new Request({ body: { code: 12345 }, headers: {}, method: {}, query: {} });
      var client = {};

      return handler.getAuthorizationCode(request, client)
        .then(function() {
          model.getAuthorizationCode.callCount.should.equal(1);
          model.getAuthorizationCode.firstCall.args.should.have.length(2);
          model.getAuthorizationCode.firstCall.args[0].should.eql({ authorizationCode: 12345 });
          model.getAuthorizationCode.firstCall.args[1].should.eql({ request });
        })
        .catch(should.fail);
    });
  });

  describe('revokeAuthorizationCode()', function() {
    it('should call `model.revokeAuthorizationCode()`', function() {
      var model = {
        getAuthorizationCode: function() {},
        revokeAuthorizationCode: sinon.stub().returns({ authorizationCode: 12345, client: {}, expiresAt: new Date(new Date() / 2), user: {} }),
        saveToken: function() {}
      };
      var handler = new AuthorizationCodeGrantType({ accessTokenLifetime: 120, model: model });
      var request = new Request({ body: { code: 12345 }, headers: {}, method: {}, query: {} });
      var authorizationCode = {};

      return handler.revokeAuthorizationCode(request, authorizationCode)
        .then(function() {
          model.revokeAuthorizationCode.callCount.should.equal(1);
          model.revokeAuthorizationCode.firstCall.args.should.have.length(2);
          model.revokeAuthorizationCode.firstCall.args[0].should.eql({ code: authorizationCode });
          model.revokeAuthorizationCode.firstCall.args[1].should.eql({ request });
        })
        .catch(should.fail);
    });
  });

  describe('saveToken()', function() {
    it('should call `model.saveToken()`', function() {
      var client = {};
      var user = {};
      var model = {
        getAuthorizationCode: function() {},
        revokeAuthorizationCode: function() {},
        saveToken: sinon.stub().returns(true)
      };
      var handler = new AuthorizationCodeGrantType({ accessTokenLifetime: 120, model: model });
      var request = new Request({ body: { code: 12345 }, headers: {}, method: {}, query: {} });

      sinon.stub(handler, 'generateAccessToken').returns(Promise.resolve('foo'));
      sinon.stub(handler, 'generateRefreshToken').returns(Promise.resolve('bar'));
      sinon.stub(handler, 'getAccessTokenExpiresAt').returns('biz');
      sinon.stub(handler, 'getRefreshTokenExpiresAt').returns('baz');

      return handler.saveToken(request, user, client, 'foobar', 'foobiz')
        .then(function() {
          model.saveToken.callCount.should.equal(1);
          model.saveToken.firstCall.args.should.have.length(2);
          model.saveToken.firstCall.args[0].should.eql({
            client,
            token: { accessToken: 'foo', accessTokenExpiresAt: 'biz', authorizationCode: 'foobar', grant: 'authorization_code', refreshToken: 'bar', refreshTokenExpiresAt: 'baz', scope: 'foobiz' },
            user
          });
          model.saveToken.firstCall.args[1].should.eql({ request });
        })
        .catch(should.fail);
    });
  });
});
