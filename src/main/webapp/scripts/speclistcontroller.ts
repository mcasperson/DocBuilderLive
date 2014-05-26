/// <reference path="../definitions/angular.d.ts" />

var specListModule = angular.module('specListModule', ['ngResource']);

specListModule.controller('specListController', ['$scope', '$resource',
    function($scope, $resource) {
        // $scope.pressgangRestAPI = $resource(SERVER + REST_BASE + "/contentspecs/get/json/all");
    }
]);