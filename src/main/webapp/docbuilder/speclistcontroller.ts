/// <reference path="../definitions/angular.d.ts" />
/// <reference path="../definitions/underscore.d.ts" />
/// <reference path="../definitions/jquery.d.ts" />
/// <reference path="../definitions/URI.d.ts" />
/// <reference path="constants.ts" />

var CONTENT_SPEC_LIST_CACHE_KEY = "ContentSpecList";
var ZIP_FILE_NAME = "specs.json";
var REST_RETRY_COUNT = 5;

var UI_SETTING_KEY_PREFIX = "UISetting";
var UI_PRODUCT_NAME_FILTER_VAR = "productNameFilter";
var UI_VERSION_FILTER_VAR = "versionFilter";
var UI_SPEC_ID_FILTER_VAR = "idFilter";
var UI_TITLE_FILTER_VAR = "titleFilter";
var UI_FILTER_VARS = [UI_PRODUCT_NAME_FILTER_VAR, UI_VERSION_FILTER_VAR, UI_SPEC_ID_FILTER_VAR, UI_TITLE_FILTER_VAR];

/*
    This AngularJS Controller is used to populate the list of content specs
 */
var PAGING = 25;
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

specListModule.controller('specListController', ['$scope', '$resource', 'localStorageService', '$filter',
    function($scope, $resource, localStorageService, $filter) {

        _.each(UI_FILTER_VARS, function(element) {
            var localStorageKey =  UI_SETTING_KEY_PREFIX + element;

            if (localStorageService.keys().indexOf(localStorageKey) !== -1) {
                var value = localStorageService.get(localStorageKey);
                if (value !== null) {
                    $scope[element] = value;
                }
            }

            $scope.$watch(element, function() {
                localStorageService.set(localStorageKey, $scope[element]);
            });
        });

        var specListResource = $resource(
                SERVER + REST_BASE + "/contentspecs/get/json/all",
            {
                expand: '@expand'
            },
            {
                query: { method: "GET", isArray: false }
            }
        );

        var getSpecs = function(index, specs, count, callback, errorCallback) {
            if (count < REST_RETRY_COUNT) {
                new specListResource(SPEC_COLLECTION_EXPAND(index)).$query(function (data) {
                        if (specs !== undefined) {
                            jQuery.merge(specs, data.items);
                        } else {
                            specs = data.items;
                        }

                        if (data.endExpandIndex === data.size) {
                            callback(specs);
                            $scope.statuses = undefined;
                        } else {
                            if ($scope.statuses === undefined) {
                                $scope.statuses = [{text: "Refreshing", img:"images/smallloading.gif"}];
                            }
                            $scope.statuses[0].text = "Refreshing " + Math.floor(data.endExpandIndex / data.size * 100) + "%";

                            getSpecs(index + PAGING, specs, 0, callback, errorCallback);
                        }
                    },
                    function () {
                        /*
                         Error
                         */
                        getSpecs(index, specs, count + 1, callback, errorCallback);
                    }
                );
            } else {
                errorCallback();
            }
        }

        var getSpecsFromServer = function() {
            getSpecs(
                0,
                [],
                0,
                function(specs) {
                    $scope.allSpecs = specs;
                    $scope.cachedSpecs = undefined;
                    var zip = new JSZip();
                    zip.file(ZIP_FILE_NAME, JSON.stringify(specs));
                    localStorageService.set(CONTENT_SPEC_LIST_CACHE_KEY, zip.generate({type: "string", compression: "DEFLATE"}));
                    updateProductAndVersions();
                },
                function() {
                    if ($scope.cachedSpecs !== undefined) {
                        $scope.restError = "Could not contact the PressGang server. The list of content specifications shown below may be out of date. Please try again later."
                    } else {
                        $scope.restError = "Could not contact the PressGang server. Please try again later."
                    }
                }
            );
        }

        $scope.productAndVersions = [];

        if (localStorageService.keys().indexOf(CONTENT_SPEC_LIST_CACHE_KEY) !== -1) {
            //window.setTimeout(function() {
                try {
                    var zip = new JSZip();
                    zip.load(localStorageService.get(CONTENT_SPEC_LIST_CACHE_KEY));
                    $scope.cachedSpecs = JSON.parse(zip.file(ZIP_FILE_NAME).asText());
                    updateProductAndVersions();
                } catch (ex) {
                    console.log(ex);
                } finally {
                    getSpecsFromServer();
                }
            //}, 0);

        } else {
            getSpecsFromServer();
        }

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
            for (var i = ~~min; i <= ~~max; i += step) input.push(i);
            return input;
        };

        $scope.specsMatchFilter = function() {
            var matchingProdAndVer = $filter('filter')($scope.productAndVersions, {product: $scope.productNameFilter, version: $scope.versionFilter});
            var matchingTopics = _.find(matchingProdAndVer, function(element) {
                var collection = $filter('filter')(element.specs, {id: $scope.idFilter, title: $scope.titleFilter});
                return collection.length !== 0;
            });
            return matchingTopics !== undefined;
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

                _.each($scope.productAndVersions, function(prodVer) {
                    var specs = _.filter(specList, function (specElement) {
                        var product = _.filter(specElement.item.children_OTM.items, function (specElementChild) {
                            return  specElementChild.item.nodeType === "META_DATA" &&
                                specElementChild.item.title === "Product";
                        });

                        var version = _.filter(specElement.item.children_OTM.items, function (specElementChild) {
                            return  specElementChild.item.nodeType === "META_DATA" &&
                                specElementChild.item.title === "Version";
                        });

                        return product.length === 1 && product[0].item.additionalText === prodVer.product &&
                            ((prodVer.version === null && version.length === 0) ||
                                (prodVer.version !== null && version.length === 1 && version[0].item.additionalText === prodVer.version));
                    });

                    var matchingSpecs = [];
                    _.each(specs, function(element) {
                        var title = _.filter(element.item.children_OTM.items, function (specElementChild) {
                            return  specElementChild.item.nodeType === "META_DATA" && specElementChild.item.title === "Title";
                        });

                        if (title.length === 1) {
                            matchingSpecs.push({id: element.item.id, title: title[0].item.additionalText})
                        }
                    });

                    matchingSpecs.sort(function(a, b):int {
                        return a.title.toLowerCase() > b.title.toLowerCase();
                    });

                    prodVer.specs = matchingSpecs;
                })
            }

            $scope.productAndVersions.sort(function(a, b):number {
                if (a.product.toLowerCase() < b.product.toLowerCase()) {
                    return -1;
                } else if (a.product.toLowerCase() > b.product.toLowerCase()) {
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