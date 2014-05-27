/// <reference path="../definitions/jquery.d.ts" />
/// <reference path="../definitions/underscore.d.ts" />
/// <reference path="../definitions/moment.d.ts" />
/// <reference path="collections.ts" />
/// <reference path="HornetQRestListener.ts" />
/// <reference path="constants.ts" />
/**
* This is a message send to either the topic or spec update JMS topics that
* indicates the server was restarted. This means we have to do a complete
* refresh of the book.
* @type {string}
*/
var SERVER_RESTART_MARKER = "SERVER_RESTART";

/**
* This is used so messages can be passed back to the main html page when the XML is rendered into HTML and javascript
* @type {string}
*/
var LOCAL_URL = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port;

/**
* This is the icon used for containers in the TOC
* @type {string}
*/
var FOLDER_ICON = "pficon pficon-folder-open";

/**
* This is is icon used for topics in the toc
* @type {string}
*/
var TOPIC_ICON = "images/file.png";

/**
* iframes have their src value set either when the iframe before them is updated, or when
* a timeout is reached. This is how long each iframe should wait before the timeout is reached.
* @type {number}
*/
var DELAY_BETWEEN_IFRAME_SRC_CALLS = 10000;

/**
* This is how many iframes should be downloading the XML at any one time
* @type {number}
*/
var CONCURRENT_IFRAME_DOWNLOADS = 3;

/**
* This is the name of the property assigned to the DIVs that display any spec data. This property
* holds references to the divs used for internal anchors.
* @type {string}
*/
var SPEC_DIV_TOP_LINK_TARGETS_PROPERTY = "topLinkTargets";

/**
* This is the name of the property assigned to the DIVs that display any spec data. This property
* holds references to the divs used for additional links like "Edit this topic".
* @type {string}
*/
var SPEC_DIV_BOTTOM_LINK_TARGETS_PROPERTY = "bottomLinkTargets";
var SPEC_TOPIC_DIV_NODE_ID = "data-specNodeId";
var SPEC_TOPIC_DIV_NODE_REV = "data-specNodeRev";
var SPEC_TOPIC_DIV_TOPIC_ID = "data-topicId";
var SPEC_TOPIC_DIV_TOPIC_REV = "data-topicRev";
var SPEC_TITLE = "data-title";
var SPEC_TITLE_CONTAINER = "data-container";
var LOADING_TOPIC_DIV_CLASS = "loadingTopicDiv";

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

/**
* Used as a class to identify all divs that contain spec content, and used as an ID prefix to identify
* the position of the book in the linear layout of ccontent from the spec.
* @type {string}
*/
var DIV_BOOK_INDEX_ID_PREFIX = "divBookIndex";
var LOADING_HTML = "<div style='width: 100%;'><img style='display:block; margin:auto;' src='images/loading.gif'/></div>";
var TOPIC_ID_MARKER = "#TOPICID#";
var CSNODE_ID_MARKER = "#CSNODEID#";
var CSNODE_REV_MARKER = "#CSNODEREV#";
var INITIAL_CONTENT_CONTAINER = "INITIAL_CONTENT";
var CHAPTER_NODE_TYPE = "CHAPTER";
var CONTAINER_NODE_TYPES = [CHAPTER_NODE_TYPE, "SECTION", "PART", "APPENDIX", INITIAL_CONTENT_CONTAINER];
var TITLE_NODE_TYPES = ["CHAPTER", "SECTION", "PART", "APPENDIX"];
var INITIAL_CONTENT_TOPIC = "INITIAL_CONTENT_TOPIC";
var TOPIC = "TOPIC";
var TOPIC_NODE_TYPES = [TOPIC, INITIAL_CONTENT_TOPIC];
var RETRY_COUNT = 5;

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
var CSNODE_XSLTXML_REST = REST_BASE + "/contentspecnode/get/" + CSNODE_ID_MARKER + "/xslt+xml";
var ECHO_XML_REST = REST_BASE + "/echoxml";

/**
* The URL to open when a topic is to be edited
* @type {string}
*/
var EDIT_TOPIC_LINK = "/pressgang-ccms-ui/#SearchResultsAndTopicView;query;topicIds=" + TOPIC_ID_MARKER;

var WAIT_FOR_MESSAGE = "60";
var UPDATED_TOPICS_JMS_TOPIC = SERVER + "/pressgang-ccms-messaging/topics/jms.topic.UpdatedTopic";
var UPDATED_SPECS_JMS_TOPIC = SERVER + "/pressgang-ccms-messaging/topics/jms.topic.UpdatedSpec";

function error(message) {
    bootbox.alert(message);
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

function nodeIsChapter(specNode) {
    return specNode.nodeType === CHAPTER_NODE_TYPE;
}

function nodeIsTitleContainer(specNode) {
    return TITLE_NODE_TYPES.indexOf(specNode.nodeType) !== -1;
}

function nodeIsInitialContainer(specNode) {
    return INITIAL_CONTENT_CONTAINER === specNode.nodeType;
}

function nodeIsTopicOrContainer(specNode) {
    return nodeIsContainer(specNode) || nodeIsTopic(specNode);
}

function nodeIsTopicOrTitleContainer(specNode) {
    return nodeIsTitleContainer(specNode) || nodeIsTopic(specNode);
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

function firstElement(jquery) {
    if (jquery.length === 0) {
        return null;
    }
    return jquery.get(0);
}

var DocBuilderLive = (function () {
    function DocBuilderLive(specId) {
        var _this = this;
        this.timeoutRefresh = null;
        this.rebuilding = false;
        /**
        This will be true if the content spec being displayed is one of those that we were notifed of
        as being updated.
        */
        this.specUpdated = false;
        /**
        *  This contains the topic ids of all floating (i.e. not frozen) topics included in the spec
        * @type {Array}
        */
        this.specTopicIds = [];
        /**
        * This contains the topic ids of all floating (i.e. not frozen) topics included in the spec that
        * have been updated.
        * @type {Array}
        */
        this.topicsUpdated = [];
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

                            /*
                            The bottom links, like "Edit this topic", are hidden until the topic is rendered.
                            */
                            _.each(sourceIframe["div"][SPEC_DIV_BOTTOM_LINK_TARGETS_PROPERTY], function (div) {
                                div.css("display", "");
                            });
                        } catch (ex) {
                            console.log(ex);
                        }

                        /*
                        The iframes have their src set either when the iframe before them
                        finishes loading, or when a timeout occurs.
                        */
                        var nextDivs = jQuery("div[data-loading='true']");
                        if (nextDivs.length !== 0) {
                            this.createIFrameAndLoadDiv(firstElement(nextDivs));
                        } else {
                            // there are no more iframes to load
                            this.rebuilding = false;
                        }

                        sourceIframe.parentElement.removeChild(sourceIframe);
                    }
                }
            } catch (ex) {
                // message was not json
            }
        }.bind(this));

        this.specId = specId;

        this.updateEditSpecLink(specId);

        this.getSpec(function (spec) {
            _this.buildToc(spec);
            var specNodes = _this.getAllChildrenInFlatOrder(spec);
            _this.getTopics(specNodes);

            /*
            Kick off the loop that listens for updated topics
            */
            _this.listenForUpdates();
        }, this.errorCallback);
    }
    DocBuilderLive.prototype.listenForUpdates = function () {
        var _this = this;
        /*
        Create a new instance of the HornetQRestListener class. This will create an async cycle of
        calls to the HornetQ REST API, and call the supplied callback when a message is found.
        */
        new HornetQRestListener(ACCEPT_WAIT, UPDATED_TOPICS_JMS_TOPIC, function (data) {
            if (data === SERVER_RESTART_MARKER) {
                console.log("Server was restarted, so rebuilding spec");
                _this.rebuildSpec(_this.errorCallback);
            } else {
                var topics = data.split(",");
                _this.topicsUpdated = _.union(_.filter(topics, function (num) {
                    return this.specTopicIds.indexOf(parseInt(num)) !== -1;
                }.bind(_this)), _this.topicsUpdated);

                if (_this.topicsUpdated.length !== 0 && !_this.rebuilding) {
                    if (_this.timeoutRefresh !== null) {
                        window.clearTimeout(_this.timeoutRefresh);
                        _this.timeoutRefresh = null;
                    }

                    _this.rebuilding = true;
                    _this.syncDomWithTopics(_this.topicsUpdated);
                }
            }
        });

        /*
        Create a new instance of the HornetQRestListener class. This will create an async cycle of
        calls to the HornetQ REST API, and call the supplied callback when a message is found.
        */
        new HornetQRestListener(ACCEPT_WAIT, UPDATED_SPECS_JMS_TOPIC, function (data) {
            if (data === SERVER_RESTART_MARKER) {
                console.log("Server was restarted, so rebuilding spec");
                _this.rebuildSpec(_this.errorCallback);
            } else {
                var topics = data.split(",");

                if (topics.indexOf(_this.specId.toString()) !== -1) {
                    _this.rebuildSpec(_this.errorCallback);
                }
            }
        });
    };

    DocBuilderLive.prototype.updateEditSpecLink = function (specId) {
        jQuery("#editSpec").attr("href", SERVER + "/pressgang-ccms-ui/#ContentSpecFilteredResultsAndContentSpecView;query;contentSpecIds=" + specId);
    };

    /**
    * Get a content spec node with all children expanded
    * @param id The id of the spec node to expand
    * @param callback Called with the fully expanded spec node
    * @param errorCallback Called if there was a network error
    * @param retryCount An internal count that tracks how many time to retry a particular call
    */
    DocBuilderLive.prototype.populateChild = function (id, callback, errorCallback, retryCount) {
        var _this = this;
        if (typeof retryCount === "undefined") { retryCount = 0; }
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
        var countContainers = function (spec) {
            var total = 0;
            if (spec.children_OTM) {
                _.each(spec.children_OTM.items, function (element) {
                    if (nodeIsContainer(element.item)) {
                        ++total;
                        total += countContainers(element.item);
                    }
                });
            }
            return total;
        };

        var expandChildren = function (index, count) {
            if (index >= spec.children_OTM.items.length) {
                callback(spec);
            } else {
                updateInitialMessage("Loading Content Specification: Expanded " + count + " of " + countContainers(spec) + " Child Containers", true);
                var element = spec.children_OTM.items[index].item;
                if (nodeIsContainer(element)) {
                    _this.populateChild(element.id, function (node) {
                        spec.children_OTM.items[index].item.children_OTM = node.children_OTM;
                        expandChildren(++index, ++count);
                    }, errorCallback);
                } else {
                    expandChildren(++index, ++count);
                }
            }
        };

        expandChildren(0, 1);
    };

    /**
    * Get a spec with all child details expanded
    * @param callback Called with the expanded spec object
    * @param errorCallback Called if there was a network error
    * @param retryCount An internal count that tracks how many time to retry a particular call
    */
    DocBuilderLive.prototype.getSpec = function (callback, errorCallback, retryCount) {
        var _this = this;
        if (typeof retryCount === "undefined") { retryCount = 0; }
        jQuery.ajax({
            type: 'GET',
            url: SERVER + SPEC_REST + this.specId + "?expand=" + encodeURIComponent(JSON.stringify(SPEC_REST_EXPAND)),
            dataType: "json",
            context: this,
            success: function (data) {
                updateInitialMessage("Top level of content spec loaded", true);
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

        this.specTopicIds = [];
        _.each(specTopics, function (childNode, index, list) {
            if (childNode.entityRevision === null) {
                this.specTopicIds.push(childNode.entityId);
            }
        }.bind(this));

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

    DocBuilderLive.prototype.buildIFrame = function (div) {
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
        iFrame["div"] = div;

        return iFrame;
    };

    DocBuilderLive.prototype.buildUrl = function (element) {
        var url;

        if (nodeIsTopic(element)) {
            if (element.revision === undefined) {
                url = SERVER + CSNODE_XSLTXML_REST.replace(CSNODE_ID_MARKER, element.id.toString()) + "?parentDomain=" + LOCAL_URL + "&baseUrl=%23divId%23TOPICID%23";
            } else {
                url = SERVER + CSNODE_XSLTXML_REST.replace(CSNODE_ID_MARKER, element.id.toString()).replace(CSNODE_REV_MARKER, element.revision.toString()) + "?parentDomain=" + LOCAL_URL + "&baseUrl=%23divId%23TOPICID%23";
            }
        } else if (nodeIsTitleContainer(element)) {
            var xml = "<?xml-stylesheet type='text/xsl' href='/pressgang-ccms-static/publican-docbook/html-single-diff.xsl'?>\n" + "<" + element.nodeType.toLowerCase() + ">\n" + "<title>" + element.title + "</title>\n" + "</" + element.nodeType.toLowerCase() + ">";
            url = SERVER + ECHO_XML_REST + "?xml=" + encodeURIComponent(xml) + "&parentDomain=" + LOCAL_URL;
        }

        return url;
    };

    DocBuilderLive.prototype.buildDiv = function (element) {
        /*
        Links to topics can be done through either the topic id or the target id. We
        append two divs with these ids as link targets.
        */
        var existingSpecDivElementCount = jQuery("div." + DIV_BOOK_INDEX_ID_PREFIX).length;

        /*
        Create the div that will be filled with the HTML sent by the iframe.
        */
        var div = jQuery("<div id='" + DIV_BOOK_INDEX_ID_PREFIX + existingSpecDivElementCount + "'></div>");

        // this attribute identifies the div as waiting to be populated with the topic HTML
        div.addClass(LOADING_TOPIC_DIV_CLASS);
        div.addClass(DIV_BOOK_INDEX_ID_PREFIX);
        div.html(LOADING_HTML);
        firstElement(div)[SPEC_DIV_TOP_LINK_TARGETS_PROPERTY] = [];
        firstElement(div)[SPEC_DIV_BOTTOM_LINK_TARGETS_PROPERTY] = [];

        if (element.entityId !== null) {
            var idLinkTarget = jQuery("<div id='" + DIV_ID_PREFIX + element.entityId + "'></div>");
            firstElement(div)[SPEC_DIV_TOP_LINK_TARGETS_PROPERTY].push(idLinkTarget);
            jQuery("#book").append(idLinkTarget);
        }

        if (element.targetId !== null) {
            var nameLinkTarget = jQuery("<div id='" + DIV_ID_PREFIX + element.targetId + "'></div>");
            firstElement(div)[SPEC_DIV_TOP_LINK_TARGETS_PROPERTY].push(nameLinkTarget);
            jQuery("#book").append(nameLinkTarget);
        }

        if (nodeIsTopic(element)) {
            div.addClass(SPEC_TOPIC_DIV_CLASS);
            div.attr(SPEC_TOPIC_DIV_NODE_ID, element.id.toString());
            div.attr(SPEC_TOPIC_DIV_TOPIC_ID, element.entityId.toString());

            if (element.entityRevision !== null) {
                div.attr(SPEC_TOPIC_DIV_TOPIC_REV, element.entityId.toString());
            }

            if (element.revision !== undefined) {
                div.attr(SPEC_TOPIC_DIV_NODE_REV, element.revision.toString());
            }
        } else if (nodeIsTitleContainer(element)) {
            div.addClass(SPEC_TITLE_DIV_CLASS);
            div.attr(SPEC_TITLE, element.title);
            div.attr(SPEC_TITLE_CONTAINER, element.nodeType.toLowerCase());
        }

        jQuery("#book").append(div);

        /*
        Edit topic links are added below the main topic content
        */
        if (nodeIsTopic(element)) {
            var editTopic = jQuery("<div style='display:none'><a href='" + SERVER + EDIT_TOPIC_LINK.replace(TOPIC_ID_MARKER, element.entityId.toString()) + "'>Edit this topic</a></div>");
            firstElement(div)[SPEC_DIV_BOTTOM_LINK_TARGETS_PROPERTY].push(editTopic);
            jQuery("#book").append(editTopic);
        }

        return div;
    };

    DocBuilderLive.prototype.createIFrameAndLoadDiv = function (div) {
        if (div.getAttribute("data-loading") === "true") {
            var iFrame = this.buildIFrame(div);
            iFrame.src = div.getAttribute("url");
            div.removeAttribute("url");
            div.setAttribute("data-loading", "false");
        }
    };

    /**
    * Builds and iFrame and sets the src attribute to the topics XML+XSLT endpoint.
    * @param iFrame
    * @param delay
    * @param count
    */
    DocBuilderLive.prototype.setIFrameSrc = function (div, url, delay, count) {
        /*
        We use this attribute to determine if this div has already been loaded, because it can be loaded
        either by the timeout set here, or when the div before it is loaded.
        */
        div.setAttribute("data-loading", "true");

        /*
        We'll use this url to initialise the iframe when it is time
        */
        div.setAttribute("url", url);

        /*
        We want to start a few iframes downloading the xml concurrently.
        */
        if (count < CONCURRENT_IFRAME_DOWNLOADS) {
            this.createIFrameAndLoadDiv(div);
        } else {
            /*
            The iframes have their src set either when the iframe before them
            finishes loading (see the message listener in the constructor), or when a timeout occurs.
            This gives us a fallback in case an iframe didn't load properly.
            */
            window.setTimeout(function () {
                this.createIFrameAndLoadDiv(div);
            }.bind(this), delay);
        }
    };

    /**
    * Given a spec, create iframes for all topics that have not been previously rendered
    * @param spec The spec with all children expanded
    */
    DocBuilderLive.prototype.getTopics = function (specTopics) {
        var _this = this;
        jQuery("#loading").remove();

        var topicsAndContainers = _.filter(specTopics, nodeIsTopicOrTitleContainer);

        var delay = _.reduce(topicsAndContainers, function (delay, element, index) {
            var url = this.buildUrl(element);
            var div = this.buildDiv(element);
            this.setIFrameSrc(firstElement(div), url, delay, index);
            return delay + DELAY_BETWEEN_IFRAME_SRC_CALLS;
        }, 0, this);

        this.timeoutRefresh = window.setTimeout(function () {
            _this.rebuilding = false;
        }, delay);
    };

    DocBuilderLive.prototype.buildToc = function (spec) {
        var _this = this;
        var childIndex = 0;

        var addChildren = function (specNode, parent) {
            var isContainer = nodeIsTitleContainer(specNode);
            var isChapter = nodeIsChapter(specNode);
            var isTopic = nodeIsTopic(specNode);
            var isInitialContainer = nodeIsInitialContainer(specNode);

            if (isInitialContainer) {
                if (specNode.children_OTM !== null) {
                    var children = _this.getChildrenInOrder(specNode);
                    _.each(children, function (element) {
                        // don't show in toc, but bump child count so the index is still valid
                        // when entries belwo are clicked
                        ++childIndex;
                    });
                }
            } else if (isContainer || isTopic) {
                var treeNode = new TreeNode();
                treeNode.text = specNode.title;
                treeNode.icon = isContainer ? FOLDER_ICON : TOPIC_ICON;
                treeNode.data = childIndex.toString();
                treeNode.state = { opened: true };
                treeNode.a_attr = {};

                if (isContainer) {
                    treeNode.a_attr["data-containertreenode"] = "true";
                }

                if (isChapter) {
                    treeNode.a_attr["data-chaptertreenode"] = "true";
                }

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
        jQuery("#content").append(tocDiv);
    };

    DocBuilderLive.prototype.rebuildSpec = function (errorCallback) {
        var _this = this;
        this.getSpec(function (spec) {
            _this.expandSpec(spec, function (expandedSpec) {
                _this.syncDomWithSpec(expandedSpec);
                _this.buildToc(expandedSpec);
            }, errorCallback);
        }, this.errorCallback);
    };

    DocBuilderLive.prototype.syncDomWithTopics = function (updatedTopics) {
        /*
        Loop through each topic that has been updated since we last refreshed
        */
        _.each(updatedTopics, function (topicItem) {
            /*
            Get every topic div that references this node
            */
            var topicDivs = jQuery("div." + SPEC_TOPIC_DIV_CLASS + "[" + SPEC_TOPIC_DIV_TOPIC_ID + "='" + topicItem + "']");

            /*
            Remove the divs that have static revisions
            */
            var filteredTopicDivs = _.filter(topicDivs, function (topicDiv) {
                return topicDiv.getAttribute(SPEC_TOPIC_DIV_TOPIC_REV) === null;
            });

            if (filteredTopicDivs.length === 0) {
                throw "Could not find the source topic div for an updated topic";
            }

            /*
            Take every div that needs to be updated and create a iframe to recieve the XML
            */
            _.reduce(filteredTopicDivs, function (delay, topicDiv, index) {
                var url = "";
                var csNodeId = topicDiv.getAttribute(SPEC_TOPIC_DIV_NODE_ID);
                var csNodeRev = topicDiv.getAttribute(SPEC_TOPIC_DIV_NODE_REV);
                if (csNodeRev === null) {
                    url = SERVER + CSNODE_XSLTXML_REST.replace(CSNODE_ID_MARKER, csNodeId) + "?parentDomain=" + LOCAL_URL + "&baseUrl=%23divId%23TOPICID%23";
                } else {
                    url = SERVER + CSNODE_XSLTXML_REST.replace(CSNODE_ID_MARKER, csNodeId.toString()).replace(CSNODE_REV_MARKER, csNodeRev) + "?parentDomain=" + LOCAL_URL + "&baseUrl=%23divId%23TOPICID%23";
                }

                this.setIFrameSrc(topicDiv, url, delay, index);
                return delay + DELAY_BETWEEN_IFRAME_SRC_CALLS;
            }, 0, this);
        }, this);
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
                return jQuery("div[" + SPEC_TOPIC_DIV_NODE_ID + "='" + specNode.id + "']");
            } else {
                return jQuery("div[" + SPEC_TOPIC_DIV_NODE_ID + "='" + specNode.id + "'][" + SPEC_TOPIC_DIV_NODE_REV + "='" + specNode.revision + "']");
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
        var existingSpecDivs = jQuery("." + DIV_BOOK_INDEX_ID_PREFIX);
        var removeDivList = _.filter(existingSpecDivs, function (element) {
            var jQueryElement = jQuery(element);
            if (jQueryElement.hasClass(SPEC_TOPIC_DIV_CLASS)) {
                /*
                This div displays some topic info
                */
                var nodeId = parseInt(jQueryElement.attr(SPEC_TOPIC_DIV_NODE_ID));
                var nodeRev = jQueryElement.attr(SPEC_TOPIC_DIV_NODE_REV) !== null ? parseInt(jQueryElement.attr(SPEC_TOPIC_DIV_NODE_REV)) : null;

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
            var linkTargets = element[SPEC_DIV_TOP_LINK_TARGETS_PROPERTY];
            _.each(linkTargets, function (linkTarget) {
                linkTarget.remove();
            });
            var bottomLinks = element[SPEC_DIV_BOTTOM_LINK_TARGETS_PROPERTY];
            _.each(bottomLinks, function (linkTarget) {
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
            } else if (nodeIsTitleContainer(specNode)) {
                return !specTitleDivExists(specNode);
            }
        });

        /*
        Set timeouts to load the iframes, in case the cascading loading triggered by
        a successful XSL transform fails
        */
        var delay = _.reduce(specNodesMissingDiv, function (delay, element, index) {
            var url = this.buildUrl(element);
            var div = this.buildDiv(element);
            this.setIFrameSrc(firstElement(div), url, delay, index);
            return delay + DELAY_BETWEEN_IFRAME_SRC_CALLS;
        }, 0, this);

        /*
        Set a timeout to do the fallabck refresh, just i case an iframe doesn't load properly
        */
        this.timeoutRefresh = window.setTimeout(function () {
            _this.rebuilding = false;
        }, delay);

        function divsAreEqual(node1, node2) {
            if (node1.length !== 1) {
                return false;
            }

            if (node2.length !== 1) {
                return false;
            }

            return firstElement(node1).id === firstElement(node2).id;
        }

        function getActualChild(specNode) {
            if (nodeIsTopic(specNode)) {
                return getTopicDiv(specNode);
            } else if (nodeIsTitleContainer(specNode)) {
                return getTitleDiv(specNode);
            }

            return null;
        }

        /*
        Reorganise DOM to match new spec
        */
        var topicsAndContainers = _.filter(specNodes, nodeIsTopicOrTitleContainer);
        _.each(topicsAndContainers, function (specNode, index, list) {
            var nthSpecDiv = jQuery("div." + DIV_BOOK_INDEX_ID_PREFIX + ":eq(" + index + ")");
            var previousSibling = index === 0 ? null : jQuery("div." + DIV_BOOK_INDEX_ID_PREFIX + ":eq(" + (index - 1) + ")");
            var actualChild = getActualChild(specNode);

            if (actualChild == null || actualChild.length !== 1) {
                throw "actualChild.length should always be 1, because all divs should be attached to the dom at this point";
            }

            if (nthSpecDiv.length !== 1) {
                throw "nthSpecDiv.length should always be 1, because all divs should be attached to the dom at this point";
            }

            if (previousSibling !== null && previousSibling.length > 1) {
                throw "previousSibling should always be null previousSibling.length should be one 1, because we can only have 0 or 1 previous children";
            }

            if (!divsAreEqual(nthSpecDiv, actualChild)) {
                /*
                Remove all divs that are used to represent the topic or title that movde
                */
                actualChild.remove();
                _.each(actualChild[SPEC_DIV_TOP_LINK_TARGETS_PROPERTY], function (linkTarget) {
                    linkTarget.remove();
                });
                _.each(actualChild[SPEC_DIV_BOTTOM_LINK_TARGETS_PROPERTY], function (linkTarget) {
                    linkTarget.remove();
                });

                if (previousSibling === null) {
                    /*
                    prepend to start of book
                    */
                    _.each(firstElement(actualChild)[SPEC_DIV_BOTTOM_LINK_TARGETS_PROPERTY], function (linkTarget) {
                        jQuery(document.body).prepend(linkTarget);
                    });
                    jQuery("#book").prepend(actualChild);
                    _.each(firstElement(actualChild)[SPEC_DIV_TOP_LINK_TARGETS_PROPERTY], function (linkTarget) {
                        jQuery(document.body).prepend(linkTarget);
                    });
                } else {
                    var previousSiblingBottomLinksLength = firstElement(previousSibling)[SPEC_DIV_BOTTOM_LINK_TARGETS_PROPERTY].length;
                    if (previousSiblingBottomLinksLength !== 0) {
                        var previousSiblingLastBottomElement = firstElement(previousSibling)[SPEC_DIV_BOTTOM_LINK_TARGETS_PROPERTY][previousSiblingBottomLinksLength - 1];

                        /*
                        insert after previous child
                        */
                        _.each(firstElement(actualChild)[SPEC_DIV_BOTTOM_LINK_TARGETS_PROPERTY], function (linkTarget) {
                            previousSiblingLastBottomElement.after(linkTarget);
                        });
                        previousSiblingLastBottomElement.after(actualChild);
                        _.each(firstElement(actualChild)[SPEC_DIV_TOP_LINK_TARGETS_PROPERTY], function (linkTarget) {
                            previousSiblingLastBottomElement.after(linkTarget);
                        });
                    } else {
                        /*
                        insert after previous child
                        */
                        _.each(firstElement(actualChild)[SPEC_DIV_BOTTOM_LINK_TARGETS_PROPERTY], function (linkTarget) {
                            previousSibling.after(linkTarget);
                        });
                        previousSibling.after(actualChild);
                        _.each(firstElement(actualChild)[SPEC_DIV_TOP_LINK_TARGETS_PROPERTY], function (linkTarget) {
                            previousSibling.after(linkTarget);
                        });
                    }
                }
            }
        });

        /*
        Update the ids to reflect the position of the divs in the book.
        */
        _.each(jQuery("div." + DIV_BOOK_INDEX_ID_PREFIX), function (element, index) {
            element.id = DIV_BOOK_INDEX_ID_PREFIX + index;
        });
    };
    return DocBuilderLive;
})();

function updateInitialMessage(message, showLoadingImage) {
    if (showLoadingImage) {
        jQuery("#loading").html('<h1 class="text-center">' + message + '</h1><div class="loadingContent"><img class="loadingImage" src="images/loading.gif"/></div>');
    } else {
        jQuery("#loading").html('<h1 class="text-center">' + message + '</h1>');
    }
}
/*var qs = (function(a) {
if (a == "") return {};
var b = {};
for (var i = 0; i < a.length; ++i)
{
var p=a[i].split('=');
if (p.length != 2) continue;
b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
}
return b;
})(window.location.search.substr(1).split('&'));
jQuery(document).ready(function(){
try {
if (qs["specId"] !== undefined) {
var specId = parseInt(qs["specId"]);
if (!isNaN(specId)) {
var docBuilderLive = new DocBuilderLive(specId);
} else {
throw "The book could not be displayed because the specId query parameter is not an integer.";
}
} else {
throw "The book could not be displayed because the specId query parameter is missing.";
}
} catch (ex) {
updateInitialMessage(ex, false);
}
})  */
//# sourceMappingURL=docbuilder.js.map
