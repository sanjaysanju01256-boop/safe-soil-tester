import React, { useState, useEffect, useRef, useCallback } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { getAiAdvice } from './services/geminiService';
import { SensorData, Theme, ControlName, Controls, HistoryRecord } from './types';
import { 
    PhIcon, MoistureIcon, TemperatureIcon, BatteryIcon, BluetoothIcon, BluetoothConnectedIcon, 
    BluetoothOffIcon, SparklesIcon, SpeakerIcon, SunIcon, MoonIcon, DownloadIcon,
    PumpIcon, FanIcon, LightbulbIcon
} from './components/icons';
import LineChart from './components/LineChart';

const SENSOR_HISTORY_LENGTH = 30; // Number of points to show on the chart
const VOICE_ALERT_COOLDOWN = 30000; // 30 seconds
const SIMULATION_INTERVAL = 2000; // 2 seconds

// --- Main App Component ---
const App: React.FC = () => {
    const [theme, setTheme] = useLocalStorage<Theme>('theme', 'light');
    const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [sensorData, setSensorData] = useState<SensorData | null>(null);
    const [controls, setControls] = useState<Controls>({ pump: false, fan: false, light: false });
    const [history, setHistory] = useState<HistoryRecord[]>([]);
    
    const deviceRef = useRef<BluetoothDevice | null>(null);
    const simulationIntervalRef = useRef<number | null>(null);
    const lastAlertTimestamp = useRef<Record<string, number>>({});

    // --- Effects ---
    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [theme]);
    
    useEffect(() => {
        if (connectionStatus === 'disconnected' && !simulationIntervalRef.current) {
            // Start simulation if not connected
            simulationIntervalRef.current = window.setInterval(generateSimulatedData, SIMULATION_INTERVAL);
        } else if (connectionStatus === 'connected' && simulationIntervalRef.current) {
            // Stop simulation if connected
            clearInterval(simulationIntervalRef.current);
            simulationIntervalRef.current = null;
        }
        return () => {
            if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
        };
    }, [connectionStatus]);

    useEffect(() => {
        if (sensorData) {
            const newRecord: HistoryRecord = { timestamp: Date.now(), data: sensorData };
            setHistory(prev => [newRecord, ...prev].slice(0, 10)); // Keep last 10 for table
            
            // Voice Alerts Logic
            checkThresholdAndAlert(sensorData.moisture, 30, 'low', 'మట్టి తేమ తక్కువగా ఉంది. దయచేసి నీళ్ళు పెట్టండి.');
            checkThresholdAndAlert(sensorData.ph, 5.5, 'low', 'నేల pH తక్కువగా ఉంది.');
            checkThresholdAndAlert(sensorData.ph, 7.5, 'high', 'నేల pH ఎక్కువగా ఉంది.');
        }
    }, [sensorData]);

    // --- Core Functions ---
    const generateSimulatedData = () => {
        setSensorData({
            ph: 6.5 + Math.sin(Date.now() / 20000) * 0.5,
            moisture: 60 + Math.sin(Date.now() / 15000) * 20,
            temperature: 25 + Math.sin(Date.now() / 30000) * 5,
            battery: 85 - (Date.now() % 10000) / 1000,
        });
    };
    
    const speak = (text: string) => {
        if (!('speechSynthesis' in window)) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'te-IN';
        window.speechSynthesis.speak(utterance);
    };

    const checkThresholdAndAlert = (value: number, threshold: number, type: 'low' | 'high', message: string) => {
        const now = Date.now();
        const lastAlert = lastAlertTimestamp.current[message] || 0;
        if (now - lastAlert < VOICE_ALERT_COOLDOWN) return;

        if ((type === 'low' && value < threshold) || (type === 'high' && value > threshold)) {
            speak(message);
            lastAlertTimestamp.current[message] = now;
        }
    };
    
    const handleConnect = useCallback(async () => {
        if (!navigator.bluetooth) return alert("Web Bluetooth is not available.");
        setConnectionStatus('connecting');
        try {
            const device = await navigator.bluetooth.requestDevice({ filters: [{ name: 'SOIL-ESP32' }] });
            if (!device) { setConnectionStatus('disconnected'); return; }
            deviceRef.current = device;
            await device.gatt?.connect(); // Real connection logic would go here
            setConnectionStatus('connected');
            device.addEventListener('gattserverdisconnected', () => setConnectionStatus('disconnected'));
        } catch (err) {
            console.error("Bluetooth connection failed:", err);
            setConnectionStatus('disconnected');
        }
    }, []);

    const handleDisconnect = () => {
        deviceRef.current?.gatt?.disconnect();
        setConnectionStatus('disconnected');
    };
    
    const toggleControl = (name: ControlName) => {
        const newState = !controls[name];
        setControls(prev => ({ ...prev, [name]: newState }));
        // In a real app, send command via Bluetooth:
        // const command = `${name}:${newState ? 'on' : 'off'}`;
        // characteristic.writeValue(new TextEncoder().encode(command));
    };

    const exportCsv = () => {
        const headers = "Timestamp,pH,Moisture (%),Temperature (°C),Battery (%)\n";
        const rows = history.map(h => 
            `${new Date(h.timestamp).toISOString()},${h.data.ph.toFixed(2)},${h.data.moisture.toFixed(2)},${h.data.temperature.toFixed(2)},${h.data.battery.toFixed(2)}`
        ).join("\n");
        const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `soil_data_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans transition-colors duration-300">
            <main className="container mx-auto p-4 space-y-4">
                <Header 
                    status={connectionStatus}
                    onConnect={handleConnect}
                    onDisconnect={handleDisconnect}
                    theme={theme}
                    onThemeToggle={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <SensorCard icon={<MoistureIcon />} value={sensorData?.moisture} unit="%" label="Moisture" thresholds={{ low: 30, high: 80 }} />
                    <SensorCard icon={<PhIcon />} value={sensorData?.ph} unit="" label="pH Level" thresholds={{ low: 5.5, high: 7.5 }} />
                    <SensorCard icon={<TemperatureIcon />} value={sensorData?.temperature} unit="°C" label="Temperature" thresholds={{ low: 10, high: 35 }} />
                    <SensorCard icon={<BatteryIcon />} value={sensorData?.battery} unit="%" label="Device Battery" />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                         <Card>
                            <h3 className="font-bold mb-2">Sensor Data Over Time</h3>
                             <LineChart history={history} sensorHistoryLength={SENSOR_HISTORY_LENGTH} />
                        </Card>
                    </div>
                    <Card>
                        <h3 className="font-bold mb-4">Device Controls</h3>
                        <div className="space-y-3">
                            <ControlToggle icon={<PumpIcon />} label="Water Pump" name="pump" isOn={controls.pump} onToggle={toggleControl} />
                            <ControlToggle icon={<FanIcon />} label="Ventilation Fan" name="fan" isOn={controls.fan} onToggle={toggleControl} />
                            <ControlToggle icon={<LightbulbIcon />} label="Grow Light" name="light" isOn={controls.light} onToggle={toggleControl} />
                        </div>
                    </Card>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <AiCard currentData={sensorData} />
                    <HistoryCard history={history} onExport={exportCsv} />
                </div>
            </main>
        </div>
    );
};

// --- Sub-Components ---

const Card: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
    <div className={`bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg rounded-xl shadow-md p-4 border border-white/20 dark:border-gray-700/50 ${className}`}>
        {children}
    </div>
);

const Header: React.FC<{ status: string, onConnect: () => void, onDisconnect: () => void, theme: Theme, onThemeToggle: () => void }> = ({ status, onConnect, onDisconnect, theme, onThemeToggle }) => {
    const isConnected = status === 'connected';
    return (
        <Card className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-green-600 dark:text-green-400">Smart Soil Dashboard</h1>
            <div className="flex items-center space-x-2">
                <button onClick={onThemeToggle} className="p-2 rounded-full bg-gray-200 dark:bg-gray-700">
                    {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
                </button>
                {isConnected ? (
                     <button onClick={onDisconnect} className="flex items-center bg-red-500 text-white font-bold py-2 px-3 rounded-lg hover:bg-red-600 transition">
                        <BluetoothOffIcon className="w-5 h-5 mr-1" /> Disconnect
                    </button>
                ) : (
                    <button onClick={onConnect} disabled={status === 'connecting'} className="flex items-center bg-blue-500 text-white font-bold py-2 px-3 rounded-lg hover:bg-blue-600 disabled:bg-blue-300 transition">
                        <BluetoothIcon className="w-5 h-5 mr-1" /> {status === 'connecting' ? 'Connecting...' : 'Connect'}
                    </button>
                )}
            </div>
        </Card>
    );
};

const SensorCard: React.FC<{ icon: React.ReactElement, value?: number, unit: string, label: string, thresholds?: { low: number, high: number } }> = ({ icon, value, unit, label, thresholds }) => {
    let status = 'Normal';
    let statusColor = 'text-green-500';
    let pulse = false;

    if (thresholds && value !== undefined) {
        if (value < thresholds.low) {
            status = 'Low';
            statusColor = 'text-yellow-500';
            pulse = true;
        } else if (value > thresholds.high) {
            status = 'High';
            statusColor = 'text-red-500';
            pulse = true;
        }
    }
    
    return (
        <Card className="text-center">
            {/* Fix: Cast icon to a more specific type to allow className prop in React.cloneElement */}
            <div className="flex justify-center items-center text-gray-500 dark:text-gray-400 h-8">{React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-7 h-7" })}</div>
            <p className="text-4xl font-bold mt-2">{value?.toFixed(label.includes('pH') ? 1 : 0) ?? '--'}<span className="text-2xl ml-1">{unit}</span></p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
            {thresholds && <p className={`text-sm font-bold ${statusColor} ${pulse ? 'animate-pulse' : ''}`}>{status}</p>}
        </Card>
    );
};

const ControlToggle: React.FC<{ icon: React.ReactElement, label: string, name: ControlName, isOn: boolean, onToggle: (name: ControlName) => void }> = ({ icon, label, name, isOn, onToggle }) => (
    <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700/50 p-2 rounded-lg">
        <div className="flex items-center">
            {/* Fix: Cast icon to a more specific type to allow className prop in React.cloneElement */}
            {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-6 h-6 mr-3 text-gray-600 dark:text-gray-300" })}
            <span className="font-medium">{label}</span>
        </div>
        <button onClick={() => onToggle(name)} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${isOn ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isOn ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    </div>
);

const AiCard: React.FC<{ currentData: SensorData | null }> = ({ currentData }) => {
    const [question, setQuestion] = useState('');
    const [response, setResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleAsk = async () => {
        if (!question || !currentData) return;
        setIsLoading(true);
        setResponse('');
        try {
            const advice = await getAiAdvice(currentData, question);
            setResponse(advice);
        } catch (error) {
            setResponse('Sorry, I could not get advice right now.');
            console.error(error);
        }
        setIsLoading(false);
    };
    
    return (
        <Card>
            <h3 className="font-bold mb-2 flex items-center"><SparklesIcon className="w-5 h-5 mr-2 text-purple-500"/>AI Agronomist</h3>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g., Is this good for paddy?"
                    className="flex-grow p-2 border bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
                <button onClick={handleAsk} disabled={isLoading || !question} className="bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700 disabled:bg-purple-400 transition">
                    {isLoading ? 'Thinking...' : 'Ask'}
                </button>
            </div>
            {response && (
                <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                    <p>{response}</p>
                </div>
            )}
        </Card>
    );
};

const HistoryCard: React.FC<{ history: HistoryRecord[], onExport: () => void }> = ({ history, onExport }) => (
    <Card>
        <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold">Recent Readings</h3>
            <button onClick={onExport} className="flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline">
                <DownloadIcon className="w-4 h-4 mr-1" /> Export CSV
            </button>
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400">
            <div className="grid grid-cols-4 font-bold border-b border-gray-200 dark:border-gray-700 pb-1">
                <span>Time</span><span className="text-center">pH</span><span className="text-center">Moisture</span><span className="text-center">Temp</span>
            </div>
            <div className="space-y-1 mt-1 max-h-40 overflow-y-auto">
                {history.map(h => (
                    <div key={h.timestamp} className="grid grid-cols-4">
                        <span>{new Date(h.timestamp).toLocaleTimeString()}</span>
                        <span className="text-center">{h.data.ph.toFixed(1)}</span>
                        <span className="text-center">{h.data.moisture.toFixed(0)}%</span>
                        <span className="text-center">{h.data.temperature.toFixed(0)}°C</span>
                    </div>
                ))}
            </div>
        </div>
    </Card>
);

export default App;