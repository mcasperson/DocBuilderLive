/// <reference path="../definitions/angular.d.ts" />
/// <reference path="../definitions/angular-route.d.ts" />

var docbuilderFrontPage = angular.module("docbuilderFrontPage", [
    'ngRoute',
    'specListModule',
    'docbuilderModule'
]);

docbuilderFrontPage.config(['$routeProvider',
    function($routeProvider) {
        $routeProvider
            .when('/', {
                templateUrl: 'speclist.html',
                controller: 'specListController'
            })
            .when('/renderedContentSpec/:specId', {
                templateUrl: 'renderedspec.html',
                controller: 'docbuilderController'
            });
    }
]);

