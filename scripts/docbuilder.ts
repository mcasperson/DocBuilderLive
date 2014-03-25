/// <reference path="../definitions/jquery.d.ts" />
/// <reference path="collections.ts" />

var SERVER:string = "http://pressgang.lab.eng.pnq.redhat.com:8080";
var REVISION_DETAILS:string = "/pressgang-ccms/rest/1/sysinfo/get/json";

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
    }

    getLastModifiedTime(callback: (lastRevisionDate:Date) => void):void {
        jQuery.ajax()
    }

    getSpec(callback: (topic:Object) => void):void {

    }

    getTopic(id:number, callback: (topic:Object) => void) {

    }

    syncTopicsCollectionWithSpec():void {

    }

    syncDomWithSpec():void {

    }
}