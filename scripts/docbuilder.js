/// <reference path="../definitions/jquery.d.ts" />
/// <reference path="collections.ts" />
var SERVER = "http://pressgang.lab.eng.pnq.redhat.com:8080";
var REVISION_DETAILS = "/pressgang-ccms/rest/1/sysinfo/get/json";

var RenderedTopicDetails = (function () {
    function RenderedTopicDetails() {
    }
    return RenderedTopicDetails;
})();

var DocBuilderLive = (function () {
    function DocBuilderLive(specId) {
        this.specId = specId;
    }
    DocBuilderLive.prototype.getLastModifiedTime = function (callback) {
        jQuery.ajax();
    };

    DocBuilderLive.prototype.getSpec = function (callback) {
    };

    DocBuilderLive.prototype.getTopic = function (id, callback) {
    };

    DocBuilderLive.prototype.syncTopicsCollectionWithSpec = function () {
    };

    DocBuilderLive.prototype.syncDomWithSpec = function () {
    };
    return DocBuilderLive;
})();
//# sourceMappingURL=docbuilder.js.map
