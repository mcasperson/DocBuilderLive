/// <reference path="../definitions/jquery.d.ts" />
/// <reference path="collections.ts" />
var RETRY_COUNT = 5;
var SERVER = "http://pressgang.lab.eng.pnq.redhat.com:8080";
var REVISION_DETAILS = "/pressgang-ccms/rest/1/sysinfo/get/json";

var RenderedTopicDetails = (function () {
    function RenderedTopicDetails() {
    }
    return RenderedTopicDetails;
})();

var DocBuilderLive = (function () {
    function DocBuilderLive(specId) {
        var _this = this;
        this.specId = specId;
        this.getLastModifiedTime(function (lastRevisionDate) {
            _this.lastRevisionDate = lastRevisionDate;
        }, function (title, message) {
            window.alert(title + "\n" + message);
        });
    }
    DocBuilderLive.prototype.getLastModifiedTime = function (callback, errorCallback, retryCount) {
        var _this = this;
        if (typeof retryCount === "undefined") { retryCount = 0; }
        jQuery.ajax({
            type: 'GET',
            url: SERVER + REVISION_DETAILS,
            dataType: "json",
            success: function (data) {
                callback(new Date(data.lastRevisionDate));
            },
            error: function () {
                if (retryCount < RETRY_COUNT) {
                    _this.getLastModifiedTime(callback, errorCallback, retryCount);
                } else {
                    errorCallback("Connection Error", "An error occurred while getting the server settings. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.");
                }
            }
        });
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
