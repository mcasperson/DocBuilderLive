/// <reference path="../definitions/jquery.d.ts" />
/// <reference path="../definitions/underscore.d.ts" />

/**
 * Interacting with the HornetQ REST interface requires a common sequence of API calls. This class
 * encapsulates this cycle of calls.
 */
class HornetQRestListener {
    private MSG_PULL_SUBSCRIPTIONS_HEADER = "msg-pull-subscriptions";
    private MSG_CONSUME_NEXT_HEADER = "msg-consume-next";
    private WAIT_FOR_MESSAGE = 60;
    private RETRY_TIMEOUT = 10000;

    private topicResourceURL:string;
    private messageCallback:(message:string) => void;
    private acceptWait:boolean;

    constructor(acceptWait:boolean, topicResourceURL:string, messageCallback:(message:string) => void) {
        this.topicResourceURL = topicResourceURL;
        this.messageCallback = messageCallback;
        this.acceptWait = acceptWait;
        this.listenForMessages();
    }

    listenForMessages() {
        // Do a GET to the endpoint url. If this is successful, we will have a URL that we can POST to
        // to join the JMS topic
        jQuery.ajax({
            type: 'GET',
            url: this.topicResourceURL,
            dataType: "text",
            success: this.initialConnectionSuccess,
            error: this.connectionError,
            context: this
        });
    }

    initialConnectionSuccess(data, textStatus, jqXHR):void {
        var msgPullSubscriptions = jqXHR.getResponseHeader(this.MSG_PULL_SUBSCRIPTIONS_HEADER);

        // Do a POST to join the JMS topic
        jQuery.ajax({
            type: 'POST',
            data: "durable=true",
            url: msgPullSubscriptions,
            dataType: "text",
            success: this.joinTopicSuccess,
            error: this.connectionError,
            context: this
        });
    }

    /**
     * If any of the requests the the HornetQ REST interface fail, we will start again
     * after a short delay
     */
    connectionError (jqXHR, textStatus, errorThrown):void {
        window.setTimeout(function() {
            this.listenForMessages();
        }.bind(this), this.RETRY_TIMEOUT);
    }

    /**
     * The response to calling the Topic Resource, and from a call to the consume next url, is to
     * call the url specified in the msg-consume-next header.
     */
    joinTopicSuccess(data, textStatus, jqXHR):void {
        /*
            Find the url that we need to POST to join the JMS topic
        */
        var msgConsumeNext = jqXHR.getResponseHeader(this.MSG_CONSUME_NEXT_HEADER);

        if (msgConsumeNext !== null) {
            var headers = this.acceptWait ? {"Accept-Wait": this.WAIT_FOR_MESSAGE} : {};

            // Do a POST to join the JMS topic
            jQuery.ajax({
                type: 'POST',
                // Uncomment this to allow the client to open a connection that will wait for a message
                headers: headers,
                url: msgConsumeNext,
                dataType: "text",
                success: this.pullSubscriptionSuccess,
                error: this.pullSubscriptionError,
                context: this
            });
        } else {
            this.listenForMessages();
        }
    }

    /**
     * jQuery considers the response sent by the HornetQ REST interface when there are no messages to be an error.
     * However, it is expected that a 503 response will be received in this case. This function distinguishes between
     * an actual error and this expected one.
     */
    pullSubscriptionError(jqXHR, textStatus, errorThrown):void {

        if (jqXHR.status === 503) {
            /*
             There were no messages, so try again
             */
            var msgConsumeNext = jqXHR.getResponseHeader(this.MSG_CONSUME_NEXT_HEADER);
            if (msgConsumeNext !== null) {
                if (this.acceptWait) {
                    this.joinTopicSuccess(null, null, jqXHR);
                } else {
                    window.setTimeout(function() {
                        this.joinTopicSuccess(null, null, jqXHR);
                    }.bind(this), this.RETRY_TIMEOUT);
                }

            } else {
                this.listenForMessages();
            }
        } else {
            /*
             Anything else and we'll run through the JMS topic joining process
             again
             */
            this.listenForMessages();
        }
    }

    pullSubscriptionSuccess(data, textStatus, jqXHR):void {
        /*
         There were some messages in the queue to be processed
         */
        this.messageCallback(data);
        this.joinTopicSuccess(data, textStatus, jqXHR);
    }
}