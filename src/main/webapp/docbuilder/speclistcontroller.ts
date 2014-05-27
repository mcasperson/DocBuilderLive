/// <reference path="../definitions/angular.d.ts" />
/// <reference path="../definitions/underscore.d.ts" />
/// <reference path="constants.ts" />

/*
    This AngularJS Controller is used to populate the list of content specs
 */

var SPEC_COLLECTION_EXPAND:Object={
    branches: [
        {
            trunk: {
                name: "contentSpecs",
                start: 0,
                end: 10
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
                updateProductAndVersions();
            }
        );

        $scope.links = [
            {
                id: "BugReport",
                href: "https://bugzilla.redhat.com/enter_bug.cgi?alias=&assigned_to=pressgang-ccms-dev%40redhat.com&bug_status=NEW&component=DocBook-builder&product=PressGang%20CCMS&version=1.6",
                text: "Report Bug"
            }
        ];

        $scope.range = function(min, max, step){
            step = (step === undefined) ? 1 : step;
            var input = [];
            for (var i = min; i <= max; i += step) input.push(i);
            return input;
        };

        $scope.productAndVersions = [];

        $scope.getSpecByProdAndVer = function(prod, ver) {
            return _.filter($scope.productAndVersions, function (specElement) {
                var product = _.filter(specElement.item.children_OTM.items, function (specElementChild) {
                    return  specElementChild.item.nodeType === "META_DATA" &&
                        specElementChild.item.title === "Product";
                });

                var version = _.filter(specElement.item.children_OTM.items, function (specElementChild) {
                    return  specElementChild.item.nodeType === "META_DATA" &&
                        specElementChild.item.title === "Version";
                });

                return product.length === 1 && product[0].item.additionalText === prod &&
                    ((ver === null && version.length === 0) ||
                        (ver !== null && version.length === 1));
            });
        }

        function updateProductAndVersions() {
            if ($scope.allSpecs !== undefined) {
                _.each($scope.allSpecs.items, function (specElement) {
                    var product = _.filter(specElement.item.children_OTM.items, function (specElementChild) {
                        return  specElementChild.item.nodeType === "META_DATA" && specElementChild.item.title === "Product";
                    });
                    var version = _.filter(specElement.item.children_OTM.items, function (specElementChild) {
                        return  specElementChild.item.nodeType === "META_DATA" && specElementChild.item.title === "Version";
                    });

                    if (product.length === 1 && (version.length === 1 || version.length === 0)) {
                        var prodVer = {
                            product: product[0].item.additionalText,
                            version: version.length === 1 ? version[0].item.additionalText : null
                        }
                        if (_.findWhere($scope.productAndVersions, prodVer) === undefined) {
                            $scope.productAndVersions.push(prodVer);
                        }
                    }

                });
            }

            $scope.productAndVersions.sort(function(a, b):number {
                if (a.product < b.product) {
                    return -1;
                } else if (a.product > b.product) {
                    return 1;
                } else if (a.version === b.version) {
                    return 0;
                } else if (a.version === null && b.version !== null) {
                    return 1;
                } else if (a.version !== null && b.version === null) {
                    return 1;
                } else {
                    return a.version > b.version;
                }
            })
        }
    }
]);