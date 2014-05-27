/// <reference path="../definitions/angular.d.ts" />
/// <reference path="../definitions/underscore.d.ts" />
/// <reference path="../definitions/jquery.d.ts" />
/// <reference path="constants.ts" />

var CONTENT_SPEC_LIST_CACHE_KEY = "ContentSpecList";
var ZIP_FILE_NAME = "specs.json";
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

        var getSpecsFromServer = function() {
            getSpecs(0, [], function(specs) {
                $scope.allSpecs = specs;
                $scope.cachedSpecs = undefined;
                var zip = new JSZip();
                zip.file(ZIP_FILE_NAME, JSON.stringify(specs));
                localStorageService.set(CONTENT_SPEC_LIST_CACHE_KEY, zip.generate({type: "string", compression: "DEFLATE"}));
                updateProductAndVersions();
            });
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
            for (var i = min; i <= max; i += step) input.push(i);
            return input;
        };

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