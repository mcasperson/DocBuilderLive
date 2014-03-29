/// <reference path="../definitions/jquery.d.ts" />
/// <reference path="../definitions/underscore.d.ts" />
/// <reference path="../definitions/moment.d.ts" />
/// <reference path="collections.ts" />
var REFRESH_DELAY = 10000;
var DELAY_BETWEEN_IFRAME_SRC_CALLS = 1000;
var CONCURRENT_IFRAME_DOWNLOADS = 2;
var SPEC_DIV_LINK_TARGETS_PROPERTY = "linkTargets";
var SPEC_TOPIC_DIV_ENTITY_ID = "data-specNodeId";
var SPEC_TOPIC_DIV_ENTITY_REV = "data-specNodeRev";
var SPEC_TITLE = "data-title";
var SPEC_TITLE_CONTAINER = "data-container";
var LOADING_TOPIC_DIV_CLASS = "loadingTopicDiv";

/**
* Used to identify any div that holds spec info (topic contents or container title)
* @type {string}
*/
var SPEC_DIV_CLASS = "contentSpecDiv";

/**
* Used to identify any divs that are displaying topic information
* @type {string}
*/
var SPEC_TOPIC_DIV_CLASS = "contentSpecTopicDiv";

/**
* Used to identify any divs that are displaying titles
* @type {string}
*/
var SPEC_TITLE_DIV_CLASS = "contentSpecTitleDiv";
var IFRAME_ID_PREFIX = "iframeId";

/**
* The ID assigned to a div that holds some spec content. This is followed by an integer (ie divId0)
* that defines the position of the div in the linear flow of the book.
* @type {string}
*/
var DIV_ID_PREFIX = "divId";
var DIV_BOOK_INDEX_ID_PREFIX = "divBookIndex";
var LOADING_HTML = "<div style='width: 100%; text-align: center;'>LOADING</div>";
var TOPIC_ID_MARKER = "#TOPICID#";
var TOPIC_REV_MARKER = "#TOPICREV#";
var CSNODE_ID_MARKER = "#CSNODEID#";
var CSNODE_REV_MARKER = "#CSNODEREV#";
var CONTENT_SPEC_ID_MARKER = "#CONTENTSPECID#";
var CONTENT_SPEC_EDIT_DATE_MARKER = "#CONTENTSPECEDITDATE#";
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
var SPECS_REST = REST_BASE + "/contentspecs/get/json/query;logic=And;contentSpecIds=" + CONTENT_SPEC_ID_MARKER + ";startEditDate=" + CONTENT_SPEC_EDIT_DATE_MARKER;
var SPECS_REST_EXPAND = {
    branches: [
        {
            trunk: {
                name: "contentSpecs"
            },
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
        }
    ]
};

function error(message) {
    window.alert(message);
}

function message(message) {
    console.log(message);
}
function nodeIsTopic(specNode) {
    return TOPIC_NODE_TYPES.indexOf(specNode.nodeType) !== -1;
}

function nodeIsContainer(specNode) {
    return CONTAINER_NODE_TYPES.indexOf(specNode.nodeType) !== -1;
}

function nodeIsTopicOrContainer(specNode) {
    return nodeIsContainer(specNode) || nodeIsTopic(specNode);
}

var TreeNode = (function () {
    function TreeNode() {
        this.children = [];
    }
    return TreeNode;
})();

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
        this.findUpdatedSpec = function (callback, errorCallback, retryCount) {
            if (typeof retryCount === "undefined") { retryCount = 0; }
            var startEditDate = moment(_this.lastRevisionDate).format("YYYY-MM-DDTHH:mm:ss.SSSZ");
            var url = SERVER + SPECS_REST.replace(CONTENT_SPEC_ID_MARKER, _this.specId.toString()).replace(CONTENT_SPEC_EDIT_DATE_MARKER, encodeURIComponent(encodeURIComponent(startEditDate))) + "?expand=" + encodeURIComponent(JSON.stringify(SPECS_REST_EXPAND));

            jQuery.ajax({
                type: 'GET',
                url: url,
                dataType: "json",
                context: _this,
                success: function (data) {
                    callback.bind(_this)(data);
                },
                error: function () {
                    if (retryCount < RETRY_COUNT) {
                        _this.findUpdatedSpec(callback, errorCallback, ++retryCount);
                    } else {
                        errorCallback.bind(_this)("Connection Error", "An error occurred while getting the content spec details. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.");
                    }
                }
            });
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
                        var nextIFrame = jQuery(sourceIframe);
                        while ((nextIFrame = nextIFrame.next("iframe")).length !== 0) {
                            var nextIFrameElement = nextIFrame[0];
                            if (nextIFrameElement["setSrc"] === undefined) {
                                nextIFrameElement["setSrc"] = true;
                                nextIFrameElement.src = nextIFrameElement["url"];
                                break;
                            }
                        }

                        if (nextIFrame.length === 0) {
                            // there are no more iframes to load
                            this.startRefreshCycle();
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
                _this.buildToc(spec);
                var specNodes = _this.getAllChildrenInFlatOrder(spec);
                _this.getTopics(specNodes);
            }, _this.errorCallback);
        }, this.errorCallback);
    }
    DocBuilderLive.prototype.getLastModifiedTime = function (callback, errorCallback, retryCount) {
        if (typeof retryCount === "undefined") { retryCount = 0; }
        var _this = this;
        var success = function (data) {
            callback.bind(_this)(new Date(data.lastRevisionDate));
        };

        var error = function () {
            if (retryCount < RETRY_COUNT) {
                _this.getLastModifiedTime(callback, errorCallback, ++retryCount);
            } else {
                errorCallback.bind(_this)("Connection Error", "An error occurred while getting the server settings. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.");
            }
        };

        jQuery.ajax({
            type: 'GET',
            url: SERVER + REVISION_DETAILS_REST,
            dataType: "json",
            success: success,
            error: error,
            context: this
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
            context: this,
            success: function (data) {
                var expandChildren = function (index) {
                    if (index >= data.children_OTM.items.length) {
                        callback.bind(_this)(data);
                    } else {
                        var element = data.children_OTM.items[index].item;
                        if (nodeIsContainer(element)) {
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
                    errorCallback.bind(_this)("Connection Error", "An error occurred while getting the content spec details. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.");
                }
            }
        });
    };

    DocBuilderLive.prototype.expandSpec = function (spec, callback, errorCallback) {
        var _this = this;
        var expandChildren = function (index) {
            if (index >= spec.children_OTM.items.length) {
                callback(spec);
            } else {
                var element = spec.children_OTM.items[index].item;
                if (nodeIsContainer(element)) {
                    _this.populateChild(element.id, function (node) {
                        spec.children_OTM.items[index].item.children_OTM = node.children_OTM;
                        expandChildren(++index);
                    }, errorCallback);
                } else {
                    expandChildren(++index);
                }
            }
        };

        expandChildren(0);
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
            context: this,
            success: function (data) {
                _this.expandSpec(data, callback, errorCallback);
            },
            error: function () {
                if (retryCount < RETRY_COUNT) {
                    _this.getSpec(callback, errorCallback, ++retryCount);
                } else {
                    errorCallback.bind(_this)("Connection Error", "An error occurred while getting the content spec details. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.");
                }
            }
        });
    };

    DocBuilderLive.prototype.getAllChildrenInFlatOrder = function (spec) {
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
                throw "Could not find the last child in the linked list";
                return;
            }

            var reverseChildren = [];
            var entryNodes = [lastInitialTextChild, lastChild];
            _.each(entryNodes, function (entryNode, index, array) {
                if (entryNode !== undefined) {
                    if (nodeIsContainer(entryNode)) {
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

                        if (nodeIsContainer(entryNode)) {
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

        return specTopics;
    };

    DocBuilderLive.prototype.getChildrenInOrder = function (parent) {
        /*
        Find the one that has no nextNode
        */
        var lastChild;
        var lastInitialTextChild;
        _.each(parent.children_OTM.items, function (childNode, index, list) {
            if (childNode.item.nextNode === null) {
                if (childNode.item.nodeType === INITIAL_CONTENT_TOPIC) {
                    lastInitialTextChild = childNode.item;
                } else {
                    lastChild = childNode.item;
                }
            }
        });

        if (lastChild === undefined && lastInitialTextChild == undefined) {
            throw "Could not find the last child in the linked list";
        }

        var reverseChildren = [];
        var entryNodes = [lastInitialTextChild, lastChild];
        _.each(entryNodes, function (entryNode, index, array) {
            if (entryNode !== undefined) {
                reverseChildren.push(entryNode);

                while (true) {
                    var nextLastChild = _.find(parent.children_OTM.items, function (element) {
                        return element.item.nextNode !== undefined && element.item.nextNode !== null && element.item.nextNode.id === entryNode.id;
                    });

                    if (nextLastChild === undefined) {
                        break;
                    }

                    entryNode = nextLastChild.item;

                    reverseChildren.push(entryNode);
                }
            }
        });

        reverseChildren.reverse();
        return reverseChildren;
    };

    DocBuilderLive.prototype.buildIFrameAndDiv = function (element) {
        var localUrl = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port;

        /*
        Create the hidden iframe that accepts the XML, transforms it, and posts a message back with the
        HTML
        */
        var iFrame = document.createElement("iframe");
        iFrame.style.display = "none";
        document.body.appendChild(iFrame);

        /*
        Create the div that will be filled with the HTML sent by the iframe.
        */
        var div = jQuery("<div></div>");
        iFrame["div"] = div;
        div.addClass(LOADING_TOPIC_DIV_CLASS);
        div.addClass(SPEC_DIV_CLASS);
        div.html(LOADING_HTML);
        div[0][SPEC_DIV_LINK_TARGETS_PROPERTY] = [];

        /*
        Links to topics can be done through either the topic id or the target id. We
        append two divs with these ids as link targets.
        */
        var existingSpecDivElementCount = jQuery("div." + SPEC_DIV_CLASS).length;

        var indexTarget = jQuery("<div id='" + DIV_BOOK_INDEX_ID_PREFIX + existingSpecDivElementCount + "'></div>");
        div[0][SPEC_DIV_LINK_TARGETS_PROPERTY].push(indexTarget);
        jQuery("#book").append(indexTarget);

        if (element.entityId !== null) {
            var idLinkTarget = jQuery("<div id='" + DIV_ID_PREFIX + element.entityId + "'></div>");
            div[0][SPEC_DIV_LINK_TARGETS_PROPERTY].push(idLinkTarget);
            jQuery("#book").append(idLinkTarget);
        }

        if (element.targetId !== null) {
            var nameLinkTarget = jQuery("<div id='" + DIV_ID_PREFIX + element.targetId + "'></div>");
            div[0][SPEC_DIV_LINK_TARGETS_PROPERTY].push(nameLinkTarget);
            jQuery("#book").append(nameLinkTarget);
        }

        var url;

        if (nodeIsTopic(element)) {
            div.addClass(SPEC_TOPIC_DIV_CLASS);
            div.attr(SPEC_TOPIC_DIV_ENTITY_ID, element.id.toString());
            if (element.revision === undefined) {
                url = SERVER + CSNODE_XSLTXML_REST.replace(CSNODE_ID_MARKER, element.id.toString()) + "?parentDomain=" + localUrl + "&baseUrl=%23divId%23TOPICID%23";
                iFrame.src = url;
            } else {
                url = SERVER + CSNODE_XSLTXML_REST.replace(CSNODE_ID_MARKER, element.id.toString()).replace(CSNODE_REV_MARKER, element.revision.toString()) + "?parentDomain=" + localUrl + "&baseUrl=%23divId%23TOPICID%23";
                div.attr(SPEC_TOPIC_DIV_ENTITY_REV, element.revision.toString());
            }
        } else if (nodeIsContainer(element)) {
            div.addClass(SPEC_TITLE_DIV_CLASS);
            div.attr(SPEC_TITLE, element.title);
            div.attr(SPEC_TITLE_CONTAINER, element.nodeType.toLowerCase());
            var xml = "<?xml-stylesheet type='text/xsl' href='/pressgang-ccms-static/publican-docbook/html-single-diff.xsl'?>\n" + "<" + element.nodeType.toLowerCase() + ">\n" + "<title>" + element.title + "</title>\n" + "</" + element.nodeType.toLowerCase() + ">";
            url = SERVER + ECHO_XML_REST + "?xml=" + encodeURIComponent(xml) + "&parentDomain=" + localUrl;
        }

        jQuery("#book").append(div);

        iFrame["url"] = url;

        return iFrame;
    };

    DocBuilderLive.prototype.setIFrameSrc = function (iFrame, delay, count) {
        /*
        We want to start a few iframes downloading the xml concurrently.
        */
        if (count <= CONCURRENT_IFRAME_DOWNLOADS) {
            iFrame.src = iFrame["url"];
            iFrame["setSrc"] = true;
        } else {
            /*
            The iframes have their src set either when the iframe before them
            finishes loading (see the message listener in the constructor), or when a timeout occurs.
            This gives us a fallback in case an iframe didn't load properly.
            */
            window.setTimeout(function () {
                if (iFrame["setSrc"] === undefined) {
                    iFrame.src = iFrame["url"];
                    iFrame["setSrc"] = true;
                }
            }, delay);
        }
    };

    /**
    * Given a spec, create iframes for all topics that have not been previously rendered
    * @param spec The spec with all children expanded
    */
    DocBuilderLive.prototype.getTopics = function (specTopics) {
        var _this = this;
        jQuery("#loading").remove();

        var topicsAndContainers = _.filter(specTopics, nodeIsTopicOrContainer);

        var delay = _.reduce(topicsAndContainers, function (delay, element, index) {
            var iFrame = this.buildIFrameAndDiv(element);
            this.setIFrameSrc(iFrame, delay, index);
            return delay + DELAY_BETWEEN_IFRAME_SRC_CALLS;
        }, 0, this);

        this.timeoutRefresh = window.setTimeout(function () {
            _this.startRefreshCycle();
        }, delay);
    };

    DocBuilderLive.prototype.buildToc = function (spec) {
        var _this = this;
        var childIndex = 0;

        var addChildren = function (specNode, parent) {
            var isContainer = nodeIsContainer(specNode);
            var isTopic = nodeIsTopic(specNode);
            if (isContainer || isTopic) {
                var treeNode = new TreeNode();
                treeNode.text = specNode.title;
                treeNode.icon = isContainer ? "/images/folderopen.png" : "/images/file.png";
                treeNode.data = childIndex.toString();

                ++childIndex;

                parent.children.push(treeNode);
                if (specNode.children_OTM !== null) {
                    var children = _this.getChildrenInOrder(specNode);
                    _.each(children, function (element) {
                        addChildren(element, treeNode);
                    });
                }
            }
        };

        var toc = new TreeNode();
        var children = this.getChildrenInOrder(spec);
        _.each(children, function (element) {
            addChildren(element, toc);
        });

        jQuery("#toc").remove();

        var tocDiv = jQuery("<div id='toc'></div>").jstree({
            'core': {
                'multiple': false,
                'data': toc.children
            }
        }).on('changed.jstree', function (e, data) {
            if (data.selected.length !== 0) {
                var treeNode = data.instance.get_node(data.selected[0]);
                var div = document.getElementById(DIV_BOOK_INDEX_ID_PREFIX + treeNode.data);
                if (div !== null) {
                    div.scrollIntoView(true);
                }
            }
        });
        jQuery(document.body).append(tocDiv);
    };

    DocBuilderLive.prototype.startRefreshCycle = function () {
        var _this = this;
        message("Will refresh in " + (REFRESH_DELAY / 1000) + " seconds.");

        window.clearTimeout(this.timeoutRefresh);
        this.timeoutRefresh = null;

        window.setTimeout(function () {
            _this.findUpdatesToSpec(function (updatedSpec) {
                if (!updatedSpec) {
                    _this.startRefreshCycle();
                }
            });
        }, REFRESH_DELAY);
    };

    DocBuilderLive.prototype.findUpdatesToSpec = function (callback) {
        var _this = this;
        var errorCallback = function (title, message) {
            _this.startRefreshCycle();
        };

        this.getLastModifiedTime(function (lastRevisionDate) {
            _this.findUpdatedSpec(function (spec) {
                /*
                Searches will return specs that were edited on or after the date specified. We only
                want specs edited after the date specified.
                */
                var specIsUpdated = spec.items.length !== 0 && new Date(spec.items[0].item.lastModified) > _this.lastRevisionDate;
                if (specIsUpdated) {
                    var updatedSpec = spec.items[0].item;
                    _this.expandSpec(updatedSpec, function (expandedSpec) {
                        _this.syncDomWithSpec(expandedSpec);
                        _this.buildToc(expandedSpec);
                    }, errorCallback);
                }

                _this.lastRevisionDate = lastRevisionDate;

                callback(specIsUpdated);
            }, errorCallback);
        }, errorCallback);
    };

    DocBuilderLive.prototype.findUpdatesToTopics = function (callback) {
    };

    DocBuilderLive.prototype.syncTopicsCollectionWithSpec = function (updatedSpec) {
    };

    /**
    * Here we take the topics associated with the new version of the content spec, remove any existing displayed
    * topics that are no longer present, and create new divs for missing topics, or reorder existing topics
    * to match the layout of the new spec.
    * @param updatedSpec
    */
    DocBuilderLive.prototype.syncDomWithSpec = function (updatedSpec) {
        var _this = this;
        function getTopicDiv(specNode) {
            if (specNode.entityRevision === null) {
                return jQuery("div[" + SPEC_TOPIC_DIV_ENTITY_ID + "='" + specNode.id + "']");
            } else {
                return jQuery("div[" + SPEC_TOPIC_DIV_ENTITY_ID + "='" + specNode.id + "'][" + SPEC_TOPIC_DIV_ENTITY_REV + "='" + specNode.revision + "']");
            }
        }

        function getTitleDiv(specNode) {
            return jQuery("div[" + SPEC_TITLE + "='" + specNode.title + "'][" + SPEC_TITLE_CONTAINER + "='" + specNode.nodeType.toLowerCase() + "']");
        }

        function specTopicDivExists(specNode) {
            return getTopicDiv(specNode).length !== 0;
        }

        function specTitleDivExists(specNode) {
            return getTitleDiv(specNode).length !== 0;
        }

        var specNodes = this.getAllChildrenInFlatOrder(updatedSpec);

        /*
        Remove any existing topics that are no longer present.
        */
        var existingSpecDivs = jQuery("." + SPEC_DIV_CLASS);
        var removeDivList = _.filter(existingSpecDivs, function (element) {
            var jQueryElement = jQuery(element);
            if (jQueryElement.hasClass(SPEC_TOPIC_DIV_CLASS)) {
                /*
                This div displays some topic info
                */
                var nodeId = parseInt(jQueryElement.attr(SPEC_TOPIC_DIV_ENTITY_ID));
                var nodeRev = jQueryElement.attr(SPEC_TOPIC_DIV_ENTITY_REV) !== null ? parseInt(jQueryElement.attr(SPEC_TOPIC_DIV_ENTITY_REV)) : null;

                var existingNode = _.find(specNodes, function (specNode) {
                    if (!nodeIsTopic(specNode)) {
                        return false;
                    }

                    if (specNode.id !== nodeId) {
                        return false;
                    }

                    if (specNode.revision !== nodeRev) {
                        return false;
                    }

                    return true;
                });

                return existingNode === undefined;
            } else if (jQueryElement.hasClass(SPEC_TITLE_DIV_CLASS)) {
                /*
                This div displays some title info
                */
                var title = jQueryElement.attr(SPEC_TITLE);
                var container = jQueryElement.attr(SPEC_TITLE_CONTAINER);

                var existingNode = _.find(specNodes, function (specNode) {
                    if (specNode.title !== title) {
                        return false;
                    }

                    if (specNode.nodeType !== container.toUpperCase()) {
                        return false;
                    }

                    return true;
                });

                return existingNode === undefined;
            }

            return false;
        });

        _.each(removeDivList, function (element) {
            /*
            Remove any link target div associated with the spec div
            */
            var linkTargets = element[SPEC_DIV_LINK_TARGETS_PROPERTY];
            _.each(linkTargets, function (linkTarget) {
                linkTarget.remove();
            });

            jQuery(element).remove();
        });

        /*
        Create new iframes and divs for missing topics and titles
        */
        var specNodesMissingDiv = _.filter(specNodes, function (specNode) {
            if (nodeIsTopic(specNode)) {
                return !specTopicDivExists(specNode);
            } else if (nodeIsContainer(specNode)) {
                return !specTitleDivExists(specNode);
            }
        });

        /*
        Set timeouts to load the iframes, in case the cascading loading triggered by
        a successful XSL transform fails
        */
        var delay = _.reduce(specNodesMissingDiv, function (delay, element, index) {
            var iFrame = this.buildIFrameAndDiv(element);
            this.setIFrameSrc(iFrame, delay, index);
            return delay + DELAY_BETWEEN_IFRAME_SRC_CALLS;
        }, 0, this);

        /*
        Set a timeout to do the fallabck refresh, just i case an iframe doesn't load properly
        */
        this.timeoutRefresh = window.setTimeout(function () {
            _this.startRefreshCycle();
        }, delay);

        function divsAreEqual(node1, node2) {
            if (node1.length !== 1) {
                return false;
            }

            if (node2.length !== 1) {
                return false;
            }

            return node1[0].id === node2[0].id;
        }

        function getActualChild(specNode) {
            if (nodeIsTopic(specNode)) {
                return getTopicDiv(specNode);
            } else if (nodeIsContainer(specNode)) {
                return getTitleDiv(specNode);
            }

            return null;
        }

        /*
        Reorganise DOM to match new spec
        */
        var topicsAndContainers = _.filter(specNodes, nodeIsTopicOrContainer);
        _.each(topicsAndContainers, function (specNode, index, list) {
            var nthSpecDiv = jQuery("div." + SPEC_DIV_CLASS + ":eq(" + index + ")");
            var previousSibling = index === 0 ? null : jQuery("div." + SPEC_DIV_CLASS + ":eq(" + (index - 1) + ")");
            var actualChild = getActualChild(specNode);

            if (actualChild == null || actualChild.length !== 1) {
                throw "actualChild.length should always be 1, because all divs should be attached to the dom at this point";
            }

            if (nthSpecDiv.length !== 1) {
                throw "nthSpecDiv.length should always be 1, because all divs should be attached to the dom at this point";
            }

            if (!divsAreEqual(nthSpecDiv, actualChild)) {
                actualChild.remove();
                _.each(actualChild[SPEC_DIV_LINK_TARGETS_PROPERTY], function (linkTarget) {
                    linkTarget.remove();
                });

                if (previousSibling === null) {
                    jQuery(document.body).prepend(actualChild);
                    _.each(actualChild[SPEC_DIV_LINK_TARGETS_PROPERTY], function (linkTarget) {
                        jQuery(document.body).prepend(linkTarget);
                    });
                } else {
                    previousSibling.after(actualChild);
                    _.each(actualChild[SPEC_DIV_LINK_TARGETS_PROPERTY], function (linkTarget) {
                        previousSibling.after(linkTarget);
                    });
                }
            }
        });

        /*
        Update the ids to reflect the position of the divs in the book.
        */
        _.each(jQuery("div." + SPEC_DIV_CLASS), function (element, index, list) {
            element.id = DIV_ID_PREFIX + index;
        });
    };
    return DocBuilderLive;
})();

var docBuilderLive = new DocBuilderLive(21464);
//# sourceMappingURL=docbuilder.js.map
