'use strict';

/**
 * Module dependencies.
 */

var AbstractResponseType = require('../../../lib/response-types/abstract-response-type');
var sinon = require('sinon');

/**
 * Test `AbstractResponseType`.
 */

describe('AbstractResponseType', function() {
  describe('validateScope()', function() {
    it('should call `model.validateScope()`', function() {
      var model = {
        validateScope: sinon.stub().returns({ scope: {} })
      };
      var handler = new AbstractResponseType({ authorizationCodeLifetime: 120, model: model });

      return handler.validateScope()
        .then(function() {
          model.validateScope.callCount.should.equal(1);
        });
    });
  });
});
