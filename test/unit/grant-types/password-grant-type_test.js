'use strict';

/**
 * Module dependencies.
 */

var PasswordGrantType = require('../../../lib/grant-types/password-grant-type');
var Request = require('../../../lib/request');
var sinon = require('sinon');
var should = require('should');

/**
 * Test `PasswordGrantType`.
 */

describe('PasswordGrantType', function() {
  describe('getUser()', function() {
    it('should call `model.getUser()`', function() {
      var model = {
        getUser: sinon.stub().returns(true),
        saveToken: function() {}
      };
      var handler = new PasswordGrantType({ accessTokenLifetime: 120, model: model });
      var request = new Request({ body: { username: 'foo', password: 'bar' }, headers: {}, method: {}, query: {} });

      return handler.getUser(request)
        .then(function() {
          model.getUser.callCount.should.equal(1);
          model.getUser.firstCall.args.should.have.length(2);
          model.getUser.firstCall.args[0].should.eql({ password: 'bar', username: 'foo' });
          model.getUser.firstCall.args[1].should.eql({ request });
        })
        .catch(should.fail);
    });
  });

  describe('saveToken()', function() {
    it('should call `model.saveToken()`', function() {
      var client = {};
      var user = {};
      var model = {
        getUser: function() {},
        saveToken: sinon.stub().returns(true)
      };
      var handler = new PasswordGrantType({ accessTokenLifetime: 120, model: model });
      var request = new Request({ body: { username: 'foo', password: 'bar' }, headers: {}, method: {}, query: {} });

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
            token: { accessToken: 'foo', accessTokenExpiresAt: 'biz', grant: 'password', refreshToken: 'bar', refreshTokenExpiresAt: 'baz', scope: 'foobar' },
            user
          });
          model.saveToken.firstCall.args[1].should.eql({ request });
        })
        .catch(should.fail);
    });
  });
});
