'use strict';

/**
 * Module dependencies.
 */

var CodeResponseType = require('../../../lib/response-types/code-response-type');
var Request = require('../../../lib/request');
var sinon = require('sinon');

/**
 * Test `CodeResponseType`.
 */

describe('CodeResponseType', function() {
  describe('generateAuthorizationCode()', function() {
    it('should call `model.generateAuthorizationCode()`', function() {
      var model = {
        generateAuthorizationCode: sinon.stub().returns('21345'),
        saveAuthorizationCode: function() {}
      };
      var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });
      var request = new Request({ body: { scope: 'foo' }, headers: {}, method: {}, query: {} });

      return handler.generateAuthorizationCode(request)
        .then(function() {
          model.generateAuthorizationCode.callCount.should.equal(1);
          model.generateAuthorizationCode.firstCall.args[0].should.eql({ request });
        });
    });
  });

  describe('saveAuthorizationCode()', function() {
    it('should call `model.saveAuthorizationCode()`', function() {
      var authorizationCode = '12345';
      var client = { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
      var expiresAt = new Date();
      var redirectUri = 'http://example.com/cb';
      var request = new Request({ body: { scope: 'foo' }, headers: {}, method: {}, query: {} });
      var scope = 'foobar';
      var user = {};
      var model = {
        saveAuthorizationCode: sinon.stub().returns({
          authorizationCode, expiresAt, redirectUri, scope
        }, client, user)
      };
      var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });

      expiresAt.setSeconds(expiresAt.getSeconds() + 120);

      return handler.saveAuthorizationCode(request, authorizationCode, expiresAt, scope, client, redirectUri, user)
        .then(function() {
          model.saveAuthorizationCode.callCount.should.equal(1);
          model.saveAuthorizationCode.firstCall.args.should.have.length(2);
          model.saveAuthorizationCode.firstCall.args[0].should.eql({
            code: {
              authorizationCode, expiresAt, redirectUri, scope
            },
            client,
            user
          });
          model.saveAuthorizationCode.firstCall.args[1].should.eql({ request });
        });
    });
  });
});
