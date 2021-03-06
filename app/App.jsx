var React = require("react");
var socketIO = require('socket.io-client')
import {Order, MarketHistory, TradeHistory, sumByPrice, sortByPrice,
    parseOrderbook, parseHistory, parsePriceHistory} from "./Utils/marketUtils";
import DepthChart from "./DepthChart.jsx";
import PriceChart from "./PriceChart.jsx";
import config from "../config";
import moment from "moment";
import Highcharts from "highcharts/highstock";
import Orderbook from "./Orderbook/Orderbook.jsx";

// Grab the state from a global injected into server-generated HTML

var initialState;
if (typeof window !== "undefined") initialState = window.__INITIAL_STATE__;

if ("setOptions" in Highcharts) {
    Highcharts.setOptions({
        global: {
            useUTC: false
        }
    });
}

class App extends React.Component {

    constructor(props, context) {
        super();

        let {bids, asks} = parseOrderbook((context && context.data) ? context.data.orderbook : initialState.orderbook);
        let priceHistory = parsePriceHistory((context && context.data) ? context.data.markethistory : initialState.markethistory);
        let history = parseHistory((context && context.data) ? context.data.tradehistory : initialState.tradehistory);
        let ticker = (context && context.data) ? context.data.ticker : initialState.ticker;
        this.state = {
            apiReady: false,
            asks: asks,
            bids: bids,
            history: history,
            ticker: ticker,
            priceHistory: priceHistory,
            priceTop: true,
            historyIndex: 0,
            buyIndex: 0,
            sellIndex: 0
        };

    }

    componentDidMount() {
        var socket = socketIO.connect(config.host, {secure: config.secure});

        socket.on("connect", (res) => {
            console.log("connected");
        });

        socket.on('ticker', (data) => {
            this.setState({ticker: data});
        })

        socket.on('markethistory', (data) => {
            this.setState({priceHistory: parsePriceHistory(data)});
        })

        socket.on('orderbook', (data) => {
            let {bids, asks} = parseOrderbook(data);

            this.setState({
                bids: sumByPrice(bids), asks: sumByPrice(asks)
            });


        });

        socket.on('tradehistory', (data) => {

            let history = parseHistory(data);

            this.setState({history});
        });
    }

    renderHistoryRows(history, buy) {
        if (!history.length) {
            return null;
        }

        let {historyIndex} = this.state;

        return history.map((order, index) => {
            if (index >= historyIndex && index < (historyIndex + 10)) {

                return (
                    <tr key={index + "_" + order.date} className={order.type === "buy" ? "buy" : "sell"}>
                        <td style={{textAlign: "right"}}>{moment.utc(order.date).local().format('MM/DD/YYYY HH:mm:ss')}</td>
                        <td style={{textAlign: "right"}}>{order.getStringPrice()}</td>
                        <td style={{textAlign: "right"}}>{order.getSteemAmount().toFixed(3)}</td>
                        <td style={{textAlign: "right"}}>{order.getSBDAmount().toFixed(3)}</td>
                    </tr>
                );
            }
        }).filter(a => {
            return !!a;
        });
    }

    _toggleChartPosition() {
        this.setState({
            priceTop: !this.state.priceTop
        });
    }

    _toggleSideBySideCharts() {
        this.setState({
            sideBySide: !this.state.sideBySide
        });
    }

    _setHistoryPage(back) {
        let newIndex = this.state.historyIndex + (back ? 10 : -10);
        newIndex = Math.min(Math.max(0, newIndex), this.state.history.length - 10);
        this.setState({
            historyIndex: newIndex
        });
    }

    render() {
        let {asks, bids, history, ticker, priceHistory, priceTop,
            historyIndex, buyIndex, sellIndex} = this.state;

        let latest = parseFloat(ticker.latest).toFixed(6);

        let changePercent = parseFloat(ticker.percent_change);

        let priceChart = priceHistory.length ? <PriceChart priceHistory={priceHistory} /> : null;

        return (
            <div className="container">


                <div className="row">
                    <div className="col-xs-12">
                        <div className="btn btn-default pull-left" onClick={this._toggleChartPosition.bind(this)}>Switch charts</div>
                        {Object.keys(ticker).length ?
                        <ul className="market-ticker">
                            <li><b>Last price</b>${latest}/STEEM (<span className={changePercent === 0 ? "" : changePercent < 0 ? "negative" : "positive"}>{changePercent.toFixed(3)}%</span>)</li>
                            <li><b>24h volume</b>${(parseFloat(ticker.sbd_volume.split(" ")[0])).toFixed(4)}</li>
                            <li><b>Bid</b>${parseFloat(ticker.highest_bid).toFixed(6)}</li>
                            <li><b>Ask</b>${parseFloat(ticker.lowest_ask).toFixed(6)}</li>
                            <li><b>Spread</b>{(100 * (parseFloat(ticker.lowest_ask) - parseFloat(ticker.highest_bid)) / parseFloat(ticker.highest_bid)).toFixed(2)}%</li>

                        </ul> : null}
                    </div>
                </div>


                <div className="row">
                    <div className="col-xs-12">

                        {priceTop ? priceChart :
                            <DepthChart data={{asks, bids}} />
                        }
                    </div>
                </div>

                <div className="row">
                    <div className="col-xs-6 col-lg-4">
                        <Orderbook orders={bids} buy />
                    </div>

                    <div className="col-xs-6 col-lg-4">
                        <Orderbook orders={asks} sell />
                    </div>

                    <div className="col-xs-12 col-lg-4">

                        <table className="table table-condensed trade-history">
                            <caption>Order history</caption>
                            <thead>
                                <tr>
                                    <th style={{textAlign: "center"}}>Date</th>
                                    <th style={{textAlign: "right"}}>Price</th>
                                    <th style={{textAlign: "right"}}>Steem</th>
                                    <th style={{textAlign: "right"}}>SD ($)</th>
                                </tr>
                            </thead>
                            <tbody>
                                    {this.renderHistoryRows(history)}
                            </tbody>
                        </table>

                        <nav>
                          <ul className="pager" style={{marginTop: 0, marginBottom: 0}}>
                            <li className={"previous" + (historyIndex === 0 ? " disabled" : "")}>
                                <a onClick={this._setHistoryPage.bind(this, false)} aria-label="Previous">
                                    <span aria-hidden="true">&larr; Newer</span>
                                </a>
                            </li>
                            <li className={"next" + (historyIndex >= (history.length - 10) ? " disabled" : "")}>
                                <a onClick={this._setHistoryPage.bind(this, true)} aria-label="Previous">
                                    <span aria-hidden="true">Older &rarr;</span>
                                </a>
                            </li>
                          </ul>
                        </nav>
                    </div>
                </div>
                <div className="row">
                    <div className="col-xs-12" style={{paddingTop: 20, paddingBottom: 20}}>
                        {!priceTop ? priceChart :
                            <DepthChart data={{asks, bids}} />
                        }
                    </div>
                </div>
            </div>

        );
    }
}

App.contextTypes = {
    data: React.PropTypes.object
};

module.exports = App;
