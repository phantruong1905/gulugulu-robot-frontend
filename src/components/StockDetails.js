import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import TradingChart from './TradingChart';

const StockDetails = ({ symbol, onBack }) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Use useCallback to memoize the function
  const fetchStockDetails = useCallback(async () => {
    try {
      setLoading(true);
      // Using relative URL with proxy
      const apiBase = "https://qgfhaujnqa.execute-api.ap-southeast-2.amazonaws.com";
      const response = await axios.get(`${apiBase}/get-symbol-details?symbol=${symbol}`);
      setStockData(response.data);
      console.log("Fetched stockData.prices:", response.data.prices?.at(-1));
      setError(null);
    } catch (err) {
      setError('Failed to fetch stock details. Please try again.');
      console.error('Error fetching stock details:', err);
    } finally {
      setLoading(false);
    }
  }, [symbol]); // Only depends on symbol

  useEffect(() => {
    fetchStockDetails();
  }, [fetchStockDetails]); // Now we can safely include fetchStockDetails

  const calculateTradingMetrics = () => {
    if (!stockData?.trades || stockData.trades.length === 0) {
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

    const buyTrades = stockData.trades.filter(trade => trade.action.toLowerCase() === 'buy');
    const sellTrades = stockData.trades.filter(trade => trade.action.toLowerCase() === 'sell');
    const winTrades = sellTrades.filter(trade => trade.profit_loss > 0);
    const loseTrades = sellTrades.filter(trade => trade.profit_loss <= 0);

    const returns = sellTrades.map(trade => trade.return_pct ?? 0);
    
    if (returns.length === 0) {
      return {
        totalTrades: buyTrades.length,
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
    // Method 1: Individual trade annualization
    const annualizedReturns = returns.map((ret, index) => {
      const daysHeld = sellTrades[index].days_held || 1;
      return Math.pow(1 + ret, 252 / daysHeld) - 1;
    });
    
    // Calculate mean and standard deviation of annualized returns
    const avgAnnualizedReturn = annualizedReturns.reduce((a, b) => a + b, 0) / annualizedReturns.length;
    const variance = annualizedReturns.reduce((sum, r) => sum + Math.pow(r - avgAnnualizedReturn, 2), 0) / annualizedReturns.length;
    const stdDev = Math.sqrt(variance);
    
    // Sharpe ratio (with rf = 0, this is just return/volatility)
    const sharpeRatio = stdDev !== 0 ? avgAnnualizedReturn / stdDev : 0;

    // Calculate other metrics using original returns
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const avgHoldingDays = sellTrades.reduce((sum, trade) => sum + (trade.days_held || 0), 0) / sellTrades.length;

    return {
      totalTrades: buyTrades.length,
      winRate: sellTrades.length > 0 ? (winTrades.length / sellTrades.length) * 100 : 0,
      avgReturn: mean * 100,
      avgWin: winTrades.length > 0 ? (winTrades.reduce((sum, t) => sum + (t.return_pct || 0), 0) / winTrades.length) * 100 : 0,
      avgLoss: loseTrades.length > 0 ? (loseTrades.reduce((sum, t) => sum + (t.return_pct || 0), 0) / loseTrades.length) * 100 : 0,
      maxWin: Math.max(...returns, 0) * 100,
      maxLoss: Math.min(...returns, 0) * 100,
      avgHoldingDays: avgHoldingDays,
      sharpe: sharpeRatio
    };
  };


  const getLatestPredictions = () => {
    if (!stockData?.predictions || stockData.predictions.length === 0) {
      return [];
    }

    const latest = stockData.predictions[stockData.predictions.length - 1];
    return [1, 2, 3, 4, 5].map(i => latest[`y_pred_${i}`]).filter(pred => pred !== undefined);
  };

  const formatDateDDMMYYYY = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const processTradePairs = () => {
    if (!stockData?.trades || stockData.trades.length === 0) {
      return [];
    }

    const trades = [...stockData.trades].sort((a, b) => new Date(a.date) - new Date(b.date));
    const pairs = [];
    let buyTrade = null;

    trades.forEach(trade => {
      if (trade.action.toLowerCase() === 'buy') {
        buyTrade = trade;
      } else if (trade.action.toLowerCase() === 'sell' && buyTrade) {
        // Complete pair
        const buyDate = new Date(buyTrade.date);
        const sellDate = new Date(trade.date);
        const daysHeld = Math.ceil((sellDate - buyDate) / (1000 * 60 * 60 * 24));
        
        const rawReturn = trade.return_pct ?? null;

        pairs.push({
          dateRange: `${formatDateDDMMYYYY(buyTrade.date)} - ${formatDateDDMMYYYY(trade.date)}`,
          priceRange: `${buyTrade.price?.toFixed(2) || '_'} - ${trade.price?.toFixed(2) || '_'}`,
          returnPct: typeof rawReturn === 'number'
            ? `${(rawReturn * 100).toFixed(2)}%`
            : (trade.return_pct === 'N/A' ? 'N/A' : '_'),
          rawReturnPct: rawReturn, // ✅ added here
          daysHeld: daysHeld,
          status: 'completed',
          sortDate: sellDate
        });

        buyTrade = null;
      }
    });

    // Handle unsold buy trade
    if (buyTrade) {
      const buyDate = new Date(buyTrade.date);
      const today = new Date();
      const daysHeld = Math.ceil((today - buyDate) / (1000 * 60 * 60 * 24));

      const latestPriceObj = stockData?.prices?.at(-1) || {};
      const latestPrice = latestPriceObj['Adj Close'] ?? latestPriceObj['adj_close'] ?? null;

      let rawReturn = null;
      let returnPct = '_';

      if (typeof buyTrade.price === 'number' && typeof latestPrice === 'number') {
        rawReturn = (latestPrice - buyTrade.price) / buyTrade.price;
        returnPct = `${(rawReturn * 100).toFixed(2)}%`;
      }

      pairs.push({
        dateRange: formatDateDDMMYYYY(buyTrade.date),
        priceRange: buyTrade.price?.toFixed(2) || '_',
        returnPct: returnPct,
        rawReturnPct: rawReturn, // ✅ added here
        daysHeld: daysHeld,
        status: 'holding',
        sortDate: buyDate
      });


    }



    // Sort by date descending (latest first)
    return pairs.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));
  };

  const tabs = [
    { id: 'summary', label: 'Dashboard' },
    { id: 'trades', label: 'Lịch sử giao dịch' },
    { id: 'predictions', label: '_' }
  ];



  if (loading) {
    return (
      <div className="stock-details">
        <button onClick={onBack} className="back-button">
          ← Quay lại
        </button>
        <div className="loading">
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stock-details">
        <button onClick={onBack} className="back-button">
          ← Quay lại
        </button>
        <div className="error">
          <div>❌ {error}</div>
          <button onClick={fetchStockDetails} className="back-button" style={{marginTop: '1rem'}}>
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  const metrics = calculateTradingMetrics();
  const predictions = getLatestPredictions();

  return (
    <div className="stock-details">
      <button onClick={onBack} className="back-button">
        ← Quay lại
      </button>

      <h2 className="page-title">Chi tiết giao dịch: {symbol}</h2>

      {/* Tabs */}
      <div className="tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'summary' && (
          <div>
            <div className="metrics-container">
              <div className="metric-card"><div className="metric-label">Số giao dịch</div><div className="metric-value">{metrics.totalTrades}</div></div>
              <div className="metric-card"><div className="metric-label">Tỷ lệ thắng</div><div className="metric-value">{metrics.winRate.toFixed(1)}%</div></div>
              <div className="metric-card"><div className="metric-label">Lãi trung bình</div><div className="metric-value">{metrics.avgWin.toFixed(2)}%</div></div>
              <div className="metric-card"><div className="metric-label">Lỗ trung bình</div><div className="metric-value">{metrics.avgLoss.toFixed(2)}%</div></div>
              <div className="metric-card"><div className="metric-label">Lãi lớn nhất</div><div className="metric-value">{metrics.maxWin.toFixed(2)}%</div></div>
              <div className="metric-card"><div className="metric-label">Lỗ lớn nhất</div><div className="metric-value">{metrics.maxLoss.toFixed(2)}%</div></div>
              <div className="metric-card"><div className="metric-label">Số ngày nắm giữ TB</div><div className="metric-value">{metrics.avgHoldingDays.toFixed(1)} ngày</div></div>
              <div className="metric-card"><div className="metric-label">Sharpe Ratio</div><div className="metric-value">{metrics.sharpe.toFixed(2)}</div></div>
            </div>


            <div style={{ marginTop: '2rem' }}>
              <TradingChart stockData={stockData} symbol={symbol} />
            </div>
          </div>
        )}


        {activeTab === 'predictions' && (
          <div>
            {predictions.length > 0 ? (
              <div style={{ 
                textAlign: 'center',
                padding: '2rem'
              }}>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: '#4CAF50'
                }}>
                  {`{${predictions.map(pred => pred.toFixed(4)).join(', ')}}`}
                </div>
              </div>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '2rem', 
                color: '#FF6B6B' 
              }}>
                Không có dữ liệu dự đoán
              </div>
            )}
          </div>
        )}

        {activeTab === 'trades' && (
          <div>
            {stockData?.trades && stockData.trades.length > 0 ? (
              <div style={{overflowX: 'auto'}}>
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Giá</th>
                      <th>% Lợi nhuận</th>
                      <th>Ngày nắm giữ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processTradePairs().map((pair, index) => (
                      <tr key={index}>
                        <td>{pair.dateRange}</td>
                        <td>{pair.priceRange}</td>
                        <td style={{
                          color: pair.rawReturnPct === null ? '#666' :
                                pair.rawReturnPct > 0 ? '#4CAF50' : '#FF6B6B',
                          fontWeight: 'bold'
                        }}>
                          {pair.returnPct}
                        </td>
                        <td>{pair.daysHeld} ngày</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="error">Không có dữ liệu giao dịch</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StockDetails;