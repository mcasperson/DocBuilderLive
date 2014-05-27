/// <reference path="../definitions/angular.d.ts" />
/// <reference path="constants.ts" />
/// <reference path="docbuilder.ts" />


var specListModule = angular.module('renderedSpecModule', ['ngResource']);

specListModule.controller('renderedSpecController', ['$scope', '$routeParams',
    function($scope, $routeParams) {
        new DocBuilderLive($routeParams.specId);

        $scope.links = [
            {
                id: "specList",
                href: "#/",
                text: "Spec List"
            },
            {
                id: "editSpec",
                href: "#",
                text: "Edit Spec"
            },
            {
                id: "bugReport",
                href: "https://bugzilla.redhat.com/enter_bug.cgi?alias=&assigned_to=pressgang-ccms-dev%40redhat.com&bug_status=NEW&component=DocBook-builder&product=PressGang%20CCMS&version=1.6",
                text: "Report Bug"
            }
        ]
    }
]);