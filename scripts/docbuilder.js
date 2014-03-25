/// <reference path="../definitions/jquery.d.ts" />
/// <reference path="../definitions/underscore.d.ts" />
/// <reference path="collections.ts" />
var CHAPTER_NODE_TYPE = "CHAPTER";
var CONTAINER_NODE_TYPES = [CHAPTER_NODE_TYPE];
var RETRY_COUNT = 5;
var SERVER = "http://pressgang.lab.eng.pnq.redhat.com:8080";
var REVISION_DETAILS_REST = "/pressgang-ccms/rest/1/sysinfo/get/json";
var SPEC_REST = "/pressgang-ccms/rest/1/contentspec/get/json/";
var SPEC_REST_EXPAND = {
    branches: [
        {
            trunk: {
                name: "children_OTM"
            }
        }
    ]
};
var SPECNODE_REST = "/contentspecnode/get/json/";

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
            url: SERVER + REVISION_DETAILS_REST,
            dataType: "json",
            success: function (data) {
                callback(new Date(data.lastRevisionDate));
            },
            error: function () {
                if (retryCount < RETRY_COUNT) {
                    _this.getLastModifiedTime(callback, errorCallback, ++retryCount);
                } else {
                    errorCallback("Connection Error", "An error occurred while getting the server settings. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.");
                }
            }
        });
    };

    DocBuilderLive.prototype.populateChild = function (id, callback, errorCallback, retryCount) {
        var _this = this;
        if (typeof retryCount === "undefined") { retryCount = 0; }
        jQuery.ajax({
            type: 'GET',
            url: SERVER + SPEC_REST + encodeURIComponent(JSON.stringify(SPEC_REST_EXPAND)),
            dataType: "json",
            success: function (data) {
                var expandChildren = function (index) {
                    if (index >= data.children_OTM.items.length) {
                        callback(data);
                    } else {
                        var element = data.children_OTM.items[index];
                        if (CONTAINER_NODE_TYPES.indexOf(element.nodeType) !== -1) {
                            _this.populateChild(element.id, function (node) {
                                data.children_OTM.items[index] = node;
                                expandChildren(++index);
                            }, errorCallback);
                        }
                    }
                };

                expandChildren(0);
            },
            error: function () {
                if (retryCount < RETRY_COUNT) {
                    _this.getLastModifiedTime(callback, errorCallback, ++retryCount);
                } else {
                    errorCallback("Connection Error", "An error occurred while getting the content spec details. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.");
                }
            }
        });
    };

    DocBuilderLive.prototype.getSpec = function (callback, errorCallback, retryCount) {
        var _this = this;
        if (typeof retryCount === "undefined") { retryCount = 0; }
        jQuery.ajax({
            type: 'GET',
            url: SERVER + SPEC_REST + encodeURIComponent(JSON.stringify(SPEC_REST_EXPAND)),
            dataType: "json",
            success: function (data) {
                var expandChildren = function (index) {
                    if (index >= data.children_OTM.items.length) {
                        callback(data);
                    } else {
                        var element = data.children_OTM.items[index];
                        if (CONTAINER_NODE_TYPES.indexOf(element.nodeType) !== -1) {
                            _this.populateChild(element.id, function (node) {
                                data.children_OTM.items[index] = node;
                                expandChildren(++index);
                            }, errorCallback);
                        }
                    }
                };

                expandChildren(0);
            },
            error: function () {
                if (retryCount < RETRY_COUNT) {
                    _this.getLastModifiedTime(callback, errorCallback, ++retryCount);
                } else {
                    errorCallback("Connection Error", "An error occurred while getting the content spec details. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.");
                }
            }
        });
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
