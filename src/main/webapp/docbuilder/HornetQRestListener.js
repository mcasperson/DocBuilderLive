/// <reference path="../definitions/jquery.d.ts" />
/// <reference path="../definitions/underscore.d.ts" />
/**
* Interacting with the HornetQ REST interface requires a common sequence of API calls. This class
* encapsulates this cycle of calls.
*/
var HornetQRestListener = (function () {
    function HornetQRestListener(topicResourceURL, messageCallback) {
        this.MSG_PULL_SUBSCRIPTIONS_HEADER = "msg-pull-subscriptions";
        this.MSG_CONSUME_NEXT_HEADER = "msg-consume-next";
        this.WAIT_FOR_MESSAGE = 60;
        this.RETRY_TIMEOUT = 10000;
        this.topicResourceURL = topicResourceURL;
        this.messageCallback = messageCallback;
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

        // Do a POST to join the JMS topic
        jQuery.ajax({
            type: 'POST',
            url: msgPullSubscriptions,
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

        if (msgConsumeNext !== null) {
            // Do a POST to join the JMS topic
            jQuery.ajax({
                type: 'POST',
                headers: {
                    "Accept-Wait": this.WAIT_FOR_MESSAGE
                },
                url: msgConsumeNext,
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
        if (jqXHR.status === 503) {
            /*
            There were no messages, so try again
            */
            var msgConsumeNext = jqXHR.getResponseHeader(this.MSG_CONSUME_NEXT_HEADER);
            if (msgConsumeNext !== null) {
                this.joinTopicSuccess(null, null, jqXHR);
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
