import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';



const formatDate = (dateString) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const fetchStockDataForSymbol = async (symbol, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const apiBase = process.env.REACT_APP_API_BASE;
      const response = await axios.get(`${apiBase}/get-symbol-details?symbol=${symbol}`, {
        timeout: 8000
      });
      return response.data;
    } catch (err) {
      console.error(`Attempt ${attempt} failed for ${symbol}:`, err.message);
      
      if (attempt === retries) {
        console.error(`All attempts failed for ${symbol}`);
        return null;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

const processAllTrades = async (trades = []) => {
  const pairs = [];
  const buyMap = {};

  const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));

  for (const trade of sorted) {
    const sym = trade.symbol;
    if (trade.action.toLowerCase() === 'buy') {
      buyMap[sym] = trade;
    } else if (trade.action.toLowerCase() === 'sell' && buyMap[sym]) {
      const buy = buyMap[sym];
      const sell = trade;
      const buyDate = new Date(buy.date);
      const sellDate = new Date(sell.date);
      const daysHeld = Math.ceil((sellDate - buyDate) / (1000 * 60 * 60 * 24));
      const returnPct = sell.return_pct ?? null;

      pairs.push({
        symbol: sym,
        dateRange: `${formatDate(buy.date)} - ${formatDate(sell.date)}`,
        priceRange: `${buy.price?.toFixed(2)} - ${sell.price?.toFixed(2)}`,
        returnPct,
        daysHeld,
        status: 'completed',
        sortDate: sellDate
      });

      delete buyMap[sym];
    }
  }

  // Handle unsold trades - fetch current prices in parallel
  const today = new Date();
  const symbols = Object.keys(buyMap);



  // Fetch all stock data in parallel
  const stockDataMap = {};
  await Promise.all(symbols.map(async (sym) => {
    const data = await fetchStockDataForSymbol(sym); // Now has retries
    stockDataMap[sym] = data;
  }));

  for (const sym of symbols) {
    const buy = buyMap[sym];
    const buyDate = new Date(buy.date);
    const daysHeld = Math.ceil((today - buyDate) / (1000 * 60 * 60 * 24));
    
    const stockData = stockDataMap[sym];
    const latestPriceObj = stockData?.prices?.at(-1) || {};
    const latestPrice = latestPriceObj['Adj Close'] ?? latestPriceObj['adj_close'] ?? null;

    let rawReturn = null;
    if (typeof latestPrice === 'number' && typeof buy.price === 'number') {
      rawReturn = (latestPrice - buy.price) / buy.price;
    }

    pairs.push({
      symbol: sym,
      dateRange: formatDate(buy.date),
      priceRange: buy.price?.toFixed(2),
      returnPct: rawReturn,
      daysHeld,
      status: 'holding',
      sortDate: buyDate
    });
  }


  return pairs.sort((a, b) => {
    if (a.status === 'holding' && b.status !== 'holding') return -1;
    if (a.status !== 'holding' && b.status === 'holding') return 1;
    return b.sortDate - a.sortDate;
  });
};



const HomePage = ({ onSymbolSelect }) => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('recommendations');
  const [tradeHistory, setTradeHistory] = useState([]);


const calculateTradingMetrics = () => {
  if (!tradeHistory || tradeHistory.length === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      avgReturn: 0,
      avgWin: 0,
      avgLoss: 0,
      maxWin: 0,
      maxLoss: 0,
      avgHoldingDays: 0,
      sharpe: 0
    };
  }

  const completedTrades = tradeHistory.filter(trade => trade.status === 'completed');
  const winTrades = completedTrades.filter(trade => trade.returnPct > 0);
  const loseTrades = completedTrades.filter(trade => trade.returnPct <= 0);

  const returns = completedTrades.map(trade => trade.returnPct ?? 0);
  
  if (returns.length === 0) {
    return {
      totalTrades: tradeHistory.length,
      winRate: 0,
      avgReturn: 0,
      avgWin: 0,
      avgLoss: 0,
      maxWin: 0,
      maxLoss: 0,
      avgHoldingDays: 0,
      sharpe: 0
    };
  }

  // CORRECTED SHARPE RATIO CALCULATION (rf = 0)
  const annualizedReturns = returns.map((ret, index) => {
    const daysHeld = completedTrades[index].daysHeld || 1;
    return Math.pow(1 + ret, 252 / daysHeld) - 1;
  });
  
  const avgAnnualizedReturn = annualizedReturns.reduce((a, b) => a + b, 0) / annualizedReturns.length;
  const variance = annualizedReturns.reduce((sum, r) => sum + Math.pow(r - avgAnnualizedReturn, 2), 0) / annualizedReturns.length;
  const stdDev = Math.sqrt(variance);
  
  const sharpeRatio = stdDev !== 0 ? avgAnnualizedReturn / stdDev : 0;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const avgHoldingDays = completedTrades.reduce((sum, trade) => sum + (trade.daysHeld || 0), 0) / completedTrades.length;

  return {
    totalTrades: tradeHistory.length,
    winRate: completedTrades.length > 0 ? (winTrades.length / completedTrades.length) * 100 : 0,
    avgReturn: mean * 100,
    avgWin: winTrades.length > 0 ? (winTrades.reduce((sum, t) => sum + (t.returnPct || 0), 0) / winTrades.length) * 100 : 0,
    avgLoss: loseTrades.length > 0 ? (loseTrades.reduce((sum, t) => sum + (t.returnPct || 0), 0) / loseTrades.length) * 100 : 0,
    maxWin: Math.max(...returns, 0) * 100,
    maxLoss: Math.min(...returns, 0) * 100,
    avgHoldingDays: avgHoldingDays,
    sharpe: sharpeRatio
  };
};

  const fetchLatestBuys = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Hardcoded dev API
      const apiBase = process.env.REACT_APP_API_BASE;
      const response = await axios.get(`${apiBase}/fetch-latest-buys`, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 30000,
      });


      const data = response.data;

      if (!Array.isArray(data)) throw new Error('API response is not an array');

      const buyPositions = data.filter(stock => stock.action?.toLowerCase() === 'buy');

      const sortedStocks = buyPositions.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateB - dateA !== 0) return dateB - dateA;
        return (b.signal_strength || 0) - (a.signal_strength || 0);
      });

      setStocks(sortedStocks);
    } catch (err) {
      console.error('Error:', err);
      let errorMessage = 'Failed to fetch stock data. Please try again.';
      if (err.response) {
        errorMessage = `Server error: ${err.response.status} ${err.response.statusText}`;
      } else if (err.request) {
        errorMessage = 'Network error: No response from server.';
      } else if (err.message.includes('timeout')) {
        errorMessage = 'Request timeout. Please try again.';
      } else {
        errorMessage = `Error: ${err.message}`;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'recommendations') {
      fetchLatestBuys();
    } else {
      axios
        .get(`${process.env.REACT_APP_API_BASE}/fetch_trades_history`) // Updated line
        .then(async (res) => {
          const trades = Array.isArray(res.data) ? res.data : res.data?.trades || [];
          const processedTrades = await processAllTrades(trades);
          setTradeHistory(processedTrades);
        })
        .catch(err => {
          console.error("Failed to fetch trade history", err);
          setTradeHistory([]);
        });
    }
  }, [activeTab, fetchLatestBuys]);



  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="text-xl text-red-600 mb-4">❌ {error}</div>
          <button onClick={fetchLatestBuys} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="homepage-container">
      <div className="sidebar">
        <button className={activeTab === 'recommendations' ? 'active' : ''} onClick={() => setActiveTab('recommendations')}>
          Khuyến nghị trading
        </button>
        <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>
          Lịch sử trading
        </button>
      </div>

      <div className="main-view">
        {activeTab === 'recommendations' ? (
          <>
            {stocks.length === 0 ? (
              <div className="text-center text-xl text-gray-600">Hiện tại không có khuyến nghị nào</div>
            ) : (
              <div className="max-w-6xl mx-auto">
                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="stock-table">
                      <thead>
                        <tr>
                          <th>Mã CK</th>
                          <th>Ngày</th>
                          <th>Giá</th>
                          <th>Tín hiệu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stocks.map((stock, index) => (
                          <tr key={`${stock.symbol}-${index}`}>
                            <td>
                              <button className="stock-symbol" onClick={() => onSymbolSelect(stock.symbol)}>
                                {stock.symbol}
                              </button>
                            </td>
                            <td>{formatDate(stock.date)}</td>
                            <td>{stock.price?.toFixed(2) || 'N/A'}</td>
                            <td>
                              <span className={`signal-strength ${
                                stock.signal_strength >= 0.07 ? 'signal-high' :
                                stock.signal_strength >= 0.06 ? 'signal-medium' :
                                stock.signal_strength >= 0.05 ? 'signal-low' : 'signal-default'
                              }`}>
                                {stock.signal_strength?.toFixed(4) || 'N/A'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="metrics-container" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gridTemplateRows: 'repeat(2, 1fr)',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              <div className="metric-card"><div className="metric-label">Số giao dịch</div><div className="metric-value">{calculateTradingMetrics().totalTrades}</div></div>
              <div className="metric-card"><div className="metric-label">Tỷ lệ thắng</div><div className="metric-value">{calculateTradingMetrics().winRate.toFixed(1)}%</div></div>
              <div className="metric-card"><div className="metric-label">Lãi trung bình</div><div className="metric-value">{calculateTradingMetrics().avgWin.toFixed(2)}%</div></div>
              <div className="metric-card"><div className="metric-label">Lỗ trung bình</div><div className="metric-value">{calculateTradingMetrics().avgLoss.toFixed(2)}%</div></div>
              <div className="metric-card"><div className="metric-label">Lãi lớn nhất</div><div className="metric-value">{calculateTradingMetrics().maxWin.toFixed(2)}%</div></div>
              <div className="metric-card"><div className="metric-label">Lỗ lớn nhất</div><div className="metric-value">{calculateTradingMetrics().maxLoss.toFixed(2)}%</div></div>
              <div className="metric-card"><div className="metric-label">Số ngày nắm giữ TB</div><div className="metric-value">{calculateTradingMetrics().avgHoldingDays.toFixed(1)} ngày</div></div>
              <div className="metric-card"><div className="metric-label">Sharpe Ratio</div><div className="metric-value">{calculateTradingMetrics().sharpe.toFixed(2)}</div></div>
            </div>
            <div className="max-w-6xl mx-auto overflow-x-auto" style={{marginTop: '2rem'}}>
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Mã CK</th>
                    <th>Ngày</th>
                    <th>Giá</th>
                    <th>% Lợi nhuận</th>
                    <th>Ngày nắm giữ</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeHistory.map((pair, index) => (
                    <tr key={index} className={pair.status === 'holding' ? 'open-trade-row' : ''}>
                      <td>{pair.symbol}</td>
                      <td>{pair.dateRange}</td>
                      <td>{pair.priceRange}</td>
                      <td style={{
                        color: pair.returnPct === null ? '#666' :
                              pair.returnPct > 0 ? '#4CAF50' : '#FF6B6B',
                        fontWeight: 'bold'
                      }}>
                        {pair.returnPct !== null ? (pair.returnPct * 100).toFixed(2) + '%' : '_'}
                      </td>
                      <td>{pair.daysHeld} ngày</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HomePage;