import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { 
  Wallet, 
  TrendingUp, 
  Settings, 
  Play, 
  Pause, 
  History,
  AlertCircle,
  CheckCircle,
  XCircle,
  Activity,
  Wifi,
  WifiOff
} from 'lucide-react';

interface Balance {
  balance: number;
  id: string;
}

interface Bet {
  id: number;
  amount: number;
  color: string;
  status: string;
  result: string;
  profit: number;
  created_at: string;
}

interface Stats {
  total_bets: number;
  wins: number;
  losses: number;
  total_profit: number;
  avg_bet_amount: number;
}

interface BlazeResult {
  id: string;
  color: string;
  roll: number;
  created_at: string;
}

interface BlazeState {
  status: string;
  color: string | null;
  roll: number | null;
  id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface AutoBettingConfig {
  bet_amount: number;
  profit_target: number;
  stop_loss: number;
  min_confidence: number;
  strategy: string;
}

interface AutoBettingStats {
  status: string;
  dailyProfit: number;
  totalBets: number;
  wins: number;
  losses: number;
  winRate: string;
  consecutiveLosses: number;
  profitPercent: string;
  targetProgress: string;
  stopLossProgress: string;
}

const UserDashboard: React.FC = () => {
  const { user, token } = useAuth();
  const { socket } = useSocket();
  
  const [balance, setBalance] = useState<Balance | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Estados do monitor da Blaze
  const [blazeResults, setBlazeResults] = useState<BlazeResult[]>([]);
  const [blazeState, setBlazeState] = useState<BlazeState>({
    status: 'disconnected',
    color: null,
    roll: null,
    id: null,
    created_at: null,
    updated_at: null
  });
  const [blazeConnected, setBlazeConnected] = useState(false);
  
  // Estados para configuração
  const [showConfig, setShowConfig] = useState(false);
  const [tokens, setTokens] = useState({
    accessToken: '',
    refreshToken: ''
  });
  
  // Estados para apostas
  const [isBotActive, setIsBotActive] = useState(false);
  
  // Estados para apostas automáticas
  const [autoBettingConfig, setAutoBettingConfig] = useState<AutoBettingConfig>({
    bet_amount: 1.0,
    profit_target: 30,
    stop_loss: 100,
    min_confidence: 0.6,
    strategy: 'intelligent_analysis'
  });
  const [autoBettingStats, setAutoBettingStats] = useState<AutoBettingStats | null>(null);
  const [isAutoBettingActive, setIsAutoBettingActive] = useState(false);

  useEffect(() => {
    loadUserData();
    loadBlazeResults();
    loadAutoBettingStatus();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('bot-initialized', (data) => {
        setSuccess('Bot inicializado com sucesso!');
        setBalance(data.balance);
        setIsBotActive(true);
        setShowConfig(false);
      });

      socket.on('bet-placed', (data) => {
        setSuccess('Aposta realizada com sucesso!');
        loadUserData();
      });

      // Eventos do monitor da Blaze
      socket.on('blaze-monitor-status', (data) => {
        setBlazeConnected(data.status === 'connected');
      });

      socket.on('blaze-new-result', (result) => {
        setBlazeResults(prev => [result, ...prev.slice(0, 19)]);
      });

      socket.on('blaze-state-change', (state) => {
        setBlazeState(state);
      });

      socket.on('auto-betting-toggled', (data) => {
        if (data.success) {
          setSuccess(data.message);
          loadAutoBettingStatus();
        }
      });

      socket.on('auto-bet-placed', (data) => {
        setSuccess(`Aposta automática: ${data.color} - R$ ${data.amount.toFixed(2)} (${(data.confidence * 100).toFixed(1)}% confiança)`);
        loadUserData();
        loadAutoBettingStatus();
      });

      return () => {
        socket.off('bot-initialized');
        socket.off('bet-placed');
        socket.off('blaze-monitor-status');
        socket.off('blaze-new-result');
        socket.off('blaze-state-change');
        socket.off('auto-betting-toggled');
        socket.off('auto-bet-placed');
      };
    }
  }, [socket]);

  const loadUserData = async () => {
    try {
      // Carregar saldo
      const balanceResponse = await fetch('/api/protected/bot/balance', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const balanceData = await balanceResponse.json();
      if (balanceData.success) {
        setBalance(balanceData.balance);
        setIsBotActive(true);
      }

      // Carregar apostas
      const betsResponse = await fetch('/api/protected/bets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const betsData = await betsResponse.json();
      if (betsData.success) {
        setBets(betsData.bets);
      }

      // Carregar estatísticas
      const statsResponse = await fetch('/api/protected/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statsData = await statsResponse.json();
      if (statsData.success) {
        setStats(statsData.stats);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const loadBlazeResults = async () => {
    try {
      const response = await fetch('/api/protected/blaze/last-results?limit=20', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setBlazeResults(data.results);
      }
    } catch (error) {
      console.error('Erro ao carregar resultados da Blaze:', error);
    }
  };

  const loadAutoBettingStatus = async () => {
    try {
      const response = await fetch('/api/protected/bot/auto-betting/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success && data.stats) {
        setAutoBettingStats(data.stats);
        setIsAutoBettingActive(data.stats.status === 'active' || data.stats.status === 'paused_until_tomorrow');
      } else {
        setAutoBettingStats(null);
        setIsAutoBettingActive(false);
      }
    } catch (error) {
      console.error('Erro ao carregar status de apostas automáticas:', error);
    }
  };

  const initializeBot = async () => {
    if (!tokens.accessToken || !tokens.refreshToken) {
      setError('Access Token e Refresh Token são obrigatórios');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/protected/bot/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(tokens)
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess('Bot inicializado com sucesso!');
        setBalance(data.balance);
        setIsBotActive(true);
        setShowConfig(false);
        setTokens({ accessToken: '', refreshToken: '' });
      } else {
        setError(data.error || 'Erro ao inicializar bot');
      }
    } catch (error) {
      setError('Erro de conexão');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAutoBetting = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/protected/bot/auto-betting/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ config: autoBettingConfig })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message);
        loadAutoBettingStatus();
      } else {
        setError(data.error || 'Erro ao alterar apostas automáticas');
      }
    } catch (error) {
      setError('Erro de conexão');
    } finally {
      setIsLoading(false);
    }
  };

  const getColorClass = (color: string) => {
    switch (color) {
      case 'vermelho': return 'bg-red-500';
      case 'preto': return 'bg-gray-800';
      case 'branco': return 'bg-white border border-gray-300';
      default: return 'bg-gray-500';
    }
  };

  const getBlazeColorClass = (color: string) => {
    switch (color) {
      case 'red': return 'bg-red-500';
      case 'black': return 'bg-gray-800';
      case 'white': return 'bg-white border border-gray-300';
      default: return 'bg-gray-500';
    }
  };

  const getBlazeColorName = (color: string) => {
    switch (color) {
      case 'red': return 'Vermelho';
      case 'black': return 'Preto';
      case 'white': return 'Branco';
      default: return color;
    }
  };

  const getBlazeStatusText = (status: string) => {
    switch (status) {
      case 'waiting': return 'Aguardando';
      case 'rolling': return 'Girando';
      case 'complete': return 'Completo';
      case 'connected': return 'Conectado';
      case 'disconnected': return 'Desconectado';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'won': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'lost': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Alertas */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 slide-up">
          <div className="flex items-center">
            <XCircle className="w-5 h-5 text-red-500 mr-2" />
            <p className="text-red-100">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 slide-up">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            <p className="text-green-100">{success}</p>
          </div>
        </div>
      )}

      {/* Status do Monitor da Blaze */}
      <div className="card-dark p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              {blazeConnected ? (
                <Wifi className="w-5 h-5 text-green-500" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-500" />
              )}
              <span className="font-medium text-slate-200">Monitor da Blaze</span>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              blazeConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {blazeConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-slate-300">
              Status: <span className="font-medium">{getBlazeStatusText(blazeState.status)}</span>
            </div>
            {blazeState.roll !== null && (
              <div className="flex items-center space-x-2">
                <div className={`w-6 h-6 rounded-full ${getBlazeColorClass(blazeState.color || '')}`} />
                <span className="font-bold text-lg">{blazeState.roll}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card-dark p-6">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-lg">
              <Wallet className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-400">Saldo</p>
              <p className="text-2xl font-bold text-slate-100">
                R$ {balance ? balance.balance.toFixed(2) : '0.00'}
              </p>
            </div>
          </div>
        </div>

        <div className="card-dark p-6">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-400">Lucro Total</p>
              <p className="text-2xl font-bold text-slate-100">
                R$ {stats ? stats.total_profit.toFixed(2) : '0.00'}
              </p>
            </div>
          </div>
        </div>

        <div className="card-dark p-6">
          <div className="flex items-center">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Activity className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-400">Taxa de Vitória</p>
              <p className="text-2xl font-bold text-slate-100">
                {stats && stats.total_bets > 0 
                  ? ((stats.wins / stats.total_bets) * 100).toFixed(1) + '%'
                  : '0%'
                }
              </p>
            </div>
          </div>
        </div>

        <div className="card-dark p-6">
          <div className="flex items-center">
            <div className="bg-orange-100 p-3 rounded-lg">
              <History className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-400">Total de Apostas</p>
              <p className="text-2xl font-bold text-slate-100">
                {stats ? stats.total_bets : 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Resultados da Blaze em Tempo Real */}
      <div className="card-dark">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-slate-100">Resultados da Blaze</h3>
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-300">Tempo Real</span>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-10 gap-2">
            {blazeResults.slice(0, 20).map((result, index) => (
              <div
                key={result.id}
                className="flex flex-col items-center p-2 rounded-lg border border-slate-600 hover:border-slate-500 transition-all hover:shadow-lg"
                title={`${getBlazeColorName(result.color)} - ${result.roll} - ${new Date(result.created_at).toLocaleString('pt-BR')}`}
              >
                <div className={`w-8 h-8 rounded-full mb-1 ${getBlazeColorClass(result.color)}`} />
                <span className="text-xs font-bold">{result.roll}</span>
                <span className="text-xs text-slate-400">#{index + 1}</span>
              </div>
            ))}
          </div>
          
          {blazeResults.length === 0 && (
            <div className="text-center py-8">
              <Activity className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-400">Aguardando resultados da Blaze...</p>
            </div>
          )}
        </div>
      </div>

      {/* Configuração e Controles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuração do Bot */}
        <div className="card-dark lg:col-span-2">
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-100">Configuração do Bot</h3>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isBotActive ? 'status-online' : 'status-offline'}`} />
                <span className="text-sm text-slate-300">
                  {isBotActive ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {!isBotActive && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Access Token
                  </label>
                  <textarea
                    value={tokens.accessToken}
                    onChange={(e) => setTokens({ ...tokens, accessToken: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    rows={3}
                    placeholder="Cole seu access token aqui..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Refresh Token
                  </label>
                  <textarea
                    value={tokens.refreshToken}
                    onChange={(e) => setTokens({ ...tokens, refreshToken: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    rows={3}
                    placeholder="Cole seu refresh token aqui..."
                  />
                </div>
                
                <button
                  onClick={initializeBot}
                  disabled={isLoading}
                  className="w-full btn-primary disabled:opacity-50 flex items-center justify-center"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 spinner" />
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Inicializar Bot
                    </>
                  )}
                </button>
              </div>
            )}
            
            {isBotActive && (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-slate-100 mb-2">Bot Ativo</h4>
                <p className="text-slate-300">
                  Seu bot está funcionando e os tokens são atualizados automaticamente.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Apostas Automáticas */}
      <div className="card-dark">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-slate-100">Apostas Automáticas</h3>
              <p className="text-sm text-slate-400">Sistema inteligente com análise de padrões</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isAutoBettingActive ? 'status-online' : 'status-offline'}`} />
              <span className="text-sm text-slate-300">
                {isAutoBettingActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Configurações */}
            <div className="space-y-4">
              <h4 className="font-medium text-slate-100">Configurações</h4>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Valor por Aposta (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={autoBettingConfig.bet_amount}
                  onChange={(e) => setAutoBettingConfig({
                    ...autoBettingConfig,
                    bet_amount: parseFloat(e.target.value) || 1.0
                  })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  disabled={isAutoBettingActive}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Meta de Lucro Diário (%)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={autoBettingConfig.profit_target}
                  onChange={(e) => setAutoBettingConfig({
                    ...autoBettingConfig,
                    profit_target: parseInt(e.target.value) || 30
                  })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  disabled={isAutoBettingActive}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Stop Loss (%)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={autoBettingConfig.stop_loss}
                  onChange={(e) => setAutoBettingConfig({
                    ...autoBettingConfig,
                    stop_loss: parseInt(e.target.value) || 100
                  })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  disabled={isAutoBettingActive}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Confiança Mínima (%)
                </label>
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={Math.round(autoBettingConfig.min_confidence * 100)}
                  onChange={(e) => setAutoBettingConfig({
                    ...autoBettingConfig,
                    min_confidence: (parseInt(e.target.value) || 60) / 100
                  })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  disabled={isAutoBettingActive}
                />
              </div>
              
              <button
                onClick={toggleAutoBetting}
                disabled={isLoading || !isBotActive}
                className={`w-full py-2 px-4 rounded-md font-medium transition-all duration-200 disabled:opacity-50 flex items-center justify-center ${
                  isAutoBettingActive
                    ? 'gradient-error text-white hover:shadow-lg'
                    : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white hover:shadow-lg'
                }`}
              >
                {isLoading ? (
                  <div className="w-5 h-5 spinner" />
                ) : (
                  <>
                    {isAutoBettingActive ? (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Parar Bot Automático
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Iniciar Bot Automático
                      </>
                    )}
                  </>
                )}
              </button>
            </div>
            
            {/* Estatísticas */}
            <div className="space-y-4">
              <h4 className="font-medium text-slate-100">Estatísticas do Dia</h4>
              
              {autoBettingStats ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-slate-800 rounded-lg">
                    <span className="text-sm text-slate-300">Status</span>
                    <span className={`text-sm font-medium ${
                      autoBettingStats.status === 'active' ? 'text-green-600' :
                      autoBettingStats.status === 'paused_until_tomorrow' ? 'text-yellow-600' :
                      'text-slate-400'
                    }`}>
                      {autoBettingStats.status === 'active' ? 'Ativo' :
                       autoBettingStats.status === 'paused_until_tomorrow' ? 'Pausado até amanhã' :
                       'Inativo'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-slate-800 rounded-lg">
                    <span className="text-sm text-slate-300">Lucro do Dia</span>
                    <span className={`text-sm font-medium ${
                      autoBettingStats.dailyProfit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      R$ {autoBettingStats.dailyProfit.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-slate-800 rounded-lg">
                    <span className="text-sm text-slate-300">Progresso da Meta</span>
                    <span className="text-sm font-medium text-blue-600">
                      {autoBettingStats.targetProgress}%
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-slate-800 rounded-lg">
                    <span className="text-sm text-slate-300">Apostas Hoje</span>
                    <span className="text-sm font-medium text-slate-100">
                      {autoBettingStats.totalBets}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-slate-800 rounded-lg">
                    <span className="text-sm text-slate-300">Taxa de Vitória</span>
                    <span className="text-sm font-medium text-purple-600">
                      {autoBettingStats.winRate}%
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-slate-800 rounded-lg">
                    <span className="text-sm text-slate-300">Perdas Consecutivas</span>
                    <span className={`text-sm font-medium ${
                      autoBettingStats.consecutiveLosses >= 3 ? 'text-red-600' : 'text-slate-300'
                    }`}>
                      {autoBettingStats.consecutiveLosses}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-400">Nenhuma sessão ativa</p>
                </div>
              )}
            </div>
          </div>
          
          {!isBotActive && (
            <div className="mt-4 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-yellow-500 mr-2" />
                <p className="text-yellow-100 text-sm">
                  Configure e ative o bot principal primeiro para usar apostas automáticas.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Histórico de Apostas */}
      <div className="card-dark">
        <div className="p-6 border-b border-slate-700">
          <h3 className="text-lg font-medium text-slate-100">Histórico de Apostas</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700 table-dark">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Cor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Lucro
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Data
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {bets.map((bet) => (
                <tr key={bet.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(bet.status)}
                      <span className="ml-2 text-sm capitalize">{bet.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full mr-2 ${getColorClass(bet.color)}`} />
                      <span className="text-sm capitalize">{bet.color}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">
                    R$ {bet.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={bet.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                      R$ {bet.profit.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                    {new Date(bet.created_at).toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {bets.length === 0 && (
            <div className="text-center py-8">
              <History className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-400">Nenhuma aposta encontrada</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;