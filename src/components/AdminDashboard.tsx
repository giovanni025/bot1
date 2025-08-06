import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Shield, 
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Wifi,
  WifiOff,
  Monitor
} from 'lucide-react';

interface User {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  is_approved: boolean;
  created_at: string;
}

interface BotStatus {
  [userId: string]: {
    isActive: boolean;
    lastAuth: string;
    hasTokens: boolean;
  };
}

interface AutoBotStatus {
  [userId: string]: {
    status: string;
    dailyProfit: number;
    totalBets: number;
    wins: number;
    losses: number;
    winRate: string;
    consecutiveLosses: number;
    timeActive: number;
    nextAction: string;
  };
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
const AdminDashboard: React.FC = () => {
  const { token } = useAuth();
  const { socket } = useSocket();
  const [users, setUsers] = useState<User[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus>({});
  const [autoBotStatus, setAutoBotStatus] = useState<AutoBotStatus>({});
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadUsers();
    loadBotStatus();
    loadBlazeResults();
  }, []);

  useEffect(() => {
    if (socket) {
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

      return () => {
        socket.off('blaze-monitor-status');
        socket.off('blaze-new-result');
        socket.off('blaze-state-change');
      };
    }
  }, [socket]);
  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      setError('Erro ao carregar usuários');
    }
  };

  const loadBotStatus = async () => {
    try {
      const response = await fetch('/api/admin/bots-status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setBotStatus(data.status);
        setAutoBotStatus(data.autoStatus || {});
      }
    } catch (error) {
      console.error('Erro ao carregar status dos bots:', error);
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
  const approveUser = async (userId: number) => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      if (data.success) {
        setSuccess('Usuário aprovado com sucesso!');
        loadUsers();
      } else {
        setError(data.error || 'Erro ao aprovar usuário');
      }
    } catch (error) {
      setError('Erro de conexão');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUser = async (userId: number) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) {
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      if (data.success) {
        setSuccess('Usuário excluído com sucesso!');
        loadUsers();
      } else {
        setError(data.error || 'Erro ao excluir usuário');
      }
    } catch (error) {
      setError('Erro de conexão');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (user: User) => {
    if (user.is_admin) {
      return <Shield className="w-5 h-5 text-orange-500" />;
    }
    if (user.is_approved) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    return <Clock className="w-5 h-5 text-yellow-500" />;
  };

  const getBotStatusIcon = (userId: string) => {
    const status = botStatus[userId];
    if (!status) {
      return <XCircle className="w-4 h-4 text-gray-400" />;
    }
    if (status.isActive && status.hasTokens) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    return <XCircle className="w-4 h-4 text-red-500" />;
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
  const pendingUsers = users.filter(user => !user.is_approved && !user.is_admin);
  const approvedUsers = users.filter(user => user.is_approved || user.is_admin);
  const activeBots = Object.values(botStatus).filter(status => status.isActive).length;
  const activeAutoBots = Object.values(autoBotStatus).filter(status => status.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Alertas */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <XCircle className="w-5 h-5 text-red-500 mr-2" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            <p className="text-green-700">{success}</p>
          </div>
        </div>
      )}

      {/* Status do Monitor da Blaze */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 p-3 rounded-lg">
              <Monitor className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Monitor da Blaze</h3>
              <p className="text-sm text-gray-600">Sistema de monitoramento em tempo real</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {blazeConnected ? (
                <Wifi className="w-5 h-5 text-green-500" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-500" />
              )}
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                blazeConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {blazeConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
            
            <div className="text-sm text-gray-600">
              Status: <span className="font-medium">{getBlazeStatusText(blazeState.status)}</span>
            </div>
            
            {blazeState.roll !== null && (
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-full ${getBlazeColorClass(blazeState.color || '')}`} />
                <span className="font-bold text-xl">{blazeState.roll}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Últimos resultados */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Últimos 20 Resultados</h4>
          <div className="grid grid-cols-20 gap-1">
            {blazeResults.slice(0, 20).map((result, index) => (
              <div
                key={result.id}
                className="flex flex-col items-center p-1 rounded border hover:shadow-sm transition-shadow"
                title={`${getBlazeColorName(result.color)} - ${result.roll} - ${new Date(result.created_at).toLocaleString('pt-BR')}`}
              >
                <div className={`w-6 h-6 rounded-full mb-1 ${getBlazeColorClass(result.color)}`} />
                <span className="text-xs font-bold">{result.roll}</span>
              </div>
            ))}
          </div>
          
          {blazeResults.length === 0 && (
            <div className="text-center py-4">
              <Activity className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Aguardando resultados...</p>
            </div>
          )}
        </div>
      </div>
      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total de Usuários</p>
              <p className="text-2xl font-bold text-gray-900">{users.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pendentes</p>
              <p className="text-2xl font-bold text-gray-900">{pendingUsers.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-lg">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Aprovados</p>
              <p className="text-2xl font-bold text-gray-900">{approvedUsers.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Activity className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Bots Ativos</p>
              <p className="text-2xl font-bold text-gray-900">{activeBots}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-indigo-100 p-3 rounded-lg">
              <Activity className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Bots Automáticos</p>
              <p className="text-2xl font-bold text-gray-900">{activeAutoBots}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Usuários Pendentes */}
      {pendingUsers.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Usuários Pendentes de Aprovação</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data de Cadastro
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(user)}
                        <span className="ml-2 text-sm font-medium text-gray-900">{user.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => approveUser(user.id)}
                          disabled={isLoading}
                          className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center"
                        >
                          <UserCheck className="w-4 h-4 mr-1" />
                          Aprovar
                        </button>
                        <button
                          onClick={() => deleteUser(user.id)}
                          disabled={isLoading}
                          className="bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Todos os Usuários */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Todos os Usuários</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bot
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Auto Bot
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data de Cadastro
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(user)}
                      <span className="ml-2 text-xs">
                        {user.is_admin ? 'Admin' : user.is_approved ? 'Aprovado' : 'Pendente'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.username}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getBotStatusIcon(user.id.toString())}
                      <span className="ml-2 text-xs">
                        {botStatus[user.id.toString()]?.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {autoBotStatus[user.id.toString()] ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="ml-2 text-xs">
                            {autoBotStatus[user.id.toString()].status === 'active' ? 'Ativo' : 
                             autoBotStatus[user.id.toString()].status === 'paused_until_tomorrow' ? 'Pausado' : 'Inativo'}
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-gray-400" />
                          <span className="ml-2 text-xs">Inativo</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      {!user.is_approved && !user.is_admin && (
                        <button
                          onClick={() => approveUser(user.id)}
                          disabled={isLoading}
                          className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          Aprovar
                        </button>
                      )}
                      {!user.is_admin && (
                        <button
                          onClick={() => deleteUser(user.id)}
                          disabled={isLoading}
                          className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {users.length === 0 && (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum usuário encontrado</p>
            </div>
          )}
        </div>
      </div>

      {/* Status dos Bots Automáticos */}
      {Object.keys(autoBotStatus).length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Status dos Bots Automáticos</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lucro Diário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Apostas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Taxa de Vitória
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Perdas Consecutivas
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(autoBotStatus).map(([userId, status]) => {
                  const user = users.find(u => u.id.toString() === userId);
                  return (
                    <tr key={userId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user?.username || `User ${userId}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          status.status === 'active' ? 'bg-green-100 text-green-800' :
                          status.status === 'paused_until_tomorrow' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {status.status === 'active' ? 'Ativo' :
                           status.status === 'paused_until_tomorrow' ? 'Pausado' :
                           'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={status.dailyProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                          R$ {status.dailyProfit.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {status.totalBets} ({status.wins}V/{status.losses}D)
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {status.winRate}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={status.consecutiveLosses >= 3 ? 'text-red-600' : 'text-gray-900'}>
                          {status.consecutiveLosses}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;