import React, { useState } from 'react';
import './App.css';
import HomePage from './components/HomePage';
import StockDetails from './components/StockDetails';
import logo from './logo.png';

function App() {
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [searchSymbol, setSearchSymbol] = useState('');

  const handleSymbolSelect = (symbol) => {
    setSelectedSymbol(symbol);
  };

  const handleBackToHome = () => {
    setSelectedSymbol(null);
    setSearchSymbol('');
  };

  const handleSearch = (symbol) => {
    if (symbol) {
      setSearchSymbol(symbol);
      setSelectedSymbol(symbol);
    }
  };

  return (
    <div className="App">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section" onClick={handleBackToHome}>
            <img src={logo} alt="Robot Gulugulu" className="logo" />
            <h1>ROBOT GULUGULU 1.5</h1>
          </div>

          <div className="search-section">
            <input
              type="text"
              placeholder="Tìm kiếm mã chứng khoán"
              className="search-input"
              value={searchSymbol}
              onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch(searchSymbol);
                }
              }}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {selectedSymbol ? (
          <StockDetails 
            symbol={selectedSymbol} 
            onBack={handleBackToHome}
          />
        ) : (
          <HomePage onSymbolSelect={handleSymbolSelect} />
        )}
      </main>
    </div>
  );
}

export default App;
