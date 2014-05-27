/// <reference path="../definitions/angular.d.ts" />
/// <reference path="../definitions/underscore.d.ts" />
/// <reference path="../definitions/jquery.d.ts" />
/// <reference path="constants.ts" />

var CONTENT_SPEC_LIST_CACHE_KEY = "ContentSpecList";
/*
    This AngularJS Controller is used to populate the list of content specs
 */
var PAGING = 100;
var SPEC_COLLECTION_EXPAND = function(start) {
    return {
        expand: JSON.stringify({
            branches: [
                {
                    trunk: {
                        name: "contentSpecs",
                        start: start,
                        end: start + PAGING
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
        })
    };
}

var specListModule = angular.module('specListModule', ['ngResource', 'LocalStorageModule']);

specListModule.controller('specListController', ['$scope', '$resource', 'localStorageService',
    function($scope, $resource, localStorageService) {

        if (localStorageService.get(CONTENT_SPEC_LIST_CACHE_KEY)) {
            $scope.cachedSpecs = JSON.parse(localStorageService.get(CONTENT_SPEC_LIST_CACHE_KEY));
            updateProductAndVersions();
        }

        var specListResource = $resource(
            SERVER + REST_BASE + "/contentspecs/get/json/all",
            {
                expand: '@expand'
            },
            {
                query: { method: "GET", isArray: false }
            }
        );

        var getSpecs = function(index, specs, callback) {
            new specListResource(SPEC_COLLECTION_EXPAND(index)).$query(function(data) {
                    if (specs !== undefined) {
                        jQuery.merge(specs, data.items);
                    } else {
                        specs = data.items;
                    }

                    if (data.endExpandIndex === data.size)  {
                        callback(specs);
                    } else {
                        $scope.specLoadProgress = ": " + data.endExpandIndex + " of " + data.size;
                        getSpecs(index + PAGING, specs, callback);
                    }
                }
            );
        }

        getSpecs(0, [], function(specs) {
            $scope.allSpecs = specs;
            localStorageService.add(CONTENT_SPEC_LIST_CACHE_KEY, JSON.stringify(specs));
            updateProductAndVersions();
        });

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
            var specs = _.filter($scope.allSpecs, function (specElement) {
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

            var retValue = [];
            _.each(specs, function(element) {
                var title = _.filter(element.item.children_OTM.items, function (specElementChild) {
                    return  specElementChild.item.nodeType === "META_DATA" && specElementChild.item.title === "Title";
                });

                if (title.length === 1) {
                    retValue.push({id: element.item.id, title: title[0].item.additionalText})
                }
            });

            return retValue;
        }

        function updateProductAndVersions() {
            var specList = $scope.allSpecs === undefined ? $scope.cachedSpecs : $scope.allSpecs;

            if (specList !== undefined) {
                _.each(specList, function (specElement) {
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
                } else if (a.version > b.version) {
                    return  1;
                } else {
                    return -1;
                }
            })
        }
    }
]);