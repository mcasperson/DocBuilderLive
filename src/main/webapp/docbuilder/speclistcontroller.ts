/// <reference path="../definitions/angular.d.ts" />
/// <reference path="constants.ts" />

var SPEC_COLLECTION_EXPAND:Object={
    branches: [
        {
            trunk: {
                name: "contentSpecs",
                start: 0,
                end: 10
            }
        }
    ]
}

var specListModule = angular.module('specListModule', ['ngResource']);

specListModule.factory('getAllSpecs', ['$resource', function($resource) {
        return $resource(
            SERVER + REST_BASE + "/contentspecs/get/json/all?expand=" + encodeURIComponent(JSON.stringify(SPEC_COLLECTION_EXPAND)),
            {},
            {
                query: { method: "GET", isArray: false }
            }
        );
    }
]);

specListModule.controller('specListController', ['$scope', 'getAllSpecs',
    function($scope, getAllSpecs) {
        getAllSpecs.query(function(data) {
                $scope.allSpecs = data;
            }
        );

        $scope.links = [
            {
                id: "BugReport",
                href: "https://bugzilla.redhat.com/enter_bug.cgi?alias=&assigned_to=pressgang-ccms-dev%40redhat.com&bug_status=NEW&component=DocBook-builder&product=PressGang%20CCMS&version=1.6",
                text: "Report Bug"
            }
        ]
    }
]);