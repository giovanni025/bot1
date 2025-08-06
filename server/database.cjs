const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

class Database {
    constructor() {
        this.db = new sqlite3.Database(path.join(__dirname, 'blaze_bot.db'));
        this.init();
    }

    init() {
        // Tabela de usuários
        this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                is_admin BOOLEAN DEFAULT 0,
                is_approved BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de tokens da Blaze
        this.db.run(`
            CREATE TABLE IF NOT EXISTS blaze_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                access_token TEXT NOT NULL,
                refresh_token TEXT NOT NULL,
                session_id TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        // Tabela de apostas
        this.db.run(`
            CREATE TABLE IF NOT EXISTS bets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                color TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                result TEXT,
                profit REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        // Tabela de configurações do bot
        this.db.run(`
            CREATE TABLE IF NOT EXISTS bot_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                is_active BOOLEAN DEFAULT 0,
                auto_bet BOOLEAN DEFAULT 0,
                bet_amount REAL DEFAULT 1.0,
                strategy TEXT DEFAULT 'manual',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        // Adicionar as colunas faltantes à tabela bot_config se não existirem
        this.addMissingColumns();

        // Tabela de resultados da Blaze
        this.db.run(`
            CREATE TABLE IF NOT EXISTS blaze_results (
                id TEXT PRIMARY KEY,
                color TEXT NOT NULL,
                roll INTEGER NOT NULL,
                created_at DATETIME NOT NULL,
                recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de sessões de apostas automáticas
        this.db.run(`
            CREATE TABLE IF NOT EXISTS auto_betting_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                initial_balance REAL NOT NULL,
                final_balance REAL,
                daily_profit REAL DEFAULT 0,
                total_bets INTEGER DEFAULT 0,
                wins INTEGER DEFAULT 0,
                losses INTEGER DEFAULT 0,
                start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                end_time DATETIME,
                status TEXT DEFAULT 'active',
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        // Criar admin padrão
        this.createDefaultAdmin();
    }

    addMissingColumns() {
        // Verificar se as colunas existem e adicioná-las se necessário
        this.db.serialize(() => {
            // Verificar estrutura da tabela
            this.db.all("PRAGMA table_info(bot_config)", (err, columns) => {
                if (err) {
                    console.error('Erro ao verificar estrutura da tabela:', err);
                    return;
                }

                const columnNames = columns.map(col => col.name);
                
                // Adicionar profit_target se não existir
                if (!columnNames.includes('profit_target')) {
                    this.db.run(`ALTER TABLE bot_config ADD COLUMN profit_target REAL DEFAULT 30.0`, (err) => {
                        if (err && !err.message.includes('duplicate column name')) {
                            console.error('Erro ao adicionar coluna profit_target:', err);
                        } else {
                            console.log('✅ Coluna profit_target adicionada com sucesso');
                        }
                    });
                }

                // Adicionar stop_loss se não existir
                if (!columnNames.includes('stop_loss')) {
                    this.db.run(`ALTER TABLE bot_config ADD COLUMN stop_loss REAL DEFAULT 100.0`, (err) => {
                        if (err && !err.message.includes('duplicate column name')) {
                            console.error('Erro ao adicionar coluna stop_loss:', err);
                        } else {
                            console.log('✅ Coluna stop_loss adicionada com sucesso');
                        }
                    });
                }

                // Adicionar min_confidence se não existir
                if (!columnNames.includes('min_confidence')) {
                    this.db.run(`ALTER TABLE bot_config ADD COLUMN min_confidence REAL DEFAULT 0.6`, (err) => {
                        if (err && !err.message.includes('duplicate column name')) {
                            console.error('Erro ao adicionar coluna min_confidence:', err);
                        } else {
                            console.log('✅ Coluna min_confidence adicionada com sucesso');
                        }
                    });
                }
            });
        });
    }

    async createDefaultAdmin() {
        const hashedPassword = await bcrypt.hash('267589', 10);
        this.db.run(`
            INSERT OR IGNORE INTO users (username, password, email, is_admin, is_approved)
            VALUES ('jean', ?, 'jean@blazebot.com', 1, 1)
        `, [hashedPassword]);
    }

    // Métodos para usuários
    createUser(username, password, email) {
        return new Promise((resolve, reject) => {
            bcrypt.hash(password, 10, (err, hashedPassword) => {
                if (err) return reject(err);
                
                this.db.run(`
                    INSERT INTO users (username, password, email)
                    VALUES (?, ?, ?)
                `, [username, hashedPassword, email], function(err) {
                    if (err) return reject(err);
                    resolve(this.lastID);
                });
            });
        });
    }

    getUserByUsername(username) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT * FROM users WHERE username = ?
            `, [username], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }

    getUserById(id) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT * FROM users WHERE id = ?
            `, [id], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }

    getAllUsers() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT id, username, email, is_admin, is_approved, created_at
                FROM users ORDER BY created_at DESC
            `, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    approveUser(userId) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                UPDATE users SET is_approved = 1, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [userId], function(err) {
                if (err) return reject(err);
                resolve(this.changes > 0);
            });
        });
    }

    deleteUser(userId) {
        return new Promise((resolve, reject) => {
            this.db.run(`DELETE FROM users WHERE id = ?`, [userId], function(err) {
                if (err) return reject(err);
                resolve(this.changes > 0);
            });
        });
    }

    // Métodos para tokens
    saveTokens(userId, accessToken, refreshToken, sessionId = null) {
        return new Promise((resolve, reject) => {
            // Desativar tokens antigos
            this.db.run(`
                UPDATE blaze_tokens SET is_active = 0 WHERE user_id = ?
            `, [userId], (err) => {
                if (err) return reject(err);
                
                // Inserir novos tokens
                this.db.run(`
                    INSERT INTO blaze_tokens (user_id, access_token, refresh_token, session_id)
                    VALUES (?, ?, ?, ?)
                `, [userId, accessToken, refreshToken, sessionId], function(err) {
                    if (err) return reject(err);
                    resolve(this.lastID);
                });
            });
        });
    }

    getActiveTokens(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT * FROM blaze_tokens 
                WHERE user_id = ? AND is_active = 1
                ORDER BY created_at DESC LIMIT 1
            `, [userId], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }

    updateTokens(tokenId, accessToken, refreshToken, sessionId = null) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                UPDATE blaze_tokens 
                SET access_token = ?, refresh_token = ?, session_id = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [accessToken, refreshToken, sessionId, tokenId], function(err) {
                if (err) return reject(err);
                resolve(this.changes > 0);
            });
        });
    }

    // Métodos para apostas
    createBet(userId, amount, color) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT INTO bets (user_id, amount, color)
                VALUES (?, ?, ?)
            `, [userId, amount, color], function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            });
        });
    }

    updateBetResult(betId, status, result, profit) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                UPDATE bets 
                SET status = ?, result = ?, profit = ?
                WHERE id = ?
            `, [status, result, profit, betId], function(err) {
                if (err) return reject(err);
                resolve(this.changes > 0);
            });
        });
    }

    getUserBets(userId, limit = 50) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT * FROM bets 
                WHERE user_id = ?
                ORDER BY created_at DESC LIMIT ?
            `, [userId, limit], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    getUserStats(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT 
                    COUNT(*) as total_bets,
                    SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as wins,
                    SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as losses,
                    COALESCE(SUM(profit), 0.0) as total_profit,
                    COALESCE(AVG(amount), 0.0) as avg_bet_amount
                FROM bets WHERE user_id = ?
            `, [userId], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }

    // Métodos para configuração do bot
    saveBotConfig(userId, config) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT OR REPLACE INTO bot_config 
                (user_id, is_active, auto_bet, bet_amount, strategy, profit_target, stop_loss, min_confidence, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                userId, 
                config.is_active, 
                config.auto_bet, 
                config.bet_amount, 
                config.strategy,
                config.profit_target || 30.0,
                config.stop_loss || 100.0,
                config.min_confidence || 0.6
            ], function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            });
        });
    }

    getBotConfig(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT * FROM bot_config WHERE user_id = ?
            `, [userId], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }

    // Métodos para resultados da Blaze
    saveBlazeResult(id, color, roll, created_at) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT OR REPLACE INTO blaze_results (id, color, roll, created_at)
                VALUES (?, ?, ?, ?)
            `, [id, color, roll, created_at], function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            });
        });
    }

    getLastBlazeResults(limit = 20) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT * FROM blaze_results 
                ORDER BY recorded_at DESC LIMIT ?
            `, [limit], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    getBlazeResultById(id) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT * FROM blaze_results WHERE id = ?
            `, [id], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }

    // Métodos para sessões de apostas automáticas
    createAutoBettingSession(userId, initialBalance) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT INTO auto_betting_sessions (user_id, initial_balance)
                VALUES (?, ?)
            `, [userId, initialBalance], function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            });
        });
    }

    updateAutoBettingSession(sessionId, data) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                UPDATE auto_betting_sessions 
                SET final_balance = ?, daily_profit = ?, total_bets = ?, 
                    wins = ?, losses = ?, end_time = ?, status = ?
                WHERE id = ?
            `, [
                data.final_balance,
                data.daily_profit,
                data.total_bets,
                data.wins,
                data.losses,
                data.end_time,
                data.status,
                sessionId
            ], function(err) {
                if (err) return reject(err);
                resolve(this.changes > 0);
            });
        });
    }

    getUserAutoBettingSessions(userId, limit = 30) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT * FROM auto_betting_sessions 
                WHERE user_id = ?
                ORDER BY start_time DESC LIMIT ?
            `, [userId, limit], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }
}

module.exports = Database;