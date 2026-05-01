import React, { useState, useEffect } from 'react';
import client from './api/client';
import { Activity } from 'lucide-react';

function App() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    client.get('/health')
      .then(res => setHealth('Connected to backend ✓'))
      .catch(err => setHealth('Backend offline'));
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100 font-sans">
      {/* Header / Banner */}
      <div className={`p-2 text-center text-sm font-bold text-white ${health === 'Connected to backend ✓' ? 'bg-green-600' : 'bg-red-600'}`}>
        {health || 'Checking backend status...'}
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-1/4 bg-white border-r p-4 shadow-sm">
          <h2 className="text-lg font-semibold flex items-center mb-4">
            <Activity className="mr-2 h-5 w-5 text-blue-500" />
            Alerts
          </h2>
          <div className="text-gray-500 text-sm">Alert list placeholder</div>
        </div>

        {/* Center: Map Placeholder */}
        <div className="flex-1 bg-gray-200 relative p-4 flex items-center justify-center">
          <div className="text-gray-500 font-medium">Map placeholder</div>
        </div>

        {/* Right Drawer Placeholder */}
        <div className="w-1/4 bg-white border-l p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Details</h2>
          <div className="text-gray-500 text-sm">Detail drawer placeholder</div>
        </div>
      </div>
    </div>
  );
}

export default App;
