//var SERVER:string = "http://pressgang.lab.eng.pnq.redhat.com:8080";
var SERVER:string = "http://topicindex-dev.ecs.eng.bne.redhat.com:8080"
//var SERVER:string = "http://localhost:8080"

var REST_BASE:string = "/pressgang-ccms/rest/1"

/**
 * If true, calls to the messaging rest endpoints will open a connection and wait for a response.
 * If false, calls will be made to the messaging rest endpoints periodically without waiting
 * @type {boolean}
 */
var ACCEPT_WAIT:boolean = true;