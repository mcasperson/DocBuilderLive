/// <reference path="../definitions/jquery.d.ts" />
/// <reference path="../definitions/underscore.d.ts" />
/// <reference path="collections.ts" />
var DELAY_BETWEEN_IFRAME_SRC_CALLS = 1000;
var CONCURRENT_IFRAME_DOWNLOADS = 2;
var LOADING_TOPIC_DIV_CLASS = "loadingTopicDiv";
var IFRAME_ID_PREFIX = "iframeId";
var DIV_ID_PREFIX = "divId";
var LOADING_HTML = "<div style='width: 100%; text-align: center;'>LOADING</div>";
var TOPIC_ID_MARKER = "#TOPICID#";
var TOPIC_REV_MARKER = "#TOPICREV#";
var CSNODE_ID_MARKER = "#CSNODEID#";
var CSNODE_REV_MARKER = "#CSNODEREV#";
var CONTAINER_NODE_TYPES = ["CHAPTER", "SECTION", "PART", "APPENDIX", "INITIAL_CONTENT"];
var INITIAL_CONTENT_TOPIC = "INITIAL_CONTENT_TOPIC";
var TOPIC = "TOPIC";
var TOPIC_NODE_TYPES = [TOPIC, INITIAL_CONTENT_TOPIC];
var RETRY_COUNT = 5;

//var SERVER:string = "http://pressgang.lab.eng.pnq.redhat.com:8080";
//var SERVER:string = "http://topicindex-dev.ecs.eng.bne.redhat.com:8080"
var SERVER = "http://localhost:8080";
var REST_BASE = "/pressgang-ccms/rest/1";
var REVISION_DETAILS_REST = REST_BASE + "/sysinfo/get/json";
var SPEC_REST = REST_BASE + "/contentspec/get/json/";
var SPEC_REST_EXPAND = {
    branches: [
        {
            trunk: {
                name: "children_OTM"
            },
            branches: [
                {
                    trunk: {
                        name: "nextNode"
                    }
                }
            ]
        }
    ]
};
var SPECNODE_REST = REST_BASE + "/contentspecnode/get/json/";
var TOPIC_XSLTXML_REST = REST_BASE + "/topic/get/xml/" + TOPIC_ID_MARKER + "/xslt+xml";
var TOPIC_REV_XSLTXML_REST = REST_BASE + "/topic/get/xml/" + TOPIC_ID_MARKER + "/r/" + TOPIC_REV_MARKER + "/xslt+xml";
var CSNODE_XSLTXML_REST = REST_BASE + "/contentspecnode/get/xml/" + CSNODE_ID_MARKER + "/xslt+xml";
var CSNODE_REV_XSLTXML_REST = REST_BASE + "/contentspecnode/get/xml/" + CSNODE_ID_MARKER + "/r/" + CSNODE_REV_MARKER + "/xslt+xml";
var ECHO_XML_REST = REST_BASE + "/echoxml";

function error(message) {
    window.alert(message);
}

var IdRevPair = (function () {
    function IdRevPair(id, rev) {
        this.id = id;
        this.rev = rev;
    }
    IdRevPair.prototype.toString = function () {
        return this.id + ":" + this.rev;
    };
    return IdRevPair;
})();

var DocBuilderLive = (function () {
    function DocBuilderLive(specId) {
        var _this = this;
        this.errorCallback = function (title, message) {
            window.alert(title + "\n" + message);
        };
        window.addEventListener('message', function (e) {
            try  {
                var message = JSON.parse(e.data);
                if (message.html !== undefined) {
                    var source = e.source;
                    var iframes = jQuery("iframe").toArray();
                    var sourceIframe = _.find(iframes, function (element) {
                        return element.contentWindow === source;
                    });
                    if (sourceIframe !== undefined) {
                        try  {
                            jQuery(sourceIframe["div"]).html(message.html.replace(/<head[\s\S]*?<\/head>/g, "")).removeClass(LOADING_TOPIC_DIV_CLASS);
                        } catch (ex) {
                            console.log(ex);
                        }

                        sourceIframe.parentElement.removeChild(sourceIframe);

                        /*
                        The iframes have their src set either when the iframe before them
                        finishes loading, or when a timeout occurs.
                        */
                        var iframeId = parseInt(sourceIframe.id.replace(IFRAME_ID_PREFIX, ""));
                        if (!isNaN(iframeId)) {
                            var nextIframeId = IFRAME_ID_PREFIX + (iframeId + 1);
                            var nextIframe;
                            while ((nextIframe = jQuery("#" + nextIframeId)).length !== 0) {
                                var nextIFrameElement = nextIframe[0];
                                if (nextIFrameElement["setSrc"] === undefined) {
                                    nextIFrameElement["setSrc"] = true;
                                    nextIFrameElement.src = nextIFrameElement["url"];
                                    break;
                                }
                                ++iframeId;
                                nextIframeId = IFRAME_ID_PREFIX + (iframeId + 1);
                            }
                        }
                    }
                }
            } catch (ex) {
                // message was not json
            }
        });

        this.specId = specId;
        this.getLastModifiedTime(function (lastRevisionDate) {
            _this.lastRevisionDate = lastRevisionDate;
            _this.getSpec(function (spec) {
                _this.getTopics(spec);
            }, _this.errorCallback);
        }, this.errorCallback);
    }
    DocBuilderLive.prototype.getLastModifiedTime = function (callback, errorCallback, retryCount) {
        if (typeof retryCount === "undefined") { retryCount = 0; }
        var _this = this;
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

    /**
    * Get a content spec node with all children expanded
    * @param id The id of the spec node to expand
    * @param callback Called with the fully expanded spec node
    * @param errorCallback Called if there was a network error
    * @param retryCount An internal count that tracks how many time to retry a particular call
    */
    DocBuilderLive.prototype.populateChild = function (id, callback, errorCallback, retryCount) {
        if (typeof retryCount === "undefined") { retryCount = 0; }
        var _this = this;
        jQuery.ajax({
            type: 'GET',
            url: SERVER + SPECNODE_REST + id + "?expand=" + encodeURIComponent(JSON.stringify(SPEC_REST_EXPAND)),
            dataType: "json",
            success: function (data) {
                var expandChildren = function (index) {
                    if (index >= data.children_OTM.items.length) {
                        callback(data);
                    } else {
                        var element = data.children_OTM.items[index].item;
                        if (CONTAINER_NODE_TYPES.indexOf(element.nodeType) !== -1) {
                            _this.populateChild(element.id, function (node) {
                                data.children_OTM.items[index].item.children_OTM = node.children_OTM;
                                expandChildren(++index);
                            }, errorCallback);
                        } else {
                            expandChildren(++index);
                        }
                    }
                };

                expandChildren(0);
            },
            error: function () {
                if (retryCount < RETRY_COUNT) {
                    _this.populateChild(id, callback, errorCallback, ++retryCount);
                } else {
                    errorCallback("Connection Error", "An error occurred while getting the content spec details. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.");
                }
            }
        });
    };

    /**
    * Get a spec with all child details expanded
    * @param callback Called with the expanded spec object
    * @param errorCallback Called if there was a network error
    * @param retryCount An internal count that tracks how many time to retry a particular call
    */
    DocBuilderLive.prototype.getSpec = function (callback, errorCallback, retryCount) {
        if (typeof retryCount === "undefined") { retryCount = 0; }
        var _this = this;
        jQuery.ajax({
            type: 'GET',
            url: SERVER + SPEC_REST + this.specId + "?expand=" + encodeURIComponent(JSON.stringify(SPEC_REST_EXPAND)),
            dataType: "json",
            success: function (data) {
                var expandChildren = function (index) {
                    if (index >= data.children_OTM.items.length) {
                        callback(data);
                    } else {
                        var element = data.children_OTM.items[index].item;
                        if (CONTAINER_NODE_TYPES.indexOf(element.nodeType) !== -1) {
                            _this.populateChild(element.id, function (node) {
                                data.children_OTM.items[index].item.children_OTM = node.children_OTM;
                                expandChildren(++index);
                            }, errorCallback);
                        } else {
                            expandChildren(++index);
                        }
                    }
                };

                expandChildren(0);
            },
            error: function () {
                if (retryCount < RETRY_COUNT) {
                    _this.getSpec(callback, errorCallback, ++retryCount);
                } else {
                    errorCallback("Connection Error", "An error occurred while getting the content spec details. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.");
                }
            }
        });
    };

    /**
    * Given a spec, create iframes for all topics that have not been previously rendered
    * @param spec The spec with all children expanded
    */
    DocBuilderLive.prototype.getTopics = function (spec) {
        jQuery("#loading").remove();

        var localUrl = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port;

        /*
        Get the list of topics that make up the spec in sequential order
        */
        function expandChild(node) {
            /*
            Find the one that has no nextNode
            */
            var lastChild;
            var lastInitialTextChild;
            _.each(node.children_OTM.items, function (childNode, index, list) {
                if (childNode.item.nextNode === null) {
                    if (childNode.item.nodeType === INITIAL_CONTENT_TOPIC) {
                        lastInitialTextChild = childNode.item;
                    } else {
                        lastChild = childNode.item;
                    }
                }
            });

            if (lastChild === undefined && lastInitialTextChild == undefined) {
                error("Could not find the last child in the linked list");
                return;
            }

            var reverseChildren = [];
            var entryNodes = [lastInitialTextChild, lastChild];
            _.each(entryNodes, function (entryNode, index, array) {
                if (entryNode !== undefined) {
                    if (CONTAINER_NODE_TYPES.indexOf(entryNode.nodeType) !== -1) {
                        jQuery.merge(reverseChildren, expandChild(entryNode));
                    }

                    reverseChildren.push(entryNode);

                    while (true) {
                        var nextLastChild = _.find(node.children_OTM.items, function (element) {
                            return element.item.nextNode !== undefined && element.item.nextNode !== null && element.item.nextNode.id === entryNode.id;
                        });

                        if (nextLastChild === undefined) {
                            break;
                        }

                        entryNode = nextLastChild.item;

                        if (CONTAINER_NODE_TYPES.indexOf(entryNode.nodeType) !== -1) {
                            jQuery.merge(reverseChildren, expandChild(entryNode));
                        }

                        reverseChildren.push(entryNode);
                    }
                }
            });

            return reverseChildren;
        }

        var specTopics = expandChild(spec);

        specTopics.reverse();

        var delay = 0;
        var iframeId = 0;

        _.each(specTopics, function (element, index, list) {
            if (TOPIC_NODE_TYPES.indexOf(element.nodeType) !== -1 || CONTAINER_NODE_TYPES.indexOf(element.nodeType) !== -1) {
                ++iframeId;

                /*
                Create the hidden iframe that accepts the XML, transforms it, and posts a message back with the
                HTML
                */
                var iFrame = document.createElement("iframe");
                iFrame.style.display = "none";
                iFrame.id = IFRAME_ID_PREFIX + iframeId;
                document.body.appendChild(iFrame);

                /*
                Create the div that will be filled with the HTML sent by the iframe.
                */
                var div = jQuery("<div></div>");
                iFrame["div"] = div;
                div.addClass(LOADING_TOPIC_DIV_CLASS);
                div.html(LOADING_HTML);
                div[0]["linkTargets"] = [];

                /*
                Links to topics can be done through either the topic id or the target id. We
                append two divs with these ids as link targets.
                */
                if (element.entityId !== null) {
                    var idLinkTarget = jQuery("<div id='" + DIV_ID_PREFIX + element.entityId + "'></div>");
                    div[0]["linkTargets"].push(idLinkTarget);
                    jQuery("#book").append(idLinkTarget);
                }

                if (element.targetId !== null) {
                    var nameLinkTarget = jQuery("<div id='" + DIV_ID_PREFIX + element.targetId + "'></div>");
                    div[0]["linkTargets"].push(nameLinkTarget);
                    jQuery("#book").append(nameLinkTarget);
                }

                var url;

                if (TOPIC_NODE_TYPES.indexOf(element.nodeType) !== -1) {
                    div.attr("data-specNodeId", element.id.toString());
                    if (element.revision === undefined) {
                        url = SERVER + CSNODE_XSLTXML_REST.replace(CSNODE_ID_MARKER, element.id.toString()) + "?parentDomain=" + localUrl + "&baseUrl=%23divId%23TOPICID%23";
                        iFrame.src = url;
                    } else {
                        url = SERVER + CSNODE_XSLTXML_REST.replace(CSNODE_ID_MARKER, element.id.toString()).replace(CSNODE_REV_MARKER, element.revision.toString()) + "?parentDomain=" + localUrl + "&baseUrl=%23divId%23TOPICID%23";
                        div.attr("data-specNodeRev", element.revision.toString());
                    }
                } else if (CONTAINER_NODE_TYPES.indexOf(element.nodeType) !== -1) {
                    div.attr("data-title", element.title);
                    div.attr("data-container", element.nodeType.toLowerCase());
                    var xml = "<?xml-stylesheet type='text/xsl' href='/pressgang-ccms-static/publican-docbook/html-single-diff.xsl'?>\n" + "<" + element.nodeType.toLowerCase() + ">\n" + "<title>" + element.title + "</title>\n" + "</" + element.nodeType.toLowerCase() + ">";
                    url = SERVER + ECHO_XML_REST + "?xml=" + encodeURIComponent(xml) + "&parentDomain=" + localUrl;
                }

                jQuery("#book").append(div);

                iFrame["url"] = url;

                /*
                We want to start a few iframes download the xml concurrently.
                */
                if (iframeId <= CONCURRENT_IFRAME_DOWNLOADS) {
                    iFrame.src = iFrame["url"];
                    iFrame["setSrc"] = true;
                    delay += DELAY_BETWEEN_IFRAME_SRC_CALLS;
                } else {
                    /*
                    The iframes have their src set either when the iframe before them
                    finishes loading, or when a timeout occurs.
                    */
                    window.setTimeout(function () {
                        if (iFrame["setSrc"] === undefined) {
                            iFrame.src = iFrame["url"];
                            iFrame["setSrc"] = true;
                        }
                    }, delay);

                    delay += DELAY_BETWEEN_IFRAME_SRC_CALLS;
                }
            }
        });
    };

    DocBuilderLive.prototype.syncTopicsCollectionWithSpec = function () {
    };

    DocBuilderLive.prototype.syncDomWithSpec = function () {
    };
    return DocBuilderLive;
})();

new DocBuilderLive(13968);
//# sourceMappingURL=docbuilder.js.map
