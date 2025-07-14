import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ReferenceLine, Cell } from 'recharts';

const TradingChart = ({ stockData, symbol }) => {
  if (!stockData || !stockData.prices || stockData.prices.length === 0) {
    return (
      <div className="error">
        <div>📊 Không có dữ liệu biểu đồ cho {symbol}</div>
      </div>
    );
  }

  // Prepare price data
  const priceData = stockData.prices.map(price => ({
    date: new Date(price.Date).toISOString().split('T')[0],
    price: parseFloat(price['Adj Close']),
    fullDate: price.Date
  }));

  // Prepare trade data
  const buyTrades = stockData.trades
    ? stockData.trades.filter(trade => trade.action.toLowerCase() === 'buy')
    : [];
  
  const sellTrades = stockData.trades
    ? stockData.trades.filter(trade => trade.action.toLowerCase() === 'sell')
    : [];

  // Add trade labels (T1, T2, etc.)
  const labeledBuyTrades = buyTrades.map((trade, index) => ({
    ...trade,
    label: `T${index + 1}`
  }));

  // Create combined data for the chart
  const combinedData = priceData.map(pricePoint => {
    const buyTrade = labeledBuyTrades.find(trade => 
      new Date(trade.date).toDateString() === new Date(pricePoint.fullDate).toDateString()
    );
    const sellTrade = sellTrades.find(trade => 
      new Date(trade.date).toDateString() === new Date(pricePoint.fullDate).toDateString()
    );

    return {
      ...pricePoint,
      buyPrice: buyTrade ? buyTrade.price : null,
      sellPrice: sellTrade ? sellTrade.price : null,
      buyLabel: buyTrade ? buyTrade.label : null
    };
  });

  const returnData = sellTrades.map((sellTrade, index) => {
    const correspondingBuy = labeledBuyTrades[index];
    const returnValue = sellTrade.return_pct ? sellTrade.return_pct * 100 : 0; // Convert to percentage
    return {
      label: correspondingBuy ? correspondingBuy.label : `T${index + 1}`,
      return: returnValue,
      returnFormatted: sellTrade.return_pct ? `${returnValue.toFixed(2)}%` : '0%',
      color: returnValue < 0 ? '#FF6B6B' : '#4CAF50' // Match image's red for negative
    };
  });

  const getXAxisTicks = () => {
    const ticks = [];
    const seenMonths = new Set();

    for (let i = 0; i < combinedData.length; i++) {
      const dateObj = new Date(combinedData[i].fullDate);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth();
      const monthYearKey = `${year}-${month}`;

      if (!seenMonths.has(monthYearKey)) {
        seenMonths.add(monthYearKey);

        // Start from Feb 2024 and pick every 3 months
        if ((year > 2024 || (year === 2024 && month >= 1)) && (month - 1) % 3 === 0) {
          ticks.push(combinedData[i].date);  // use `date` field from combinedData (which is locale string)
        }
      }
    }

    return ticks;
  };

  const formatXAxisTick = (value) => {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); // e.g. "Feb 2024"
  };

  // Custom function for dynamic Y-axis ticks for price data with scale of 10
  const getPriceYAxisProps = () => {
    const prices = combinedData.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    const minTick = Math.floor(minPrice / 10) * 10;
    const maxTick = Math.ceil(maxPrice / 10) * 10;
    
    const ticks = [];
    for (let i = minTick; i <= maxTick; i += 10) {
      ticks.push(i);
    }
    
    return {
      domain: [minTick, maxTick],
      ticks: ticks
    };
  };

  const getReturnYAxisProps = () => {
    const returns = returnData.map(d => d.return);
    const minReturn = Math.min(...returns, 0);
    const maxReturn = Math.max(...returns, 0);

    // Find absolute max and round up to nearest 5%
    const absMax = Math.max(Math.abs(minReturn), Math.abs(maxReturn));
    const bound = Math.ceil(absMax / 5) * 5;

    const ticks = [];
    for (let i = -bound; i <= bound; i += 5) {
      ticks.push(i);
    }

    return {
      domain: [-bound, bound],
      ticks: ticks
    };
  };


  // Custom tooltip for price chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip" style={{
          backgroundColor: 'white',
          border: '2px solid #ccc',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          fontSize: '14px'
        }}>
          <p className="label" style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#333' }}>
            Ngày: {label}
          </p>
          <p className="price" style={{ margin: '0 0 8px 0', color: '#2196F3' }}>
            Giá: {data.price.toFixed(2)}
          </p>
          {data.buyPrice && (
            <p className="buy-trade" style={{ margin: '0 0 8px 0', color: '#4CAF50', fontWeight: 'bold' }}>
              {data.buyLabel} - Mua: {data.buyPrice.toFixed(2)}
            </p>
          )}
          {data.sellPrice && (
            <p className="sell-trade" style={{ margin: '0', color: '#FF6B6B', fontWeight: 'bold' }}>
              Bán: {data.sellPrice.toFixed(2)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for return chart
  const ReturnTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip" style={{
          backgroundColor: 'white',
          border: '2px solid #ccc',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          fontSize: '14px'
        }}>
          <p className="label" style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#333' }}>
            Giao dịch: {label}
          </p>
          <p className="return" style={{ margin: '0', color: data.return > 0 ? '#4CAF50' : '#FF6B6B', fontWeight: 'bold' }}>
            Lợi nhuận: {data.returnFormatted}
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom dot with label for buy points
  const CustomBuyDot = (props) => {
    const { cx, cy, payload } = props;
    if (payload.buyPrice) {
      return (
        <g>
          <circle cx={cx} cy={cy} r={6} fill="#4CAF50" stroke="#4CAF50" strokeWidth={2} />
          <text 
            x={cx} 
            y={cy - 12} 
            textAnchor="middle" 
            fontSize="12" 
            fill="#4CAF50" 
            fontWeight="bold"
          >
            {payload.buyLabel}
          </text>
        </g>
      );
    }
    return null;
  };

  // Fixed Custom label for bars with better positioning
  const CustomBarLabel = (props) => {
    const { x, y, width, height, value } = props;
    const isPositive = value >= 0;

    // Ensure enough space below small negative bars
    const minOffset = 16;
    const labelY = isPositive
      ? y - 6
      : y + Math.max(height, minOffset);  // ensures it won’t stick inside the bar

    return (
      <text
        x={x + width / 2}
        y={labelY}
        textAnchor="middle"
        fontSize="12"
        fill={isPositive ? '#4CAF50' : '#FF6B6B'}
        fontWeight="bold"
      >
        {value.toFixed(2)}%
      </text>
    );
  };

  return (
    <div className="trading-chart">
      {/* Price Chart with Buy/Sell Points */}
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={combinedData}>
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12, whiteSpace: 'nowrap' }}
              height={60}
              ticks={getXAxisTicks()}
              tickFormatter={formatXAxisTick}
              interval={0}
            />
            <YAxis 
              tick={{ fontSize: 12, whiteSpace: 'nowrap' }}
              {...getPriceYAxisProps()}
            />
            <Tooltip 
              content={<CustomTooltip />}
              animationDuration={50}
            />
            <Legend />
            
            {/* Price line - solid line */}
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke="#2196F3" 
              strokeWidth={2}
              strokeDasharray="0"
              dot={false}
              name="Giá"
            />
            
            {/* Buy points */}
            <Line 
              type="monotone" 
              dataKey="buyPrice" 
              stroke="#4CAF50" 
              strokeWidth={0}
              dot={<CustomBuyDot />}
              connectNulls={false}
              name="Mua"
            />
            
            {/* Sell points */}
            <Line 
              type="monotone" 
              dataKey="sellPrice" 
              stroke="#FF6B6B" 
              strokeWidth={0}
              dot={{ fill: '#FF6B6B', stroke: '#FF6B6B', strokeWidth: 2, r: 6 }}
              connectNulls={false}
              name="Bán"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Return Chart */}
      {returnData.length > 0 && (
        <div className="chart-container" style={{ marginTop: '2rem' }}>
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={returnData} margin={{ top: 40, right: 30, left: 20, bottom: 60 }}>
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${value}%`}
                {...getReturnYAxisProps()}
              />
              <Tooltip 
                content={<ReturnTooltip />}
                animationDuration={50}
              />
              <ReferenceLine y={0} stroke="#000" strokeWidth={1} />
              <Bar 
                dataKey="return" 
                label={<CustomBarLabel />}
              >
                {returnData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default TradingChart;