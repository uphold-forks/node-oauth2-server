'use strict';

/**
 * Module dependencies.
 */

var AbstractGrantType = require('../../../lib/grant-types/abstract-grant-type');
var Request = require('../../../lib/request');
var should = require('should');
var sinon = require('sinon');

/**
 * Test `AbstractGrantType`.
 */

describe('AbstractGrantType', function() {
  describe('generateAccessToken()', function() {
    it('should call `model.generateAccessToken()`', function() {
      var model = {
        generateAccessToken: sinon.stub().returns({ client: {}, expiresAt: new Date(), user: {} })
      };
      var handler = new AbstractGrantType({ accessTokenLifetime: 120, model: model });
      var request = new Request({ body: { username: 'foo', password: 'bar' }, headers: {}, method: {}, query: {} });

      return handler.generateAccessToken(request)
        .then(function() {
          model.generateAccessToken.callCount.should.equal(1);
          model.generateAccessToken.firstCall.args[0].should.eql({ request });
        })
        .catch(should.fail);
    });
  });

  describe('generateRefreshToken()', function() {
    it('should call `model.generateRefreshToken()`', function() {
      var model = {
        generateRefreshToken: sinon.stub().returns({ client: {}, expiresAt: new Date(new Date() / 2), user: {} })
      };
      var handler = new AbstractGrantType({ accessTokenLifetime: 120, model: model });
      var request = new Request({ body: { username: 'foo', password: 'bar' }, headers: {}, method: {}, query: {} });

      return handler.generateRefreshToken(request)
        .then(function() {
          model.generateRefreshToken.callCount.should.equal(1);
          model.generateRefreshToken.firstCall.args[0].should.eql({ request });
        })
        .catch(should.fail);
    });
  });
});
