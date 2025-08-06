const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const Database = require('./database.cjs');
const AuthService = require('./auth.cjs');
const BlazeManager = require('./blazeManager.cjs');
const BlazeRouletteMonitor = require('./blaze_monitor.cjs');
const AutoBettingManager = require('./autoBettingManager.cjs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Inicializar serviços
const db = new Database();
const auth = new AuthService(db);
const blazeManager = new BlazeManager(db);
const autoBettingManager = new AutoBettingManager(db, blazeManager);
const blazeMonitor = new BlazeRouletteMonitor({
    csvFile: path.join(__dirname, 'blaze_results.csv'),
    autoReconnect: true,
    reconnectDelay: 5000,
    database: db
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

// Configurar eventos do monitor da Blaze
blazeMonitor.on('connected', () => {
    console.log('🎰 Monitor da Blaze conectado');
    io.emit('blaze-monitor-status', { status: 'connected' });
});

blazeMonitor.on('disconnected', (data) => {
    console.log('🎰 Monitor da Blaze desconectado:', data);
    io.emit('blaze-monitor-status', { status: 'disconnected', data });
});

blazeMonitor.on('new_result', (result) => {
    console.log('🎯 Novo resultado da Blaze:', result);
    io.emit('blaze-new-result', result);
    
    // Processar resultado para apostas automáticas
    autoBettingManager.processBlazeResult(result);
});

blazeMonitor.on('state_change', (state) => {
    io.emit('blaze-state-change', state);
});

blazeMonitor.on('waiting', () => {
    io.emit('blaze-waiting');
    
    // Processar apostas automáticas quando a roleta estiver aguardando
    processAutoBetstForAllUsers();
});

blazeMonitor.on('rolling', () => {
    io.emit('blaze-rolling');
});

blazeMonitor.on('error', (error) => {
    console.error('❌ Erro no monitor da Blaze:', error);
    io.emit('blaze-error', error);
});
// Socket.IO para atualizações em tempo real
// Função para processar apostas automáticas
async function processAutoBetstForAllUsers() {
    try {
        const results = await db.getLastBlazeResults(20);
        const activeUsers = autoBettingManager.getAllAutoBotsStatus();
        
        for (const userId of Object.keys(activeUsers)) {
            if (activeUsers[userId].status === 'active') {
                const result = await autoBettingManager.processAutoBet(parseInt(userId), results);
                
                if (result.processed) {
                    // Notificar usuário sobre aposta automática
                    io.to(`user-${userId}`).emit('auto-bet-placed', result);
                }
            }
        }
    } catch (error) {
        console.error('❌ Erro ao processar apostas automáticas:', error.message);
    }
}

io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);
    
    socket.on('join-user-room', (userId) => {
        socket.join(`user-${userId}`);
        console.log(`Usuário ${userId} entrou na sala`);
        
        // Enviar estado atual do monitor para o cliente
        socket.emit('blaze-monitor-status', { 
            status: blazeMonitor.isConnected ? 'connected' : 'disconnected' 
        });
        socket.emit('blaze-state-change', blazeMonitor.getCurrentState());
    });

    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });
});

// Rotas de autenticação
app.post('/api/auth/register', async (req, res) => {
    const { username, password, email } = req.body;
    
    if (!username || !password || !email) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    const result = await auth.register(username, password, email);
    
    if (result.success) {
        res.status(201).json(result);
    } else {
        res.status(400).json(result);
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username e password são obrigatórios' });
    }

    const result = await auth.login(username, password);
    
    if (result.success) {
        res.json(result);
    } else {
        res.status(401).json(result);
    }
});

// Middleware de autenticação para rotas protegidas
const authenticateToken = (req, res, next) => {
    auth.authenticateToken(req, res, next);
};

// Rotas do usuário
app.get('/api/protected/profile', authenticateToken, async (req, res) => {
    try {
        const user = await db.getUserById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            isAdmin: user.is_admin,
            isApproved: user.is_approved
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/protected/bot/initialize', authenticateToken, async (req, res) => {
    const { accessToken, refreshToken } = req.body;
    
    if (!accessToken || !refreshToken) {
        return res.status(400).json({ error: 'Access token e refresh token são obrigatórios' });
    }

    const result = await blazeManager.initializeUserBot(req.user.userId, accessToken, refreshToken);
    
    if (result.success) {
        // Notificar via socket
        io.to(`user-${req.user.userId}`).emit('bot-initialized', result);
        res.json(result);
    } else {
        res.status(400).json(result);
    }
});

app.get('/api/protected/bot/balance', authenticateToken, async (req, res) => {
    const result = await blazeManager.getUserBalance(req.user.userId);
    res.json(result);
});

app.post('/api/protected/bot/bet', authenticateToken, async (req, res) => {
    const { color, amount } = req.body;
    
    if (!color || !amount) {
        return res.status(400).json({ error: 'Cor e valor são obrigatórios' });
    }

    const result = await blazeManager.placeBet(req.user.userId, color, amount);
    
    if (result.success) {
        // Notificar via socket
        io.to(`user-${req.user.userId}`).emit('bet-placed', result);
    }
    
    res.json(result);
});

app.get('/api/protected/bot/doubles', authenticateToken, async (req, res) => {
    const result = await blazeManager.getLastDoubles(req.user.userId);
    res.json(result);
});

app.get('/api/protected/bot/current-game', authenticateToken, async (req, res) => {
    const result = await blazeManager.getCurrentGame(req.user.userId);
    res.json(result);
});

// Rotas para apostas automáticas
app.post('/api/protected/bot/auto-betting/toggle', authenticateToken, async (req, res) => {
    const { config } = req.body;
    
    try {
        const result = await autoBettingManager.toggleAutoBetting(req.user.userId, config);
        
        if (result.success) {
            // Notificar via socket
            io.to(`user-${req.user.userId}`).emit('auto-betting-toggled', result);
        }
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/protected/bot/auto-betting/status', authenticateToken, async (req, res) => {
    try {
        const stats = autoBettingManager.getUserStats(req.user.userId);
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/protected/bot/auto-betting/sessions', authenticateToken, async (req, res) => {
    try {
        const sessions = await db.getUserAutoBettingSessions(req.user.userId);
        res.json({ success: true, sessions });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/protected/bets', authenticateToken, async (req, res) => {
    try {
        const bets = await db.getUserBets(req.user.userId);
        res.json({ success: true, bets });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/protected/stats', authenticateToken, async (req, res) => {
    try {
        const stats = await db.getUserStats(req.user.userId);
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rotas do monitor da Blaze
app.get('/api/protected/blaze/status', authenticateToken, (req, res) => {
    const state = blazeMonitor.getCurrentState();
    res.json({ 
        success: true, 
        status: {
            isConnected: blazeMonitor.isConnected,
            ...state
        }
    });
});

app.get('/api/protected/blaze/last-results', authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const results = await db.getLastBlazeResults(limit);
        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Middleware para rotas de administrador
const requireAdmin = (req, res, next) => {
    auth.requireAdmin(req, res, next);
};

// Rotas de administrador
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await db.getAllUsers();
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/users/:userId/approve', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;
        if (!userId || isNaN(userId)) {
            return res.status(400).json({ error: 'ID de usuário inválido' });
        }

        const result = await db.approveUser(userId);
        if (result) {
            // Notificar usuário aprovado
            io.to(`user-${userId}`).emit('user-approved');
            res.json({ success: true, message: 'Usuário aprovado' });
        } else {
            res.status(404).json({ error: 'Usuário não encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;
        if (!userId || isNaN(userId)) {
            return res.status(400).json({ error: 'ID de usuário inválido' });
        }

        // Remover bot do usuário se existir
        blazeManager.removeUserBot(parseInt(userId));
        
        const result = await db.deleteUser(userId);
        if (result) {
            res.json({ success: true, message: 'Usuário excluído' });
        } else {
            res.status(404).json({ error: 'Usuário não encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/bots-status', authenticateToken, requireAdmin, (req, res) => {
    const status = blazeManager.getAllBotsStatus();
    const autoStatus = autoBettingManager.getAllAutoBotsStatus();
    res.json({ success: true, status, autoStatus });
});

// Servir aplicação React
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Iniciar servidor
const PORT = process.env.PORT || 3003;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 Interface disponível em: http://0.0.0.0:${PORT}`);
    console.log(`👤 Admin padrão: admin / admin123`);
    
    // Iniciar monitor da Blaze
    console.log('🎰 Iniciando monitor da Blaze...');
    blazeMonitor.connect();
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Encerrando servidor...');
    
    // Limpar recursos do AutoBettingManager
    if (autoBettingManager) {
        autoBettingManager.cleanup();
    }
    
    blazeMonitor.disconnect();
    server.close(() => {
        console.log('✅ Servidor encerrado');
        process.exit(0);
    });
});
module.exports = { app, server, io };