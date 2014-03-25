/// <reference path="../definitions/jquery.d.ts" />
/// <reference path="../definitions/underscore.d.ts" />
/// <reference path="collections.ts" />

var CONTAINER_NODE_TYPES:string[] = ["CHAPTER", "SECTION", "PART", "APPENDIX", "INITIAL_CONTENT"];
var RETRY_COUNT:number = 5;
//var SERVER:string = "http://pressgang.lab.eng.pnq.redhat.com:8080";
var SERVER:string = "http://topicindex-dev.ecs.eng.bne.redhat.com:8080"
var REST_BASE:string = "/pressgang-ccms/rest/1"
var REVISION_DETAILS_REST:string = REST_BASE + "/sysinfo/get/json";
var SPEC_REST:string= REST_BASE + "/contentspec/get/json/";
var SPEC_REST_EXPAND:Object={
    branches: [
        {
            trunk: {
                name: "children_OTM"
            }
        }
    ]
}
var SPECNODE_REST:string = REST_BASE + "/contentspecnode/get/json/";
var TOPIC_REST:string = REST_BASE + "/topic/get/json/";

interface SysInfo {
    lastRevision:number;
    lastRevisionDate:number;
}

interface Spec {
    children_OTM:SpecNodeCollection;
}

interface SpecNodeCollection {
    items:SpecNodeItem[];
}

interface SpecNodeItem {
    item:SpecNode;
}

interface SpecNode {
    id:number;
    entityId:number;
    entityRevision:number;
    nodeType:string;
    title:string;
    children_OTM:SpecNodeItem[];
}

class RenderedTopicDetails {
    public topicId:number;
    public topicRevision:number;
    public includesTitle: boolean;

    constructor();
    constructor(specNode?:SpecNode, includesTitle?:boolean) {
        this.topicId = specNode !== undefined ? specNode.entityId : -1;
        this.topicRevision = specNode !== undefined ? specNode.entityRevision : -1;
        this.includesTitle = includesTitle || false;
    }

    toString():string {
        return "ID:" + this.topicId + " REV: " + this.topicRevision + " TITLE: " + this.includesTitle;
    }
}

class DocBuilderLive {

    private lastRevisionDate:Date;
    private specId:number;
    private topics:collections.Dictionary<RenderedTopicDetails, HTMLIFrameElement>;
    private titles:collections.Dictionary<string, HTMLIFrameElement>;
    private errorCallback = (title:string, message:string):void => {
        window.alert(title + "\n" + message);
    }

    constructor(specId:number) {
        this.specId = specId;
        this.getLastModifiedTime(
            (lastRevisionDate:Date) => {
                this.lastRevisionDate = lastRevisionDate;
                this.getSpec(
                    (spec:Spec):void => {
                        this.getTopics(spec);
                    },
                    this.errorCallback
                )
            },
            this.errorCallback
        );
    }

    getLastModifiedTime(callback: (lastRevisionDate:Date) => void, errorCallback: (title:string, message:string) => void, retryCount:number=0):void {
        jQuery.ajax({
            type: 'GET',
            url: SERVER + REVISION_DETAILS_REST,
            dataType: "json",
            success: (data:SysInfo) => {
               callback(new Date(data.lastRevisionDate));
            },
            error: () => {
                if (retryCount < RETRY_COUNT) {
                    this.getLastModifiedTime(callback, errorCallback, ++retryCount);
                } else {
                    errorCallback("Connection Error", "An error occurred while getting the server settings. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.");
                }
            }
        });
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
            success: (data) => {

                var expandChildren = (index:number):void => {
                    if (index >= data.children_OTM.items.length) {
                        callback(data);
                    } else {
                        var element:SpecNode = data.children_OTM.items[index].item;
                        if (CONTAINER_NODE_TYPES.indexOf(element.nodeType) !== -1) {
                            this.populateChild(
                                element.id,
                                (node:SpecNode):void =>  {
                                    data.children_OTM.items[index].item = node;
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
                    errorCallback("Connection Error", "An error occurred while getting the content spec details. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.");
                }
            }
        });
    }

    /**
     * Get a spec with all child details expanded
     * @param callback Called with the expanded spec object
     * @param errorCallback Called if there was a network error
     * @param retryCount An internal count that tracks how many time to retry a particular call
     */
    getSpec(callback: (spec:Spec) => void, errorCallback: (title:string, message:string) => void, retryCount:number=0):void {
        jQuery.ajax({
            type: 'GET',
            url: SERVER + SPEC_REST + this.specId + "?expand=" + encodeURIComponent(JSON.stringify(SPEC_REST_EXPAND)),
            dataType: "json",
            success: (data:Spec) => {
                var expandChildren = (index:number):void => {
                    if (index >= data.children_OTM.items.length) {
                        callback(data);
                    } else {
                        var element:SpecNode = data.children_OTM.items[index].item;
                        if (CONTAINER_NODE_TYPES.indexOf(element.nodeType) !== -1) {
                            this.populateChild(
                                element.id,
                                (node:SpecNode):void => {
                                    data.children_OTM.items[index].item = node;
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
            error: ()=>{
                if (retryCount < RETRY_COUNT) {
                    this.getSpec(callback, errorCallback, ++retryCount);
                } else {
                    errorCallback("Connection Error", "An error occurred while getting the content spec details. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.");
                }
            }
        });
    }

    /**
     * Given a spec, create iframes for all topics that have not been previously rendered
     * @param spec The spec with all children expanded
     */
    getTopics(spec:Spec):void {

    }

    getTopic(id:number, callback: (topic:Object) => void):void {

    }

    syncTopicsCollectionWithSpec():void {

    }

    syncDomWithSpec():void {

    }
}

new DocBuilderLive(21464);