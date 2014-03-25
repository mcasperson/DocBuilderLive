/// <reference path="../definitions/jquery.d.ts" />
/// <reference path="../definitions/underscore.d.ts" />
/// <reference path="collections.ts" />

var CHAPTER_NODE_TYPE:string = "CHAPTER";
var CONTAINER_NODE_TYPES:string[] = [CHAPTER_NODE_TYPE];
var RETRY_COUNT:number = 5;
var SERVER:string = "http://pressgang.lab.eng.pnq.redhat.com:8080";
var REVISION_DETAILS_REST:string = "/pressgang-ccms/rest/1/sysinfo/get/json";
var SPEC_REST:string="/pressgang-ccms/rest/1/contentspec/get/json/";
var SPEC_REST_EXPAND:Object={
    branches: [
        {
            trunk: {
                name: "children_OTM"
            }
        }
    ]
}
var SPECNODE_REST:string = "/contentspecnode/get/json/";

interface SysInfo {
    lastRevision:number;
    lastRevisionDate:number;
}

interface SpecNode {
    id:number;
    entityId:number;
    entityRevision:number;
    nodeType:string;
}

class RenderedTopicDetails {
    public topicId:number;
    public topicRevision:number;
    public includesTitle: boolean;
}

class DocBuilderLive {

    private lastRevisionDate:Date;
    private specId:number;
    private topics:collections.Dictionary<RenderedTopicDetails, HTMLIFrameElement>;
    private titles:collections.Dictionary<string, HTMLIFrameElement>;

    constructor(specId:number) {
        this.specId = specId;
        this.getLastModifiedTime(
            (lastRevisionDate:Date)=>{
                this.lastRevisionDate = lastRevisionDate;
            },
            (title:string, message:string) => {
                window.alert(title + "\n" + message);
            }
        );
    }

    getLastModifiedTime(callback: (lastRevisionDate:Date) => void, errorCallback: (title:string, message:string) => void, retryCount:number=0):void {
        jQuery.ajax({
            type: 'GET',
            url: SERVER + REVISION_DETAILS_REST,
            dataType: "json",
            success: (data:SysInfo)=>{
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

    populateChild(id:number, callback: (node) => void, errorCallback: (title:string, message:string) => void, retryCount:number=0):void {
        jQuery.ajax({
            type: 'GET',
            url: SERVER + SPEC_REST + encodeURIComponent(JSON.stringify(SPEC_REST_EXPAND)),
            dataType: "json",
            success: (data) => {

                var expandChildren = (index:number):void => {
                    if (index >= data.children_OTM.items.length) {
                        callback(data);
                    } else {
                        var element:SpecNode = data.children_OTM.items[index];
                        if (CONTAINER_NODE_TYPES.indexOf(element.nodeType) !== -1) {
                            this.populateChild(
                                element.id,
                                (node):void =>  {
                                    data.children_OTM.items[index] = node;
                                    expandChildren(++index);
                                },
                                errorCallback
                            );
                        }
                    }
                }

                expandChildren(0);
            },
            error: ()=>{
                if (retryCount < RETRY_COUNT) {
                    this.getLastModifiedTime(callback, errorCallback, ++retryCount);
                } else {
                    errorCallback("Connection Error", "An error occurred while getting the content spec details. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.");
                }
            }
        });
    }

    getSpec(callback: (spec) => void, errorCallback: (title:string, message:string) => void, retryCount:number=0):void {
        jQuery.ajax({
            type: 'GET',
            url: SERVER + SPEC_REST + encodeURIComponent(JSON.stringify(SPEC_REST_EXPAND)),
            dataType: "json",
            success: (data) => {
                var expandChildren = (index:number):void => {
                    if (index >= data.children_OTM.items.length) {
                        callback(data);
                    } else {
                        var element:SpecNode = data.children_OTM.items[index];
                        if (CONTAINER_NODE_TYPES.indexOf(element.nodeType) !== -1) {
                            this.populateChild(
                                element.id,
                                (node):void =>  {
                                    data.children_OTM.items[index] = node;
                                    expandChildren(++index);
                                },
                                errorCallback
                            );
                        }
                    }
                }

                expandChildren(0);
            },
            error: ()=>{
                if (retryCount < RETRY_COUNT) {
                    this.getLastModifiedTime(callback, errorCallback, ++retryCount);
                } else {
                    errorCallback("Connection Error", "An error occurred while getting the content spec details. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.");
                }
            }
        });
    }

    getTopic(id:number, callback: (topic:Object) => void) {

    }

    syncTopicsCollectionWithSpec():void {

    }

    syncDomWithSpec():void {

    }
}