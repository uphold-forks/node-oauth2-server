'use strict';

/**
 * Module dependencies.
 */

var CodeResponseType = require('../../../lib/response-types/code-response-type');
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

      return handler.generateAuthorizationCode()
        .then(function() {
          model.generateAuthorizationCode.callCount.should.equal(1);
        });
    });
  });

  describe('saveAuthorizationCode()', function() {
    it('should call `model.saveAuthorizationCode()`', function() {
      var authorizationCode = '12345';
      var client = { grants: ['authorization_code'], redirectUris: ['http://example.com/cb'] };
      var expiresAt = new Date();
      var redirectUri = 'http://example.com/cb';
      var scope = 'foobar';
      var user = {};
      var model = {
        saveAuthorizationCode: sinon.stub().returns({
          authorizationCode, expiresAt, redirectUri, scope
        }, client, user)
      };
      var handler = new CodeResponseType({ authorizationCodeLifetime: 120, model: model });

      expiresAt.setSeconds(expiresAt.getSeconds() + 120);

      return handler.saveAuthorizationCode(authorizationCode, expiresAt, scope, client, redirectUri, user)
        .then(function() {
          model.saveAuthorizationCode.callCount.should.equal(1);
          model.saveAuthorizationCode.firstCall.args.should.have.length(3);
          model.saveAuthorizationCode.firstCall.args[0].should.eql({
            authorizationCode, expiresAt, redirectUri, scope
          });
          model.saveAuthorizationCode.firstCall.args[1].should.equal(client);
          model.saveAuthorizationCode.firstCall.args[2].should.equal(user);
        });
    });
  });
});
