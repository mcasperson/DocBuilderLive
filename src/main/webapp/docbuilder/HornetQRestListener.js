/// <reference path="../definitions/jquery.d.ts" />
/// <reference path="../definitions/underscore.d.ts" />
/// <reference path="../definitions/URI.d.ts" />
/// <reference path="constants.ts" />
/// <reference path="utils.ts" />
/**
* Interacting with the HornetQ REST interface requires a common sequence of API calls. This class
* encapsulates this cycle of calls.
*/
var HornetQRestListener = (function () {
    function HornetQRestListener(acceptWait, topicResourceURL, messageCallback) {
        this.MSG_PULL_SUBSCRIPTIONS_HEADER = "msg-pull-subscriptions";
        this.MSG_CONSUME_NEXT_HEADER = "msg-consume-next";
        this.WAIT_FOR_MESSAGE = 60;
        this.RETRY_TIMEOUT = 10000;
        this.topicResourceURL = topicResourceURL;
        this.messageCallback = messageCallback;
        this.acceptWait = acceptWait;
        this.subscriptionName = Utils.guid();
        this.listenForMessages();
    }
    HornetQRestListener.prototype.listenForMessages = function () {
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
    };

    HornetQRestListener.prototype.initialConnectionSuccess = function (data, textStatus, jqXHR) {
        var msgPullSubscriptions = jqXHR.getResponseHeader(this.MSG_PULL_SUBSCRIPTIONS_HEADER);

        /*
        Sometimes the hostname in the pull subscriptions header can be wrong, like if the
        application server is behind a proxy. So strip out the hostname and replace it
        with what we know to be correct
        */
        var fixedMsgPullSubscriptions = SERVER + new URI(msgPullSubscriptions).path();

        // Do a POST to join the JMS topic
        jQuery.ajax({
            type: 'POST',
            data: "durable=true&name=" + this.subscriptionName,
            url: fixedMsgPullSubscriptions,
            dataType: "text",
            success: this.joinTopicSuccess,
            error: this.connectionError,
            context: this
        });
    };

    /**
    * If any of the requests the the HornetQ REST interface fail, we will start again
    * after a short delay
    */
    HornetQRestListener.prototype.connectionError = function (jqXHR, textStatus, errorThrown) {
        window.setTimeout(function () {
            this.listenForMessages();
        }.bind(this), this.RETRY_TIMEOUT);
    };

    /**
    * The response to calling the Topic Resource, and from a call to the consume next url, is to
    * call the url specified in the msg-consume-next header.
    */
    HornetQRestListener.prototype.joinTopicSuccess = function (data, textStatus, jqXHR) {
        /*
        Find the url that we need to POST to join the JMS topic
        */
        var msgConsumeNext = jqXHR.getResponseHeader(this.MSG_CONSUME_NEXT_HEADER);

        var fixedMsgConsumeNext = SERVER + new URI(msgConsumeNext).path();

        if (fixedMsgConsumeNext !== null) {
            var headers = this.acceptWait ? { "Accept-Wait": this.WAIT_FOR_MESSAGE } : {};

            // Do a POST to join the JMS topic
            jQuery.ajax({
                type: 'POST',
                // Uncomment this to allow the client to open a connection that will wait for a message
                headers: headers,
                url: fixedMsgConsumeNext,
                dataType: "text",
                success: this.pullSubscriptionSuccess,
                error: this.pullSubscriptionError,
                context: this
            });
        } else {
            this.listenForMessages();
        }
    };

    /**
    * jQuery considers the response sent by the HornetQ REST interface when there are no messages to be an error.
    * However, it is expected that a 503 response will be received in this case. This function distinguishes between
    * an actual error and this expected one.
    */
    HornetQRestListener.prototype.pullSubscriptionError = function (jqXHR, textStatus, errorThrown) {
        if (jqXHR.status === 503 || jqXHR.status === 412) {
            /*
            There were no messages, so try again
            */
            var msgConsumeNext = jqXHR.getResponseHeader(this.MSG_CONSUME_NEXT_HEADER);
            if (msgConsumeNext !== null) {
                if (this.acceptWait) {
                    this.joinTopicSuccess(null, null, jqXHR);
                } else {
                    window.setTimeout(function () {
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
    };

    HornetQRestListener.prototype.pullSubscriptionSuccess = function (data, textStatus, jqXHR) {
        /*
        There were some messages in the queue to be processed
        */
        this.messageCallback(data);
        this.joinTopicSuccess(data, textStatus, jqXHR);
    };
    return HornetQRestListener;
})();
//# sourceMappingURL=HornetQRestListener.js.map
