/// <reference path="../definitions/angular.d.ts" />
/// <reference path="constants.ts" />

var SPEC_COLLECTION_EXPAND:Object={
    branches: [
        {
            trunk: {
                name: "contentSpecs"
            },
            branches: [
                {
                    trunk: {
                        name: "children_OTM"
                    }
                }
            ]
        }
    ]
}

var specListModule = angular.module('specListModule', ['ngResource']);

specListModule.factory('getAllSpecs', ['$resource', function($resource) {
        return $resource(SERVER + REST_BASE + "/contentspecs/get/json/all?expand=" + encodeURIComponent(JSON.stringify(SPEC_COLLECTION_EXPAND)));
    }
]);

specListModule.controller('specListController', ['$scope', 'getAllSpecs',
    function($scope, getAllSpecs) {
        getAllSpecs.query(function(data) {
                $scope.allSpecs = data;
            }
        );
    }
]);