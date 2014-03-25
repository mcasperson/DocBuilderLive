/// <reference path="../definitions/jquery.d.ts" />
/// <reference path="collections.ts" />

var RETRY_COUNT:number = 5;
var SERVER:string = "http://pressgang.lab.eng.pnq.redhat.com:8080";
var REVISION_DETAILS_REST:string = "/pressgang-ccms/rest/1/sysinfo/get/json";
var SPEC_REST:string="/contentspec/get/json/";

interface SysInfo {
    lastRevision:number;
    lastRevisionDate:number;
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
            error: ()=>{
                if (retryCount < RETRY_COUNT) {
                    this.getLastModifiedTime(callback, errorCallback, ++retryCount);
                } else {
                    errorCallback("Connection Error", "An error occurred while getting the server settings. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.");
                }
            }
        });
    }

    getSpec(callback: (spec:Object) => void, errorCallback: (title:string, message:string) => void, retryCount:number=0):void {
        jQuery.ajax({
            type: 'GET',
            url: SERVER + SPEC_REST,
            dataType: "json",
            success: (data:SysInfo)=>{
                callback(new Date(data.lastRevisionDate));
            },
            error: ()=>{
                if (retryCount < RETRY_COUNT) {
                    this.getLastModifiedTime(callback, errorCallback, ++retryCount);
                } else {
                    errorCallback("Connection Error", "An error occurred while getting the server settings. This may be caused by an intermittent network failure. Try your import again, and if problem persist log a bug.");
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