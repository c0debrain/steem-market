let precision = 1000; // SAME FOR SBD AND STEEM

class Order {
    constructor(data, type) {
        this.type = type;
        this.price = type === "ask" ? parseFloat(data.real_price) :
            (parseFloat(data.real_price));
        this.stringPrice = this.price.toFixed(6);
        this.steem = parseInt(data.steem, 10);
        this.sbd = parseInt(data.sbd, 10);
    }

    getSteemAmount() {
        return this.steem / precision;
    }

    getPrice() {
        return this.price;
    }

    getStringPrice() {
        return this.stringPrice;
    }

    getSBDAmount() {
        return this.sbd / precision;
    }

    add(order) {
        return new Order({
            real_price: this.price,
            steem: this.steem + order.steem,
            sbd: this.sbd + order.sbd
        }, this.type);
    }

    equals(order) {
        return (
            this.sbd === order.sbd &&
            this.steem === order.steem &&
            this.price === order.price
        );
    }
}

// class Price {
//     constructor(ratio) {
//         this.ratio = ratio;
//     }
//
//     getPrice() {
//
//     }
//
//     getInvertedPrice() {
//         return 1 / this.getPrice();
//     }
// }

class TradeHistory {

    constructor(fill) {
        this.date = new Date(fill.date);
        this.type = fill.current_pays.indexOf("SBD") !== -1 ? "buy" : "sell";

        if (this.type === "buy") {
            this.sbd = parseFloat(fill.current_pays.split(" SBD")[0]);
            this.steem = parseFloat(fill.open_pays.split(" STEEM")[0]);
        } else {
            this.sbd = parseFloat(fill.open_pays.split(" SBD")[0]);
            this.steem = parseFloat(fill.current_pays.split(" STEEM")[0]);
        }

        this.price = this.sbd / this.steem;
        this.stringPrice = this.price.toFixed(6);
    }

    getSteemAmount() {
        return this.steem;
    }

    getSBDAmount() {
        return this.sbd;
    }

    getPrice() {
        return this.price;
    }

    getStringPrice() {
        return this.stringPrice;
    }

}

class MarketHistory {

    constructor(bucket) {
        this.date = new Date(bucket.open + "+00:00").getTime();

        this.high = (bucket.high_sbd / bucket.high_steem);
        this.low = (bucket.low_sbd / bucket.low_steem);
        this.open = (bucket.open_sbd / bucket.open_steem);
        this.close = (bucket.close_sbd / bucket.close_steem);

        this.steemVolume = bucket.steem_volume / precision;
        this.sbdVolume = bucket.sbd_volume / precision;
    }

    getPriceData() {
        return [this.date, this.open, this.high, this.low, this.close];
    }

    getVolumeData() {
        return [this.date, this.sbdVolume];
    }
}

function sortByPrice(inverse, a, b) {
    if (inverse) {
        return b.price - a.price;
    }
    return a.price - b.price;
};

function sumByPrice(orders) {
    return orders.reduce((previous, current) => {
        if (!previous.length) {
            previous.push(current);
        } else if (previous[previous.length - 1].getStringPrice() === current.getStringPrice()) {
            previous[previous.length - 1] = previous[previous.length - 1].add(current);
        } else {
            previous.push(current);
        }

        return previous;
    }, [])
}

function parseOrderbook(data) {
    let bids = data.bids.map(bid => {
        return new Order(bid, "bid");
    }).sort(sortByPrice.bind(this, true));

    let asks = data.asks.map(ask => {
        return new Order(ask, "ask");
    }).sort(sortByPrice.bind(this, false));

    return {
        asks, bids
    };
}

function parsePriceHistory(data) {
    let previousBucket;
    return data.map(bucket => {
        if (previousBucket) {
            // console.log("previousBucket:", previousBucket);
        }
        previousBucket = bucket;
        let history = new MarketHistory(bucket);
        if (history.high == 6) {
            console.log("6 bucket:", bucket);
        }
        return history;
    });
}

function parseHistory(data) {
    let history =  data.map(fill => {
        return new TradeHistory(fill);
    })

    return history.sort((a, b) => {
        return (b.date === a.date ? (a.getSBDAmount() - b.getSBDAmount()) : (b.date - a.date));
    });
}

module.exports = {
    Order,
    MarketHistory,
    TradeHistory,
    parseOrderbook,
    sortByPrice,
    sumByPrice,
    parsePriceHistory,
    parseHistory
};
