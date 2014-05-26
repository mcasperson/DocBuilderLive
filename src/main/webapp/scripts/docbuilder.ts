/// <reference path="../definitions/jquery.d.ts" />
/// <reference path="../definitions/underscore.d.ts" />
/// <reference path="../definitions/moment.d.ts" />
/// <reference path="collections.ts" />
/// <reference path="HornetQRestListener.ts" />

//var SERVER:string = "http://pressgang.lab.eng.pnq.redhat.com:8080";
var SERVER:string = "http://topicindex-dev.ecs.eng.bne.redhat.com:8080"
//var SERVER:string = "http://localhost:8080"

/**
 * This is a message send to either the topic or spec update JMS topics that
 * indicates the server was restarted. This means we have to do a complete
 * refresh of the book.
 * @type {string}
 */
var SERVER_RESTART_MARKER:string = "SERVER_RESTART";

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
var TOPIC_ID_MARKER:string = "#TOPICID#";
var CSNODE_ID_MARKER:string = "#CSNODEID#";
var CSNODE_REV_MARKER:string = "#CSNODEREV#";
var INITIAL_CONTENT_CONTAINER = "INITIAL_CONTENT";
var CHAPTER_NODE_TYPE = "CHAPTER";
var CONTAINER_NODE_TYPES:string[] = [CHAPTER_NODE_TYPE, "SECTION", "PART", "APPENDIX", INITIAL_CONTENT_CONTAINER];
var TITLE_NODE_TYPES:string[] = ["CHAPTER", "SECTION", "PART", "APPENDIX"];
var INITIAL_CONTENT_TOPIC:string = "INITIAL_CONTENT_TOPIC";
var TOPIC:string = "TOPIC";
var TOPIC_NODE_TYPES:string[] = [TOPIC, INITIAL_CONTENT_TOPIC];
var RETRY_COUNT:number = 5;
var REST_BASE:string = "/pressgang-ccms/rest/1"
var SPEC_REST:string= REST_BASE + "/contentspec/get/json/";
var SPEC_REST_EXPAND:Object={
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
var SPECNODE_REST:string = REST_BASE + "/contentspecnode/get/json/";
var CSNODE_XSLTXML_REST:string = REST_BASE + "/contentspecnode/get/" + CSNODE_ID_MARKER + "/xslt+xml";
var ECHO_XML_REST:string = REST_BASE + "/echoxml";

/**
 * The URL to open when a topic is to be edited
 * @type {string}
 */
var EDIT_TOPIC_LINK = "/pressgang-ccms-ui/#SearchResultsAndTopicView;query;topicIds=" + TOPIC_ID_MARKER;

var WAIT_FOR_MESSAGE = "60";
var UPDATED_TOPICS_JMS_TOPIC = SERVER + "/pressgang-ccms-messaging/topics/jms.topic.UpdatedTopic";
var UPDATED_SPECS_JMS_TOPIC = SERVER + "/pressgang-ccms-messaging/topics/jms.topic.UpdatedSpec";

function error(message:string):void {
    bootbox.alert(message);
}

function message(message:string):void {
    console.log(message);
}
function nodeIsTopic(specNode:SpecNode):boolean {
    return TOPIC_NODE_TYPES.indexOf(specNode.nodeType) !== -1;
}

function nodeIsContainer(specNode:SpecNode):boolean {
    return CONTAINER_NODE_TYPES.indexOf(specNode.nodeType) !== -1;
}

function nodeIsChapter(specNode:SpecNode):boolean {
    return specNode.nodeType === CHAPTER_NODE_TYPE;
}

function nodeIsTitleContainer(specNode:SpecNode):boolean {
    return TITLE_NODE_TYPES.indexOf(specNode.nodeType) !== -1;
}

function nodeIsInitialContainer(specNode:SpecNode):boolean {
    return INITIAL_CONTENT_CONTAINER === specNode.nodeType;
}

function nodeIsTopicOrContainer(specNode:SpecNode):boolean {
    return nodeIsContainer(specNode) || nodeIsTopic(specNode);
}

function nodeIsTopicOrTitleContainer(specNode:SpecNode):boolean {
    return nodeIsTitleContainer(specNode) || nodeIsTopic(specNode);
}

class TreeNode {
    text:string;
    icon:string;
    data:string;
    a_attr:{};
    state:TreeNodeState;
    children:TreeNode[] = [];
}

interface TreeNodeState {
    opened: boolean;
}

interface SpecNodeCollectionParentItems {
    items:SpecNodeCollectionParentItem[];
}

interface SpecItems {
    items:SpecItem[];
}

interface TopicItems {
    items:TopicItem[];
}

interface SpecItem {
    item:Spec;
}

interface TopicItem {
    item:Topic;
}

interface Topic {
    id:number;
    lastModified:number;
}

interface SysInfo {
    lastRevision:number;
    lastRevisionDate:number;
}

interface SpecNodeCollectionParent {
    children_OTM:SpecNodeCollection;
}

interface Spec extends SpecNodeCollectionParent {
    lastModified:number;
}

interface SpecNodeCollection {
    items:SpecNodeItem[];
}

interface SpecNodeCollectionParentItem {
    item:SpecNodeCollectionParent;
}

interface SpecNodeItem {
    item:SpecNode;
}

interface SpecNode {
    id:number;
    revision:number;
    entityId:number;
    entityRevision:number;
    nodeType:string;
    title:string;
    nextNode:SpecNode;
    children_OTM:SpecNodeCollection;
    targetId:string;
}

class IdRevPair {
    public id:number;
    public rev:number;

    constructor();
    constructor(id?:number, rev?:number) {
        this.id = id;
        this.rev = rev;
    }
    toString():string {
        return this.id + ":" + this.rev;
    }
}

function firstElement(jquery:JQuery) {
    if (jquery.length === 0) {
        return null;
    }
    return jquery.get(0);
}

class DocBuilderLive {
    private specId:number;
    private timeoutRefresh:number = null;
    private rebuilding = false;
    /**
     This will be true if the content spec being displayed is one of those that we were notifed of
     as being updated.
     */
    private specUpdated = false;
    /**
     *  This contains the topic ids of all floating (i.e. not frozen) topics included in the spec
     * @type {Array}
     */
    private specTopicIds = [];
    /**
     * This contains the topic ids of all floating (i.e. not frozen) topics included in the spec that
     * have been updated.
     * @type {Array}
     */
    private topicsUpdated = [];

    private errorCallback = function (title:string, message:string):void {
        window.alert(title + "\n" + message);
    }

    constructor(specId:number) {

        window.addEventListener('message',
            function (e):void {
                try {
                    var message = JSON.parse(e.data);
                    if (message.html !== undefined) {
                        var source = e.source;
                        var iframes = <HTMLIFrameElement[]>jQuery("iframe").toArray();
                        var sourceIframe = _.find(iframes, function (element):boolean {
                            return element.contentWindow === source;
                        });
                        if (sourceIframe !== undefined) {
                            try {
                                jQuery(sourceIframe["div"]).html(message.html.replace(/<head[\s\S]*?<\/head>/g, "")).removeClass(LOADING_TOPIC_DIV_CLASS);

                                /*
                                 The bottom links, like "Edit this topic", are hidden until the topic is rendered.
                                 */
                                _.each(sourceIframe["div"][SPEC_DIV_BOTTOM_LINK_TARGETS_PROPERTY], function (div:JQuery) {
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
            }.bind(this)
        );

        this.specId = specId;

        this.updateEditSpecLink(specId);

        this.getSpec(
            (spec:SpecNodeCollectionParent):void => {
                this.buildToc(spec);
                var specNodes = this.getAllChildrenInFlatOrder(spec);
                this.getTopics(specNodes);
                /*
                 Kick off the loop that listens for updated topics
                 */
                this.listenForUpdates();
            },
            this.errorCallback
        );


    }

    listenForUpdates():void {
        /*
            Create a new instance of the HornetQRestListener class. This will create an async cycle of
            calls to the HornetQ REST API, and call the supplied callback when a message is found.
         */
        new HornetQRestListener(
            UPDATED_TOPICS_JMS_TOPIC,
            (data) => {
                if (data === SERVER_RESTART_MARKER) {
                    console.log("Server was restarted, so rebuilding spec");
                    this.rebuildSpec(this.errorCallback);
                } else {

                    var topics = data.split(",");
                    this.topicsUpdated = _.union(
                        _.filter(topics, function (num:string) {
                            return this.specTopicIds.indexOf(parseInt(num)) !== -1;
                        }.bind(this)),
                        this.topicsUpdated
                    );

                    if (this.topicsUpdated.length !== 0 && !this.rebuilding) {
                        if (this.timeoutRefresh !== null) {
                            window.clearTimeout(this.timeoutRefresh);
                            this.timeoutRefresh = null;
                        }

                        this.rebuilding = true;
                        this.syncDomWithTopics(this.topicsUpdated);
                    }
                }
            }
        );

        /*
         Create a new instance of the HornetQRestListener class. This will create an async cycle of
         calls to the HornetQ REST API, and call the supplied callback when a message is found.
         */
        new HornetQRestListener(
            UPDATED_SPECS_JMS_TOPIC,
            (data) => {
                if (data === SERVER_RESTART_MARKER) {
                    console.log("Server was restarted, so rebuilding spec");
                    this.rebuildSpec(this.errorCallback);
                } else {
                    var topics = data.split(",");

                    if (topics.indexOf(this.specId.toString()) !== -1) {
                        this.rebuildSpec(this.errorCallback);
                    }
                }
            }
        );
    }

    updateEditSpecLink(specId):void {
        jQuery("#editSpec").attr("href", SERVER + "/pressgang-ccms-ui/#ContentSpecFilteredResultsAndContentSpecView;query;contentSpecIds=" + specId)
    }

    /**
     * Get a content spec node with all children expanded
     * @param id The id of the spec node to expand
     * @param callback Called with the fully expanded spec node
     * @param errorCallback Called if there was a network error
     * @param retryCount An internal count that tracks how many time to retry a particular call
     */
    populateChild(id:number, callback: (node:SpecNode) => void, errorCallback: (title:string, message:string) => void, retryCount:number=0):void {

        jQuery.ajax({
            type: 'GET',
            url: SERVER + SPECNODE_REST + id + "?expand=" + encodeURIComponent(JSON.stringify(SPEC_REST_EXPAND)),
            dataType: "json",
            context: this,
            success: (data) => {

                var expandChildren = (index:number):void => {
                    if (index >= data.children_OTM.items.length) {
                        callback.bind(this)(data);
                    } else {
                        var element:SpecNode = data.children_OTM.items[index].item;
                        if (nodeIsContainer(element)) {
                            this.populateChild(
                                element.id,
                                (node:SpecNode):void =>  {
                                    data.children_OTM.items[index].item.children_OTM = node.children_OTM;
                                    expandChildren(++index);
                                },
                                errorCallback
                            );
                        } else {
                            expandChildren(++index);
                        }
                    }
                }

                expandChildren(0);
            },
            error: () => {
                if (retryCount < RETRY_COUNT) {
                    this.populateChild(id, callback, errorCallback, ++retryCount);
                } else {
                    errorCallback.bind(this)("Connection Error", "An error occurred while getting the content spec details. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.");
                }
            }
        });
    }

    expandSpec(spec:SpecNodeCollectionParent, callback: (spec:SpecNodeCollectionParent) => void, errorCallback: (title:string, message:string) => void):void {
        var expandChildren = (index:number, count:number):void => {
            if (index >= spec.children_OTM.items.length) {
                callback(spec);
            } else {
                updateInitialMessage("Loading Content Specification: Expanded " + count + " Child Containers", true);
                var element:SpecNode = spec.children_OTM.items[index].item;
                if (nodeIsContainer(element)) {
                    this.populateChild(
                        element.id,
                        (node:SpecNode):void => {
                            spec.children_OTM.items[index].item.children_OTM = node.children_OTM;
                            expandChildren(++index, ++count);
                        },
                        errorCallback
                    );
                } else {
                    expandChildren(++index, ++count);
                }
            }
        }

        expandChildren(0, 1);
    }

    /**
     * Get a spec with all child details expanded
     * @param callback Called with the expanded spec object
     * @param errorCallback Called if there was a network error
     * @param retryCount An internal count that tracks how many time to retry a particular call
     */
    getSpec(callback: (spec:SpecNodeCollectionParent) => void, errorCallback: (title:string, message:string) => void, retryCount:number=0):void {

        jQuery.ajax({
            type: 'GET',
            url: SERVER + SPEC_REST + this.specId + "?expand=" + encodeURIComponent(JSON.stringify(SPEC_REST_EXPAND)),
            dataType: "json",
            context: this,
            success: (data:SpecNodeCollectionParent):void => {
                updateInitialMessage("Top level of content spec loaded", true);
                this.expandSpec(data, callback, errorCallback);
            },
            error: ()=>{
                if (retryCount < RETRY_COUNT) {
                    this.getSpec(callback, errorCallback, ++retryCount);
                } else {
                    errorCallback.bind(this)("Connection Error", "An error occurred while getting the content spec details. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.");
                }
            }
        });
    }

    getAllChildrenInFlatOrder(spec:SpecNodeCollectionParent):SpecNode[] {

        /*
         Get the list of topics that make up the spec in sequential order
         */
        function expandChild (node:SpecNodeCollectionParent):SpecNode[]  {
            /*
             Find the one that has no nextNode
             */
            var lastChild:SpecNode;
            var lastInitialTextChild:SpecNode;
            _.each(node.children_OTM.items, function(childNode, index, list) {
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

            var reverseChildren:SpecNode[] = [];
            var entryNodes:SpecNode[] = [lastInitialTextChild, lastChild];
            _.each(entryNodes, function(entryNode:SpecNode, index, array) {
                if (entryNode !== undefined) {

                    if (nodeIsContainer(entryNode)) {
                        jQuery.merge(reverseChildren, expandChild(entryNode));
                    }

                    reverseChildren.push(entryNode);

                    while (true) {

                        var nextLastChild:SpecNodeItem = _.find(node.children_OTM.items, function (element) {
                            return element.item.nextNode !== undefined &&
                                element.item.nextNode !== null &&
                                element.item.nextNode.id === entryNode.id;
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

        var specTopics:SpecNode[] = expandChild(spec);

        specTopics.reverse();

        this.specTopicIds = [];
        _.each(specTopics, function(childNode, index, list) {
            if (childNode.entityRevision === null) {
                this.specTopicIds.push(childNode.entityId)
            }
        }.bind(this));

        return specTopics;
    }

    getChildrenInOrder(parent:SpecNodeCollectionParent):SpecNode[] {

        /*
         Find the one that has no nextNode
         */
        var lastChild:SpecNode;
        var lastInitialTextChild:SpecNode;
        _.each(parent.children_OTM.items, function(childNode, index, list) {
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

        var reverseChildren:SpecNode[] = [];
        var entryNodes:SpecNode[] = [lastInitialTextChild, lastChild];
        _.each(entryNodes, function(entryNode:SpecNode, index, array) {
            if (entryNode !== undefined) {

                reverseChildren.push(entryNode);

                while (true) {

                    var nextLastChild:SpecNodeItem = _.find(parent.children_OTM.items, function (element) {
                        return element.item.nextNode !== undefined &&
                            element.item.nextNode !== null &&
                            element.item.nextNode.id === entryNode.id;
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
    }

    buildIFrame(div:HTMLDivElement):HTMLIFrameElement {
        /*
         Create the hidden iframe that accepts the XML, transforms it, and posts a message back with the
         HTML
         */
        var iFrame:HTMLIFrameElement = document.createElement("iframe");
        iFrame.style.display = "none";
        document.body.appendChild(iFrame);

        /*
         Create the div that will be filled with the HTML sent by the iframe.
         */
        iFrame["div"] = div;

        return iFrame;
    }

    buildUrl(element:SpecNode):string {
        var url:string;

        if (nodeIsTopic(element)) {
            if (element.revision === undefined) {
                url = SERVER + CSNODE_XSLTXML_REST.replace(CSNODE_ID_MARKER, element.id.toString()) + "?parentDomain=" + LOCAL_URL + "&baseUrl=%23divId%23TOPICID%23";
            } else {
                url = SERVER + CSNODE_XSLTXML_REST
                    .replace(CSNODE_ID_MARKER, element.id.toString())
                    .replace(CSNODE_REV_MARKER, element.revision.toString()) + "?parentDomain=" + LOCAL_URL + "&baseUrl=%23divId%23TOPICID%23";
            }
        } else if (nodeIsTitleContainer(element)) {
            var xml = "<?xml-stylesheet type='text/xsl' href='/pressgang-ccms-static/publican-docbook/html-single-diff.xsl'?>\n" +
                "<" + element.nodeType.toLowerCase() + ">\n" +
                "<title>" + element.title + "</title>\n" +
                "</" + element.nodeType.toLowerCase() + ">";
            url = SERVER + ECHO_XML_REST + "?xml=" + encodeURIComponent(xml) + "&parentDomain=" + LOCAL_URL;
        }

        return url;
    }

    buildDiv(element:SpecNode):JQuery {
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
    }

    createIFrameAndLoadDiv(div:HTMLDivElement):void {
        if (div.getAttribute("data-loading") === "true") {
            var iFrame = this.buildIFrame(div);
            iFrame.src = div.getAttribute("url");
            div.removeAttribute("url");
            div.setAttribute("data-loading", "false");
        }
    }

    /**
     * Builds and iFrame and sets the src attribute to the topics XML+XSLT endpoint.
     * @param iFrame
     * @param delay
     * @param count
     */
    setIFrameSrc(div:HTMLDivElement, url:string, delay:number, count:number):void {

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

    }

    /**
     * Given a spec, create iframes for all topics that have not been previously rendered
     * @param spec The spec with all children expanded
     */
    getTopics(specTopics:SpecNode[]):void{

        jQuery("#loading").remove();

        var topicsAndContainers = _.filter(specTopics, nodeIsTopicOrTitleContainer);

        var delay = _.reduce(topicsAndContainers, function(delay:number, element, index) {
            var url = this.buildUrl(element);
            var div = this.buildDiv(element);
            this.setIFrameSrc(firstElement(div), url, delay, index);
            return delay + DELAY_BETWEEN_IFRAME_SRC_CALLS;
        }, 0, this);

        this.timeoutRefresh = window.setTimeout(() => {
            this.rebuilding = false;
        }, delay);

    }

    buildToc(spec:SpecNodeCollectionParent):void{

        var childIndex = 0;

        var addChildren = (specNode:SpecNode, parent:TreeNode):void => {
            var isContainer = nodeIsTitleContainer(specNode);
            var isChapter = nodeIsChapter(specNode);
            var isTopic = nodeIsTopic(specNode);
            var isInitialContainer = nodeIsInitialContainer(specNode);

            if (isInitialContainer) {
                if (specNode.children_OTM !== null) {
                    var children = this.getChildrenInOrder(specNode);
                    _.each(children, function (element:SpecNode):void {
                        // don't show in toc, but bump child count so the index is still valid
                        // when entries belwo are clicked
                        ++childIndex;
                    });
                }
            } else if (isContainer || isTopic) {
                var treeNode:TreeNode = new TreeNode();
                treeNode.text = specNode.title;
                treeNode.icon = isContainer ? FOLDER_ICON : TOPIC_ICON;
                treeNode.data = childIndex.toString();
                treeNode.state = {opened: true};
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
                    var children = this.getChildrenInOrder(specNode);
                    _.each(children, function (element:SpecNode):void {
                        addChildren(element, treeNode);
                    });
                }
            }
        }

        var toc:TreeNode  = new TreeNode();
        var children = this.getChildrenInOrder(spec);
        _.each(children, function(element:SpecNode) {
            addChildren(element, toc);
        })

        jQuery("#toc").remove();

        var tocDiv = jQuery("<div id='toc'></div>").jstree({
            'core' : {
                'multiple' : false,
                'data' : toc.children
            }
        })
        .on('changed.jstree', function (e, data) {
            if (data.selected.length !== 0) {
                var treeNode = data.instance.get_node(firstElement(data.selected));
                var div = document.getElementById(DIV_BOOK_INDEX_ID_PREFIX + treeNode.data);
                if (div !== null) {
                    div.scrollIntoView(true);
                }
            }
        });
        jQuery(document.body).append(tocDiv);
    }

    rebuildSpec(errorCallback: (title:string, message:string) => void):void {
        this.getSpec(
            (spec:SpecNodeCollectionParent):void => {
                this.expandSpec(
                    spec,
                    (expandedSpec:SpecNodeCollectionParent):void => {
                        this.syncDomWithSpec(expandedSpec);
                        this.buildToc(expandedSpec);
                    },
                    errorCallback
                )
            },
            this.errorCallback
        );
    }

    syncDomWithTopics(updatedTopics:number[]):void{
        /*
            Loop through each topic that has been updated since we last refreshed
         */
        _.each(updatedTopics, function(topicItem) {
            /*
                Get every topic div that references this node
             */
            var topicDivs = jQuery("div." + SPEC_TOPIC_DIV_CLASS + "[" + SPEC_TOPIC_DIV_TOPIC_ID + "='" + topicItem + "']");
            /*
                Remove the divs that have static revisions
             */
            var filteredTopicDivs = _.filter(topicDivs, function (topicDiv:HTMLDivElement) {
                return topicDiv.getAttribute(SPEC_TOPIC_DIV_TOPIC_REV) === null;
            });

            if (filteredTopicDivs.length === 0) {
                throw "Could not find the source topic div for an updated topic";
            }

            /*
                Take every div that needs to be updated and create a iframe to recieve the XML
             */
            _.reduce(filteredTopicDivs, function (delay:number, topicDiv, index):number {
                var url = "";
                var csNodeId = topicDiv.getAttribute(SPEC_TOPIC_DIV_NODE_ID);
                var csNodeRev = topicDiv.getAttribute(SPEC_TOPIC_DIV_NODE_REV);
                if (csNodeRev === null) {
                    url = SERVER + CSNODE_XSLTXML_REST.replace(CSNODE_ID_MARKER, csNodeId) + "?parentDomain=" + LOCAL_URL + "&baseUrl=%23divId%23TOPICID%23";
                } else {
                    url = SERVER + CSNODE_XSLTXML_REST
                        .replace(CSNODE_ID_MARKER, csNodeId.toString())
                        .replace(CSNODE_REV_MARKER, csNodeRev) + "?parentDomain=" + LOCAL_URL + "&baseUrl=%23divId%23TOPICID%23";
                }

                this.setIFrameSrc(topicDiv, url, delay, index);
                return delay + DELAY_BETWEEN_IFRAME_SRC_CALLS;
            }, 0, this);
        }, this);
    }

    /**
     * Here we take the topics associated with the new version of the content spec, remove any existing displayed
     * topics that are no longer present, and create new divs for missing topics, or reorder existing topics
     * to match the layout of the new spec.
     * @param updatedSpec
     */
    syncDomWithSpec(updatedSpec:SpecNodeCollectionParent):void{

        function getTopicDiv(specNode:SpecNode):JQuery {
            if (specNode.entityRevision === null) {
                return jQuery("div[" + SPEC_TOPIC_DIV_NODE_ID + "='" + specNode.id + "']");
            } else {
                return jQuery("div[" + SPEC_TOPIC_DIV_NODE_ID + "='" + specNode.id + "'][" + SPEC_TOPIC_DIV_NODE_REV + "='" + specNode.revision + "']");
            }
        }

        function getTitleDiv(specNode:SpecNode):JQuery {
            return jQuery("div[" + SPEC_TITLE + "='" + specNode.title + "'][" + SPEC_TITLE_CONTAINER + "='" + specNode.nodeType.toLowerCase() + "']");
        }

        function specTopicDivExists(specNode:SpecNode):boolean {
            return getTopicDiv(specNode).length !== 0;
        }

        function specTitleDivExists(specNode:SpecNode):boolean {
            return getTitleDiv(specNode).length !== 0;
        }

        var specNodes = this.getAllChildrenInFlatOrder(updatedSpec);

        /*
            Remove any existing topics that are no longer present.
         */
        var existingSpecDivs = jQuery("." + DIV_BOOK_INDEX_ID_PREFIX);
        var removeDivList = _.filter(existingSpecDivs, function(element) {
            var jQueryElement = jQuery(element);
            if (jQueryElement.hasClass(SPEC_TOPIC_DIV_CLASS)) {
                /*
                 This div displays some topic info
                 */

                var nodeId = parseInt(jQueryElement.attr(SPEC_TOPIC_DIV_NODE_ID));
                var nodeRev = jQueryElement.attr(SPEC_TOPIC_DIV_NODE_REV) !== null ?
                    parseInt(jQueryElement.attr(SPEC_TOPIC_DIV_NODE_REV)) :
                    null;

                var existingNode = _.find(specNodes, function(specNode):boolean {
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

                var existingNode = _.find(specNodes, function(specNode):boolean {
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

        _.each(removeDivList, function(element) {
            /*
                Remove any link target div associated with the spec div
             */
            var linkTargets:JQuery[] = element[SPEC_DIV_TOP_LINK_TARGETS_PROPERTY];
            _.each(linkTargets, function(linkTarget) {
                linkTarget.remove();
            });
            var bottomLinks:JQuery[] = element[SPEC_DIV_BOTTOM_LINK_TARGETS_PROPERTY];
            _.each(bottomLinks, function(linkTarget) {
                linkTarget.remove();
            });

            jQuery(element).remove();
        });

        /*
            Create new iframes and divs for missing topics and titles
         */
        var specNodesMissingDiv = _.filter(specNodes, function(specNode) {
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
        var delay = _.reduce(specNodesMissingDiv, function(delay:number, element, index) {
            var url = this.buildUrl(element);
            var div = this.buildDiv(element);
            this.setIFrameSrc(firstElement(div), url, delay, index);
            return delay + DELAY_BETWEEN_IFRAME_SRC_CALLS;
        }, 0, this);

        /*
            Set a timeout to do the fallabck refresh, just i case an iframe doesn't load properly
         */
        this.timeoutRefresh = window.setTimeout(() => {
            this.rebuilding = false;
        }, delay);

        function divsAreEqual(node1:JQuery, node2:JQuery):boolean {
            if (node1.length !== 1) {
                return false;
            }

            if (node2.length !== 1) {
                return false;
            }

            return firstElement(node1).id === firstElement(node2).id;
        }

        function getActualChild(specNode):JQuery {
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
        _.each(topicsAndContainers, function(specNode, index, list) {
            var nthSpecDiv:JQuery = jQuery("div." + DIV_BOOK_INDEX_ID_PREFIX + ":eq(" + index + ")");
            var previousSibling:JQuery = index === 0 ? null : jQuery("div." + DIV_BOOK_INDEX_ID_PREFIX + ":eq(" + (index - 1) + ")");
            var actualChild:JQuery = getActualChild(specNode);

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
                _.each(actualChild[SPEC_DIV_TOP_LINK_TARGETS_PROPERTY], function(linkTarget:JQuery) {
                    linkTarget.remove();
                });
                _.each(actualChild[SPEC_DIV_BOTTOM_LINK_TARGETS_PROPERTY], function(linkTarget:JQuery) {
                    linkTarget.remove();
                });

                if (previousSibling === null) {
                    /*
                        prepend to start of book
                     */
                    _.each(firstElement(actualChild)[SPEC_DIV_BOTTOM_LINK_TARGETS_PROPERTY], function(linkTarget:JQuery) {
                        jQuery(document.body).prepend(linkTarget);
                    });
                    jQuery("#book").prepend(actualChild);
                    _.each(firstElement(actualChild)[SPEC_DIV_TOP_LINK_TARGETS_PROPERTY], function(linkTarget:JQuery) {
                        jQuery(document.body).prepend(linkTarget);
                    });
                } else {
                    var previousSiblingBottomLinksLength = firstElement(previousSibling)[SPEC_DIV_BOTTOM_LINK_TARGETS_PROPERTY].length;
                    if (previousSiblingBottomLinksLength !== 0) {
                        var previousSiblingLastBottomElement = firstElement(previousSibling)[SPEC_DIV_BOTTOM_LINK_TARGETS_PROPERTY][previousSiblingBottomLinksLength - 1];
                        /*
                         insert after previous child
                         */
                        _.each(firstElement(actualChild)[SPEC_DIV_BOTTOM_LINK_TARGETS_PROPERTY], function (linkTarget:JQuery) {
                            previousSiblingLastBottomElement.after(linkTarget);
                        });
                        previousSiblingLastBottomElement.after(actualChild);
                        _.each(firstElement(actualChild)[SPEC_DIV_TOP_LINK_TARGETS_PROPERTY], function (linkTarget:JQuery) {
                            previousSiblingLastBottomElement.after(linkTarget);
                        });
                    } else {
                        /*
                         insert after previous child
                         */
                        _.each(firstElement(actualChild)[SPEC_DIV_BOTTOM_LINK_TARGETS_PROPERTY], function (linkTarget:JQuery) {
                            previousSibling.after(linkTarget);
                        });
                        previousSibling.after(actualChild);
                        _.each(firstElement(actualChild)[SPEC_DIV_TOP_LINK_TARGETS_PROPERTY], function (linkTarget:JQuery) {
                            previousSibling.after(linkTarget);
                        });
                    }
                }
            }
        });

        /*
            Update the ids to reflect the position of the divs in the book.
         */
        _.each(jQuery("div." + DIV_BOOK_INDEX_ID_PREFIX), function(element, index) {
            element.id = DIV_BOOK_INDEX_ID_PREFIX + index;
        });
    }
}

function updateInitialMessage(message, showLoadingImage) {
    if (showLoadingImage) {
        jQuery("#loading").html('<div class="loadingContent">' + message + '</div><div class="loadingContent"><img class="loadingImage" src="images/loading.gif"/></div>');
    } else {
        jQuery("#loading").html('<div class="loadingContent">' + message + '</div>');
    }
}

var qs = (function(a) {
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
})
