/// <reference path="../definitions/angular.d.ts" />
/// <reference path="constants.ts" />

var specListModule = angular.module('specListModule', ['ngResource']);

specListModule.controller('specListController', ['$scope', '$resource',
    function($scope, $resource) {
        $scope.pressgangRestAPI = $resource(SERVER + REST_BASE + "/contentspecs/get/json/all");
    }
]);