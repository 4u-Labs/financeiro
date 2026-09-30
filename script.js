/**
 * 4U FINANCE PRO — FINTECH CORE ENGINE 2.0
 * Architecture: ES6+ Modular Class with Offline-First LocalStorage,
 * OFX Bank Statement Parser, jsPDF Executive Report, 50/30/20 Budgeting,
 * Installments Engine, and Embedded Financial Calculators.
 */

/**
 * ==========================================================================
 * GOOGLE DRIVE CLIENT-SIDE SYNC ENGINE (ZERO-KNOWLEDGE)
 * ==========================================================================
 * Autenticação via Google Identity Services (GIS).
 * Cria/Localiza a pasta "4U Finance Pro" no Google Drive do usuário
 * e sincroniza 4u_finance_database.json diretamente entre navegador e Google Drive.
 */
class GoogleDriveSync {
    constructor(app) {
        this.app = app;
        this.CLIENT_ID = '569266864432-pd09jbb5no9ekdhdr018fj643nopp817.apps.googleusercontent.com';
        this.SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file';
        this.FOLDER_NAME = '4U Finance Pro';
        this.FILE_NAME = '4u_finance_database.json';

        this.user = this.getStoredUser();
        this.tokenData = this.getStoredToken();
        this.folderId = localStorage.getItem('4u_drive_folder_id') || null;
        this.fileId = localStorage.getItem('4u_drive_file_id') || null;
        this.lastSyncTime = localStorage.getItem('4u_drive_last_sync') || null;

        this.tokenClient = null;
        this.isSyncing = false;
        this.syncDebounceTimer = null;
    }

    getStoredUser() {
        try {
            const u = localStorage.getItem('4u_google_user');
            return u ? JSON.parse(u) : null;
        } catch (e) { return null; }
    }

    getStoredToken() {
        try {
            const t = localStorage.getItem('4u_google_token');
            if (!t) return null;
            const parsed = JSON.parse(t);
            if (parsed.expires_at && Date.now() > parsed.expires_at - 60000) {
                return null;
            }
            return parsed;
        } catch (e) { return null; }
    }

    init() {
        this.renderTopbar();
        this.ensureGISClient();

        if (this.user) {
            this.closeAuthModal();
            this.initialSync();
        } else {
            this.openAuthModal();
        }
    }

    ensureGISClient() {
        if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
            if (!this.tokenClient) {
                this.tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: this.CLIENT_ID,
                    scope: this.SCOPES,
                    callback: async (tokenResponse) => {
                        if (tokenResponse && tokenResponse.access_token) {
                            await this.handleTokenSuccess(tokenResponse);
                        } else if (tokenResponse && tokenResponse.error) {
                            this.showAuthError('Erro na autorização do Google: ' + tokenResponse.error);
                        }
                    }
                });
            }
            return true;
        }
        return false;
    }

    openAuthModal() {
        const modal = document.getElementById('modalGoogleAuth');
        if (modal) modal.classList.add('open');
    }

    closeAuthModal() {
        const modal = document.getElementById('modalGoogleAuth');
        if (modal) modal.classList.remove('open');
    }

    showAuthError(msg) {
        const errBox = document.getElementById('googleAuthErrorBox');
        if (errBox) {
            errBox.textContent = msg;
            errBox.style.display = 'block';
        } else {
            this.app.showToast(msg, 'error');
        }
    }

    login() {
        const btn = document.getElementById('btnGoogleSignInModal');
        const txt = document.getElementById('btnGoogleText');
        if (btn) btn.disabled = true;
        if (txt) txt.textContent = 'Conectando ao Google...';

        const errBox = document.getElementById('googleAuthErrorBox');
        if (errBox) errBox.style.display = 'none';

        if (!this.ensureGISClient()) {
            this.showAuthError('Aguardando carregamento da biblioteca do Google... Tente novamente em alguns segundos.');
            if (btn) btn.disabled = false;
            if (txt) txt.textContent = 'Continuar com Conta Google';
            return;
        }

        try {
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        } catch (e) {
            console.error('GIS Error:', e);
            this.showAuthError('Erro ao iniciar login Google: ' + e.message);
            if (btn) btn.disabled = false;
            if (txt) txt.textContent = 'Continuar com Conta Google';
        }
    }

    async handleTokenSuccess(tokenResponse) {
        const btn = document.getElementById('btnGoogleSignInModal');
        const txt = document.getElementById('btnGoogleText');
        if (txt) txt.textContent = 'Configurando Google Drive...';

        const accessToken = tokenResponse.access_token;
        const expiresIn = parseInt(tokenResponse.expires_in) || 3599;
        this.tokenData = {
            access_token: accessToken,
            expires_at: Date.now() + (expiresIn * 1000)
        };
        localStorage.setItem('4u_google_token', JSON.stringify(this.tokenData));

        try {
            // Obter Perfil do Usuário
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (userRes.ok) {
                const profile = await userRes.json();
                this.user = {
                    name: profile.name || profile.given_name || 'Usuário',
                    email: profile.email || '',
                    picture: profile.picture || ''
                };
                localStorage.setItem('4u_google_user', JSON.stringify(this.user));
            }

            this.renderTopbar();
            this.closeAuthModal();

            // Sincronizar dados do Drive
            await this.initialSync();

        } catch (err) {
            console.error('Error post-login:', err);
            this.app.showToast('Erro ao sincronizar com Google Drive.', 'error');
        } finally {
            if (btn) btn.disabled = false;
            if (txt) txt.textContent = 'Continuar com Conta Google';
        }
    }

    useOfflineDemo() {
        this.closeAuthModal();
        this.app.showToast('Modo demonstração ativado. As finanças ficarão salvas apenas neste navegador.', 'info');
    }

    logout() {
        if (!confirm('Deseja realmente sair da sua conta Google?')) return;
        
        if (this.tokenData && this.tokenData.access_token && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
            try {
                google.accounts.oauth2.revoke(this.tokenData.access_token, () => {});
            } catch (e) {}
        }

        this.user = null;
        this.tokenData = null;
        this.folderId = null;
        this.fileId = null;
        this.lastSyncTime = null;

        localStorage.removeItem('4u_google_user');
        localStorage.removeItem('4u_google_token');
        localStorage.removeItem('4u_drive_folder_id');
        localStorage.removeItem('4u_drive_file_id');
        localStorage.removeItem('4u_drive_last_sync');

        this.renderTopbar();
        this.openAuthModal();
        this.app.showToast('Você saiu da sua conta Google.', 'info');
    }

    renderTopbar() {
        const container = document.getElementById('googleAuthTopbar');
        if (!container) return;

        if (this.user) {
            const timeStr = this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            container.innerHTML = `
                <div class="drive-sync-pill ${this.isSyncing ? 'syncing' : ''}" 
                     id="driveSyncPill" 
                     onclick="app.googleDrive.syncManual()" 
                     title="Salvo no Google Drive. Clique para sincronizar agora.">
                    <i class="fas ${this.isSyncing ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'}"></i>
                    <span>${this.isSyncing ? 'Sincronizando...' : (timeStr ? 'Drive ' + timeStr : 'Drive Conectado')}</span>
                </div>
                
                <div class="google-user-capsule" title="${this.user.name} (${this.user.email})">
                    ${this.user.picture ? `<img src="${this.user.picture}" class="google-user-avatar" alt="Avatar">` : `<i class="fas fa-user-circle" style="font-size:1.3rem; color:#4285F4;"></i>`}
                    <span class="google-user-name">${this.user.name.split(' ')[0]}</span>
                    <button type="button" class="btn-logout-google" onclick="app.googleDrive.logout()" title="Sair da conta Google">
                        <i class="fas fa-arrow-right-from-bracket"></i>
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <button type="button" class="btn-login-google-topbar" onclick="app.googleDrive.openAuthModal()">
                    <i class="fab fa-google" style="color: #4285F4;"></i>
                    <span>Entrar com Google</span>
                </button>
            `;
        }
    }

    setSyncStatus(status, text) {
        this.isSyncing = (status === 'syncing');
        const pill = document.getElementById('driveSyncPill');
        if (pill) {
            pill.className = `drive-sync-pill ${status}`;
            const icon = (status === 'syncing') ? 'fa-spinner fa-spin' : (status === 'error' ? 'fa-triangle-exclamation' : 'fa-cloud-arrow-up');
            pill.innerHTML = `<i class="fas ${icon}"></i> <span>${text}</span>`;
        }
    }

    async getValidToken() {
        if (this.tokenData && this.tokenData.access_token) {
            if (!this.tokenData.expires_at || Date.now() < this.tokenData.expires_at - 60000) {
                return this.tokenData.access_token;
            }
        }
        if (this.user && this.ensureGISClient()) {
            return new Promise((resolve) => {
                this.tokenClient.callback = (resp) => {
                    if (resp && resp.access_token) {
                        this.tokenData = {
                            access_token: resp.access_token,
                            expires_at: Date.now() + ((parseInt(resp.expires_in) || 3599) * 1000)
                        };
                        localStorage.setItem('4u_google_token', JSON.stringify(this.tokenData));
                        resolve(resp.access_token);
                    } else {
                        resolve(null);
                    }
                };
                this.tokenClient.requestAccessToken({ prompt: '' });
            });
        }
        return null;
    }

    async getOrCreateAppFolder(token) {
        if (this.folderId) return this.folderId;

        const q = `name = '${this.FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (searchRes.ok) {
            const data = await searchRes.json();
            if (data.files && data.files.length > 0) {
                this.folderId = data.files[0].id;
                localStorage.setItem('4u_drive_folder_id', this.folderId);
                return this.folderId;
            }
        }

        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: this.FOLDER_NAME,
                mimeType: 'application/vnd.google-apps.folder'
            })
        });

        if (createRes.ok) {
            const folder = await createRes.json();
            this.folderId = folder.id;
            localStorage.setItem('4u_drive_folder_id', this.folderId);
            return this.folderId;
        }

        throw new Error('Falha ao criar pasta no Google Drive.');
    }

    async findDatabaseFile(token, folderId) {
        if (this.fileId) return this.fileId;

        const q = `name = '${this.FILE_NAME}' and '${folderId}' in parents and trashed = false`;
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            if (data.files && data.files.length > 0) {
                this.fileId = data.files[0].id;
                localStorage.setItem('4u_drive_file_id', this.fileId);
                return this.fileId;
            }
        }
        return null;
    }

    async initialSync() {
        const token = await this.getValidToken();
        if (!token) return;

        this.setSyncStatus('syncing', 'Conectando ao Drive...');

        try {
            const folderId = await this.getOrCreateAppFolder(token);
            const fileId = await this.findDatabaseFile(token, folderId);

            if (fileId) {
                const contentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (contentRes.ok) {
                    const cloudData = await contentRes.json();
                    if (cloudData && (cloudData.transactions || cloudData.accounts)) {
                        this.applyCloudDataToApp(cloudData);
                        this.lastSyncTime = new Date().toISOString();
                        localStorage.setItem('4u_drive_last_sync', this.lastSyncTime);
                        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        this.setSyncStatus('success', 'Drive ' + timeStr);
                        this.app.showToast('Finanças sincronizadas do Google Drive (Pasta: 4U Finance Pro)!', 'success');
                        return;
                    }
                }
            }

            await this.uploadToDrive(token, folderId, fileId);
            this.app.showToast('Pasta "4U Finance Pro" criada no seu Google Drive e dados salvos!', 'success');

        } catch (e) {
            console.error('Initial sync error:', e);
            this.setSyncStatus('error', 'Erro ao sincronizar');
        }
    }

    applyCloudDataToApp(cloudData) {
        if (cloudData.transactions) {
            this.app.transactions = cloudData.transactions;
            localStorage.setItem(this.app.STORAGE_TX, JSON.stringify(this.app.transactions));
        }
        if (cloudData.accounts) {
            this.app.accounts = cloudData.accounts;
            localStorage.setItem(this.app.STORAGE_ACCOUNTS, JSON.stringify(this.app.accounts));
        }
        if (cloudData.cards) {
            this.app.cards = cloudData.cards;
            localStorage.setItem(this.app.STORAGE_CARDS, JSON.stringify(this.app.cards));
        }
        if (cloudData.goals) {
            this.app.goals = cloudData.goals;
            localStorage.setItem(this.app.STORAGE_GOALS, JSON.stringify(this.app.goals));
        }
        if (cloudData.settings) {
            this.app.settings = { ...this.app.settings, ...cloudData.settings };
            localStorage.setItem(this.app.STORAGE_SETTINGS, JSON.stringify(this.app.settings));
        }

        localStorage.setItem('financial_seeded', 'true');
        this.app.populateAccountSelects();
        this.app.refreshAll();
    }

    buildPayload() {
        return {
            app: '4U Finance Pro',
            version: '2.0',
            exportedAt: new Date().toISOString(),
            user: this.user ? { name: this.user.name, email: this.user.email } : null,
            transactions: this.app.transactions,
            accounts: this.app.accounts,
            cards: this.app.cards,
            goals: this.app.goals,
            settings: this.app.settings
        };
    }

    async uploadToDrive(token, folderId, fileId) {
        this.setSyncStatus('syncing', 'Salvando no Drive...');
        const payload = this.buildPayload();
        const jsonContent = JSON.stringify(payload, null, 2);

        if (fileId) {
            const updateRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json; charset=UTF-8'
                },
                body: jsonContent
            });

            if (!updateRes.ok) throw new Error('Erro ao atualizar arquivo no Drive');
        } else {
            const boundary = '-------4UFinanceDriveBoundary314159';
            const delimiter = `\r\n--${boundary}\r\n`;
            const closeDelimiter = `\r\n--${boundary}--`;

            const metadata = {
                name: this.FILE_NAME,
                parents: [folderId],
                mimeType: 'application/json'
            };

            const multipartBody = 
                delimiter +
                'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                jsonContent +
                closeDelimiter;

            const createRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': `multipart/related; boundary=${boundary}`
                },
                body: multipartBody
            });

            if (!createRes.ok) throw new Error('Erro ao criar arquivo no Drive');
            const newFile = await createRes.json();
            this.fileId = newFile.id;
            localStorage.setItem('4u_drive_file_id', this.fileId);
        }

        this.lastSyncTime = new Date().toISOString();
        localStorage.setItem('4u_drive_last_sync', this.lastSyncTime);
        const timeStr = new Date(this.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        this.setSyncStatus('success', 'Drive ' + timeStr);
    }

    scheduleAutoSync() {
        if (!this.user) return;
        if (this.syncDebounceTimer) clearTimeout(this.syncDebounceTimer);

        this.setSyncStatus('syncing', 'Sincronizando...');

        this.syncDebounceTimer = setTimeout(async () => {
            try {
                const token = await this.getValidToken();
                if (!token) {
                    this.setSyncStatus('error', 'Reautenticar');
                    return;
                }
                const folderId = await this.getOrCreateAppFolder(token);
                const fileId = await this.findDatabaseFile(token, folderId);
                await this.uploadToDrive(token, folderId, fileId);
            } catch (err) {
                console.error('AutoSync error:', err);
                this.setSyncStatus('error', 'Falha ao salvar');
            }
        }, 1500);
    }

    async syncManual() {
        if (!this.user) {
            this.openAuthModal();
            return;
        }
        try {
            const token = await this.getValidToken();
            if (!token) {
                this.openAuthModal();
                return;
            }
            const folderId = await this.getOrCreateAppFolder(token);
            const fileId = await this.findDatabaseFile(token, folderId);
            await this.uploadToDrive(token, folderId, fileId);
            this.app.showToast('Dados sincronizados no Google Drive com sucesso!', 'success');
        } catch (e) {
            console.error('Manual sync error:', e);
            this.app.showToast('Erro ao sincronizar com Google Drive: ' + e.message, 'error');
        }
    }

    async restoreFromDrive() {
        if (!this.user) {
            this.openAuthModal();
            return;
        }
        if (!confirm('Deseja recarregar os dados do seu Google Drive? As alterações locais não salvas na nuvem serão substituídas.')) return;

        try {
            const token = await this.getValidToken();
            if (!token) {
                this.openAuthModal();
                return;
            }
            const folderId = await this.getOrCreateAppFolder(token);
            const fileId = await this.findDatabaseFile(token, folderId);
            if (!fileId) {
                this.app.showToast('Nenhum arquivo de banco de dados encontrado no Google Drive.', 'warning');
                return;
            }

            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const cloudData = await res.json();
                this.applyCloudDataToApp(cloudData);
                this.app.showToast('Dados recarregados da nuvem com sucesso!', 'success');
            } else {
                throw new Error('Falha ao baixar arquivo');
            }
        } catch (e) {
            console.error('Restore error:', e);
            this.app.showToast('Falha ao recarregar dados do Drive: ' + e.message, 'error');
        }
    }

    openDriveFolder() {
        if (this.folderId) {
            window.open(`https://drive.google.com/drive/folders/${this.folderId}`, '_blank');
        } else {
            window.open('https://drive.google.com/drive/u/0/my-drive', '_blank');
        }
    }
}

class FinanceProApp {
    constructor() {
        // Storage Keys
        this.STORAGE_TX = 'financial-transactions';
        this.STORAGE_ACCOUNTS = 'financial-accounts-v2';
        this.STORAGE_CARDS = 'financial-cards-v2';
        this.STORAGE_GOALS = 'financial-goals';
        this.STORAGE_SETTINGS = 'financial-settings-v2';

        // Load or Initialize State
        this.transactions = this.loadData(this.STORAGE_TX) || [];
        this.accounts = this.loadData(this.STORAGE_ACCOUNTS) || this.getDefaultAccounts();
        this.cards = this.loadData(this.STORAGE_CARDS) || this.getDefaultCards();
        this.goals = this.loadData(this.STORAGE_GOALS) || [];
        this.settings = this.loadData(this.STORAGE_SETTINGS) || {
            privacyMode: false,
            selectedMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
            activeAccountFilter: null
        };

        // Charts Registry
        this.charts = {
            cashFlow: null,
            category: null
        };

        this.editingTxId = null;
        this.deleteTxId = null;
        this.googleDrive = new GoogleDriveSync(this);

        this.init();
    }

    // Default Starting Accounts
    getDefaultAccounts() {
        return [
            { id: 'nubank', name: 'Nubank', type: 'bank', balance: 0, color: '#820ad1', icon: '🟣' },
            { id: 'itau', name: 'Itaú', type: 'bank', balance: 0, color: '#ec7000', icon: '🟠' },
            { id: 'carteira', name: 'Carteira (Dinheiro)', type: 'cash', balance: 0, color: '#10b981', icon: '💵' },
            { id: 'investimentos', name: 'Investimentos & Reserva', type: 'investment', balance: 0, color: '#06b6d4', icon: '📈' }
        ];
    }

    getDefaultCards() {
        return [
            { id: 'nubank_card', name: 'Nubank Roxinho', limit: 5000, closingDay: 25, dueDay: 5, color: '#820ad1' }
        ];
    }

    init() {
        this.applyPrivacyMode(this.settings.privacyMode);
        this.renderMonthSelector();
        this.populateAccountSelects();
        this.renderAccountsStrip();
        this.setupEventListeners();
        this.setDefaultFormDate();
        if (this.transactions.length === 0 && !localStorage.getItem('financial_seeded')) {
            localStorage.setItem('financial_seeded', 'true');
            this.loadDemoData();
        } else {
            this.refreshAll();
        }

        // Inicializa autenticação Google e sincronização Google Drive
        this.googleDrive.init();
    }

    // ==========================================================================
    // REFRESH & AGGREGATION PIPELINE
    // ==========================================================================
    refreshAll() {
        this.renderAccountsStrip();
        this.updateKPIs();
        this.renderBudgetRule503020();
        this.renderTransactionsLedger();
        this.renderCharts();
        this.saveState();
    }

    saveState() {
        this.saveData(this.STORAGE_TX, this.transactions);
        this.saveData(this.STORAGE_ACCOUNTS, this.accounts);
        this.saveData(this.STORAGE_CARDS, this.cards);
        this.saveData(this.STORAGE_SETTINGS, this.settings);
    }

    // ==========================================================================
    // MONTH & NAVIGATION
    // ==========================================================================
    renderMonthSelector() {
        const displayEl = document.getElementById('currentMonthDisplay');
        if (!displayEl) return;

        const [year, month] = this.settings.selectedMonth.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        const monthName = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        displayEl.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    }

    navigateMonth(delta) {
        const [year, month] = this.settings.selectedMonth.split('-').map(Number);
        const date = new Date(year, month - 1 + delta, 1);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        this.settings.selectedMonth = `${y}-${m}`;
        this.renderMonthSelector();
        this.refreshAll();
    }

    goToCurrentMonth() {
        this.settings.selectedMonth = new Date().toISOString().slice(0, 7);
        this.renderMonthSelector();
        this.refreshAll();
        this.showToast('Visualizando o mês atual');
    }

    // ==========================================================================
    // PRIVACY MODE (EYE TOGGLE)
    // ==========================================================================
    togglePrivacyMode() {
        this.settings.privacyMode = !this.settings.privacyMode;
        this.applyPrivacyMode(this.settings.privacyMode);
        this.saveState();
        this.showToast(this.settings.privacyMode ? 'Modo Privacidade ATIVADO 🔒' : 'Valores visíveis 👁️');
    }

    applyPrivacyMode(isPrivate) {
        document.body.setAttribute('data-private', isPrivate ? 'true' : 'false');
        const eyeBtn = document.getElementById('btnPrivacyToggle');
        if (eyeBtn) {
            eyeBtn.innerHTML = isPrivate ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
            eyeBtn.title = isPrivate ? 'Modo Privacidade Ativo (Clique para mostrar)' : 'Ocultar valores monetários';
            eyeBtn.classList.toggle('active', isPrivate);
        }
    }

    // ==========================================================================
    // ACCOUNTS & WALLETS STRIP
    // ==========================================================================
    renderAccountsStrip() {
        const container = document.getElementById('accountsStripContainer');
        if (!container) return;

        // Calculate balances dynamically per account
        const accountBalances = {};
        this.accounts.forEach(a => accountBalances[a.id] = (a.balance || 0));

        this.transactions.forEach(t => {
            const amt = Number(t.amount) || 0;
            if (t.status === 'paid' || !t.status) {
                if (t.type === 'income' && t.accountId && accountBalances[t.accountId] !== undefined) {
                    accountBalances[t.accountId] += amt;
                } else if (t.type === 'expense' && t.accountId && accountBalances[t.accountId] !== undefined) {
                    accountBalances[t.accountId] -= amt;
                } else if (t.type === 'transfer') {
                    if (t.accountId && accountBalances[t.accountId] !== undefined) {
                        accountBalances[t.accountId] -= amt;
                    }
                    if (t.destinationAccountId && accountBalances[t.destinationAccountId] !== undefined) {
                        accountBalances[t.destinationAccountId] += amt;
                    }
                }
            }
        });

        let html = '';
        this.accounts.forEach(acc => {
            const bal = accountBalances[acc.id] || 0;
            const isFiltered = (this.settings.activeAccountFilter === acc.id);
            html += `
                <div class="account-pill-card glass ${isFiltered ? 'active-filter' : ''}" onclick="app.filterByAccount('${acc.id}')">
                    <div class="account-icon-box" style="background: ${acc.color}22; color: ${acc.color};">
                        ${acc.icon || '🏦'}
                    </div>
                    <div class="account-info">
                        <div class="account-name">${this.escapeHtml(acc.name)}</div>
                        <div class="account-balance privacy-mask" style="color: ${bal >= 0 ? '#ffffff' : 'var(--text-rose)'};">
                            ${this.formatCurrency(bal)}
                        </div>
                    </div>
                </div>
            `;
        });

        // Add Account Button
        html += `
            <button type="button" class="btn-add-account" onclick="app.openModal('modalAccount')">
                <i class="fas fa-plus"></i> Nova Conta
            </button>
        `;

        container.innerHTML = html;
    }

    filterByAccount(accId) {
        if (this.settings.activeAccountFilter === accId) {
            this.settings.activeAccountFilter = null;
            this.showToast('Exibindo todas as contas');
        } else {
            this.settings.activeAccountFilter = accId;
            const acc = this.accounts.find(a => a.id === accId);
            this.showToast(`Filtrado por: ${acc ? acc.name : accId}`);
        }
        this.renderAccountsStrip();
        this.refreshAll();
    }

    populateAccountSelects() {
        const select = document.getElementById('txAccount');
        const destSelect = document.getElementById('txDestAccount');
        if (!select) return;

        let opts = '';
        this.accounts.forEach(a => {
            opts += `<option value="${a.id}">${a.icon || '🏦'} ${this.escapeHtml(a.name)}</option>`;
        });

        select.innerHTML = opts;
        if (destSelect) destSelect.innerHTML = opts;
    }

    // ==========================================================================
    // KPIS & CASH FLOW AGGREGATIONS
    // ==========================================================================
    updateKPIs() {
        const currentMonth = this.settings.selectedMonth;
        
        // Month Transactions
        const monthTxs = this.transactions.filter(t => {
            const matchesMonth = t.date.startsWith(currentMonth);
            const matchesAccount = !this.settings.activeAccountFilter || 
                                   t.accountId === this.settings.activeAccountFilter ||
                                   t.destinationAccountId === this.settings.activeAccountFilter;
            return matchesMonth && matchesAccount;
        });

        // Previous Month for Delta calculation
        const [y, m] = currentMonth.split('-').map(Number);
        const prevDate = new Date(y, m - 2, 1);
        const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
        const prevMonthTxs = this.transactions.filter(t => t.date.startsWith(prevMonthStr));

        // Income & Expenses
        const currentIncome = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const currentExpense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const prevIncome = prevMonthTxs.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const prevExpense = prevMonthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);

        // Projected (includes pending/agendadas until end of month)
        const pendingIncome = monthTxs.filter(t => t.type === 'income' && t.status === 'pending').reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const pendingExpense = monthTxs.filter(t => t.type === 'expense' && t.status === 'pending').reduce((s, t) => s + (Number(t.amount) || 0), 0);

        // Consolidated Net Worth (All accounts sum)
        const totalNetWorth = this.accounts.reduce((s, a) => s + (a.balance || 0), 0) + 
            this.transactions.reduce((s, t) => {
                const amt = Number(t.amount) || 0;
                if (t.status === 'paid' || !t.status) {
                    if (t.type === 'income') return s + amt;
                    if (t.type === 'expense') return s - amt;
                }
                return s;
            }, 0);

        // Month Balance Result
        const monthResult = currentIncome - currentExpense;
        const projectedResult = (currentIncome + pendingIncome) - (currentExpense + pendingExpense);

        // Update DOM
        const elNetWorth = document.getElementById('kpiTotalBalance');
        const elIncome = document.getElementById('kpiMonthIncome');
        const elExpense = document.getElementById('kpiMonthExpense');
        const elForecast = document.getElementById('kpiMonthForecast');

        if (elNetWorth) elNetWorth.textContent = this.formatCurrency(totalNetWorth);
        if (elIncome) elIncome.textContent = this.formatCurrency(currentIncome);
        if (elExpense) elExpense.textContent = this.formatCurrency(currentExpense);
        if (elForecast) elForecast.textContent = this.formatCurrency(projectedResult);

        // Update Delta Badges
        this.renderDeltaBadge('kpiIncomeDelta', currentIncome, prevIncome, true);
        this.renderDeltaBadge('kpiExpenseDelta', currentExpense, prevExpense, false);
    }

    renderDeltaBadge(elementId, current, prev, isIncome) {
        const el = document.getElementById(elementId);
        if (!el) return;

        if (prev <= 0) {
            el.className = 'kpi-badge neutral';
            el.innerHTML = '<i class="fas fa-minus"></i> Sem base ant.';
            return;
        }

        const diffPct = ((current - prev) / prev) * 100;
        const isUp = diffPct >= 0;
        const isGood = isIncome ? isUp : !isUp;

        el.className = `kpi-badge ${isGood ? 'up' : 'down'}`;
        el.innerHTML = `
            <i class="fas fa-arrow-${isUp ? 'up' : 'down'}"></i> 
            ${Math.abs(diffPct).toFixed(1)}% vs mês ant.
        `;
    }

    // ==========================================================================
    // 50 / 30 / 20 FINANCIAL RULE GAUGE
    // ==========================================================================
    renderBudgetRule503020() {
        const currentMonth = this.settings.selectedMonth;
        const expenses = this.transactions.filter(t => t.type === 'expense' && t.date.startsWith(currentMonth));
        const totalExpense = expenses.reduce((s, t) => s + (Number(t.amount) || 0), 0);

        let necAmt = 0; // 50%
        let desAmt = 0; // 30%
        let invAmt = 0; // 20%

        expenses.forEach(t => {
            const amt = Number(t.amount) || 0;
            const macro = t.macroCategory || this.guessMacroCategory(t.category);
            if (macro === 'necessidade') necAmt += amt;
            else if (macro === 'desejo') desAmt += amt;
            else if (macro === 'investimento') invAmt += amt;
            else necAmt += amt; // default fallback
        });

        const necPct = totalExpense > 0 ? (necAmt / totalExpense) * 100 : 0;
        const desPct = totalExpense > 0 ? (desAmt / totalExpense) * 100 : 0;
        const invPct = totalExpense > 0 ? (invAmt / totalExpense) * 100 : 0;

        const segNec = document.getElementById('segNecessity');
        const segDes = document.getElementById('segDesire');
        const segInv = document.getElementById('segInvest');

        if (segNec) segNec.style.width = `${necPct}%`;
        if (segDes) segDes.style.width = `${desPct}%`;
        if (segInv) segInv.style.width = `${invPct}%`;

        const valNec = document.getElementById('valNecessity');
        const valDes = document.getElementById('valDesire');
        const valInv = document.getElementById('valInvest');

        if (valNec) valNec.textContent = `${this.formatCurrency(necAmt)} (${necPct.toFixed(0)}%)`;
        if (valDes) valDes.textContent = `${this.formatCurrency(desAmt)} (${desPct.toFixed(0)}%)`;
        if (valInv) valInv.textContent = `${this.formatCurrency(invAmt)} (${invPct.toFixed(0)}%)`;
    }

    guessMacroCategory(categoryName) {
        const cat = (categoryName || '').toLowerCase();
        if (cat.includes('aliment') || cat.includes('moradia') || cat.includes('saúde') || cat.includes('transporte') || cat.includes('conta') || cat.includes('educa')) {
            return 'necessidade';
        }
        if (cat.includes('lazer') || cat.includes('compra') || cat.includes('restaurante') || cat.includes('streaming') || cat.includes('viagem')) {
            return 'desejo';
        }
        if (cat.includes('invest') || cat.includes('reserva') || cat.includes('poupança') || cat.includes('ações') || cat.includes('cripto')) {
            return 'investimento';
        }
        return 'necessidade';
    }

    // ==========================================================================
    // TRANSACTIONS LEDGER (CRUD & PARCELAMENTO)
    // ==========================================================================
    renderTransactionsLedger() {
        const container = document.getElementById('transactionsLedgerList');
        if (!container) return;

        const currentMonth = this.settings.selectedMonth;
        const searchQuery = (document.getElementById('txSearchInput')?.value || '').toLowerCase().trim();

        let filtered = this.transactions.filter(t => {
            const matchesMonth = t.date.startsWith(currentMonth);
            const matchesAccount = !this.settings.activeAccountFilter || 
                                   t.accountId === this.settings.activeAccountFilter || 
                                   t.destinationAccountId === this.settings.activeAccountFilter;
            const matchesSearch = !searchQuery || 
                                  t.description.toLowerCase().includes(searchQuery) || 
                                  (t.category && t.category.toLowerCase().includes(searchQuery));
            return matchesMonth && matchesAccount && matchesSearch;
        });

        // Sort descending by date
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-ledger-box">
                    <div class="empty-ledger-icon">📋</div>
                    <h3>Nenhum lançamento encontrado em ${this.settings.selectedMonth}</h3>
                    <p style="font-size: 0.85rem; margin-top: 6px; margin-bottom: 16px;">Adicione uma nova receita ou despesa acima ou importe um extrato bancário.</p>
                    <button type="button" class="btn-ghost-action" onclick="app.loadDemoData()" style="border-color: var(--accent-emerald); color: var(--accent-emerald); display: inline-flex; align-items: center; gap: 8px;">
                        <i class="fas fa-wand-magic-sparkles"></i> Carregar Dados de Demonstração
                    </button>
                </div>
            `;
            return;
        }

        let html = '';
        filtered.forEach(t => {
            const isIncome = (t.type === 'income');
            const isTransfer = (t.type === 'transfer');
            const isPaid = (t.status === 'paid' || !t.status);
            const icon = this.getTransactionIcon(t);
            const accountObj = this.accounts.find(a => a.id === t.accountId);
            const accountName = accountObj ? accountObj.name : 'Conta Padrão';

            html += `
                <div class="tx-row" id="tx_row_${t.id}">
                    <div class="tx-icon-box ${t.type}">
                        ${icon}
                    </div>
                    <div class="tx-details">
                        <div class="tx-title">
                            <span>${this.escapeHtml(t.description)}</span>
                            ${t.isInstallment ? `<span class="tx-badge installment">Parcela ${t.installmentIndex}/${t.installmentTotal}</span>` : ''}
                            ${t.isRecurring ? `<span class="tx-badge">🔁 Recorrente</span>` : ''}
                            <span class="tx-status-pill ${isPaid ? 'paid' : 'pending'}" onclick="app.toggleTxStatus('${t.id}')">
                                ${isPaid ? '✓ Pago' : '⏳ Agendado'}
                            </span>
                        </div>
                        <div class="tx-meta">
                            <span><i class="far fa-calendar-alt"></i> ${this.formatDate(t.date)}</span>
                            <span><i class="fas fa-tag"></i> ${this.escapeHtml(t.category || 'Geral')}</span>
                            <span><i class="fas fa-university"></i> ${this.escapeHtml(accountName)}</span>
                            ${isTransfer && t.destinationAccountId ? `<span>➔ ${this.escapeHtml((this.accounts.find(a => a.id === t.destinationAccountId) || {}).name || '')}</span>` : ''}
                        </div>
                    </div>
                    <div class="tx-amount ${t.type} privacy-mask">
                        ${isIncome ? '+' : (isTransfer ? '⇄ ' : '-')}${this.formatCurrency(t.amount)}
                    </div>
                    <div class="tx-actions">
                        <button type="button" class="btn-tx-action" title="Editar" onclick="app.editTransaction('${t.id}')">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button type="button" class="btn-tx-action delete" title="Excluir" onclick="app.deleteTransaction('${t.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    handleTransactionSubmit(e) {
        e.preventDefault();
        const type = document.getElementById('txType').value;
        const description = document.getElementById('txDescription').value.trim();
        const amount = parseFloat(document.getElementById('txAmount').value);
        const category = document.getElementById('txCategory').value;
        const date = document.getElementById('txDate').value;
        const accountId = document.getElementById('txAccount').value;
        const destAccountId = document.getElementById('txDestAccount') ? document.getElementById('txDestAccount').value : null;
        const isInstallment = document.getElementById('chkInstallment').checked;
        const installmentCount = parseInt(document.getElementById('txInstallmentsCount').value) || 1;
        const isRecurring = document.getElementById('chkRecurring').checked;
        const status = document.getElementById('txStatus').value || 'paid';

        if (!description || isNaN(amount) || amount <= 0 || !date) {
            this.showToast('Preencha os campos obrigatórios com valores válidos.', 'error');
            return;
        }

        const macroCategory = this.guessMacroCategory(category);

        if (this.editingTxId) {
            // Update existing single transaction
            const idx = this.transactions.findIndex(t => t.id === this.editingTxId);
            if (idx !== -1) {
                this.transactions[idx] = {
                    ...this.transactions[idx],
                    type,
                    description,
                    amount,
                    category,
                    macroCategory,
                    date,
                    accountId,
                    destinationAccountId: destAccountId,
                    status
                };
                this.showToast('Lançamento atualizado com sucesso!', 'success');
            }
            this.editingTxId = null;
            document.getElementById('btnSubmitTx').innerHTML = '<i class="fas fa-plus"></i> Adicionar Lançamento';
        } else if (isInstallment && installmentCount > 1) {
            // Generate multiple installment entries
            const parentId = 'inst_' + Date.now();
            const [baseY, baseM, baseD] = date.split('-').map(Number);

            for (let i = 1; i <= installmentCount; i++) {
                const targetDate = new Date(baseY, baseM - 1 + (i - 1), baseD);
                const ty = targetDate.getFullYear();
                const tm = String(targetDate.getMonth() + 1).padStart(2, '0');
                const td = String(targetDate.getDate()).padStart(2, '0');
                const instDateStr = `${ty}-${tm}-${td}`;

                this.transactions.push({
                    id: 'tx_' + Date.now() + '_' + i,
                    parentId,
                    type,
                    description: `${description} (${i}/${installmentCount})`,
                    amount,
                    category,
                    macroCategory,
                    date: instDateStr,
                    accountId,
                    destinationAccountId: destAccountId,
                    status: (i === 1) ? status : 'pending',
                    isInstallment: true,
                    installmentIndex: i,
                    installmentTotal: installmentCount
                });
            }
            this.showToast(`${installmentCount} parcelas geradas com sucesso!`, 'success');
        } else {
            // Single transaction
            this.transactions.push({
                id: 'tx_' + Date.now() + Math.random().toString(36).substr(2, 4),
                type,
                description,
                amount,
                category,
                macroCategory,
                date,
                accountId,
                destinationAccountId: destAccountId,
                status,
                isRecurring
            });
            this.showToast('Lançamento registrado!', 'success');
        }

        // Reset Form
        this.resetTxForm();
        this.refreshAll();
    }

    toggleTxStatus(id) {
        const tx = this.transactions.find(t => t.id === id);
        if (tx) {
            tx.status = (tx.status === 'paid' || !tx.status) ? 'pending' : 'paid';
            this.refreshAll();
            this.showToast(tx.status === 'paid' ? 'Marcado como Pago ✓' : 'Marcado como Agendado ⏳');
        }
    }

    editTransaction(id) {
        const tx = this.transactions.find(t => t.id === id);
        if (!tx) return;

        this.editingTxId = id;
        this.setType(tx.type);
        document.getElementById('txDescription').value = tx.description;
        document.getElementById('txAmount').value = tx.amount;
        document.getElementById('txCategory').value = tx.category || '';
        document.getElementById('txDate').value = tx.date;
        document.getElementById('txAccount').value = tx.accountId || 'carteira';
        if (document.getElementById('txStatus')) document.getElementById('txStatus').value = tx.status || 'paid';

        document.getElementById('btnSubmitTx').innerHTML = '<i class="fas fa-check"></i> Salvar Alterações';
        document.getElementById('transactionForm').scrollIntoView({ behavior: 'smooth' });
    }

    deleteTransaction(id) {
        if (confirm('Deseja realmente excluir este lançamento?')) {
            this.transactions = this.transactions.filter(t => t.id !== id);
            this.refreshAll();
            this.showToast('Lançamento removido.');
        }
    }

    setType(type) {
        document.getElementById('txType').value = type;
        document.querySelectorAll('.type-pill-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        const destGroup = document.getElementById('groupDestAccount');
        if (destGroup) {
            destGroup.style.display = (type === 'transfer') ? 'flex' : 'none';
        }
    }

    resetTxForm() {
        document.getElementById('transactionForm').reset();
        this.editingTxId = null;
        this.setDefaultFormDate();
        this.setType('expense');
        document.getElementById('chkInstallment').checked = false;
        document.getElementById('subgroupInstallments').classList.remove('open');
        document.getElementById('chkRecurring').checked = false;
        document.getElementById('btnSubmitTx').innerHTML = '<i class="fas fa-plus"></i> Adicionar Lançamento';
    }

    setDefaultFormDate() {
        const dateInput = document.getElementById('txDate');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    }

    getTransactionIcon(tx) {
        const icons = {
            'Alimentação': '🍽️',
            'Supermercado': '🛒',
            'Transporte': '🚗',
            'Uber': '🚕',
            'Saúde': '🩺',
            'Farmácia': '💊',
            'Moradia': '🏠',
            'Contas': '📄',
            'Lazer': '🎮',
            'Streaming': '📺',
            'Salário': '💼',
            'Freelance': '💻',
            'Investimentos': '📈',
            'Transferência': '⇄',
            'Compras': '🛍️',
            'Educação': '📚'
        };
        return icons[tx.category] || (tx.type === 'income' ? '💰' : (tx.type === 'transfer' ? '⇄' : '💸'));
    }

    // ==========================================================================
    // OFX BANK STATEMENT PARSER (NUBANK, ITAÚ, INTER, BRASIL)
    // ==========================================================================
    handleOFXFile(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const parsedTxs = this.parseOFXContent(text);
                if (parsedTxs.length === 0) {
                    this.showToast('Nenhuma transação encontrada no arquivo OFX.', 'error');
                    return;
                }
                this.showOFXImportPreviewModal(parsedTxs);
            } catch (err) {
                console.error(err);
                this.showToast('Erro ao processar o arquivo OFX.', 'error');
            }
        };
        reader.readAsText(file, 'ISO-8859-1'); // Most Brazilian bank OFXs use ISO-8859-1 or UTF-8
    }

    parseOFXContent(ofxString) {
        const transactions = [];
        const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
        let match;

        while ((match = trnRegex.exec(ofxString)) !== null) {
            const block = match[1];

            const typeMatch = /<TRNTYPE>([^<\r\n]+)/i.exec(block);
            const dateMatch = /<DTPOSTED>([0-9]{8})/i.exec(block);
            const amountMatch = /<TRNAMT>([^<\r\n]+)/i.exec(block);
            const idMatch = /<FITID>([^<\r\n]+)/i.exec(block);
            const memoMatch = /<MEMO>([^<\r\n]+)/i.exec(block) || /<NAME>([^<\r\n]+)/i.exec(block);

            if (amountMatch && dateMatch) {
                const rawAmount = parseFloat(amountMatch[1].replace(',', '.'));
                const rawDate = dateMatch[1]; // YYYYMMDD
                const formattedDate = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
                const memo = memoMatch ? memoMatch[1].trim() : 'Transação Bancária';
                const fitid = idMatch ? idMatch[1].trim() : '';

                const isIncome = rawAmount > 0;
                const absAmount = Math.abs(rawAmount);

                const detectedCategory = this.autoCategorizeMemo(memo);
                const macroCategory = this.guessMacroCategory(detectedCategory);

                transactions.push({
                    fitid,
                    type: isIncome ? 'income' : 'expense',
                    description: memo,
                    amount: absAmount,
                    category: detectedCategory,
                    macroCategory,
                    date: formattedDate,
                    status: 'paid'
                });
            }
        }

        return transactions;
    }

    autoCategorizeMemo(memo) {
        const m = memo.toLowerCase();
        if (m.includes('uber') || m.includes('99app') || m.includes('posto') || m.includes('combustivel') || m.includes('gasolina') || m.includes('estapar') || m.includes('sem parar')) return 'Transporte';
        if (m.includes('ifood') || m.includes('mercado') || m.includes('pao de acucar') || m.includes('carrefour') || m.includes('supermercado') || m.includes('padaria') || m.includes('restaurante') || m.includes('burger') || m.includes('mcdonald')) return 'Alimentação';
        if (m.includes('farmacia') || m.includes('droga') || m.includes('hospital') || m.includes('laboratorio') || m.includes('medico') || m.includes('unimed')) return 'Saúde';
        if (m.includes('netflix') || m.includes('spotify') || m.includes('prime') || m.includes('amazon') || m.includes('cinema') || m.includes('steam') || m.includes('playstation')) return 'Streaming';
        if (m.includes('aluguel') || m.includes('condominio') || m.includes('enel') || m.includes('sabesp') || m.includes('cpfl') || m.includes('luz') || m.includes('agua') || m.includes('internet') || m.includes('claro') || m.includes('vivo')) return 'Moradia';
        if (m.includes('renner') || m.includes('zara') || m.includes('shein') || m.includes('shopee') || m.includes('mercado livre') || m.includes('magalu')) return 'Compras';
        if (m.includes('salario') || m.includes('pro-labore') || m.includes('ted recebida') || m.includes('pix recebido') || m.includes('rendimento')) return 'Salário';
        if (m.includes('tesouro') || m.includes('cdb') || m.includes('nu invest') || m.includes('xp') || m.includes('binance') || m.includes('invest')) return 'Investimentos';
        return 'Geral';
    }

    showOFXImportPreviewModal(txList) {
        this.pendingOFXTxs = txList;
        const modal = document.getElementById('modalOFXPreview');
        const listEl = document.getElementById('ofxPreviewList');
        const countEl = document.getElementById('ofxTotalCount');

        if (countEl) countEl.textContent = `${txList.length} transações identificadas`;

        if (listEl) {
            let html = '';
            txList.slice(0, 50).forEach((t, i) => {
                html += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--border-subtle); font-size: 0.85rem;">
                        <div>
                            <strong>${this.escapeHtml(t.description)}</strong>
                            <div style="color: var(--text-muted); font-size: 0.75rem;">${t.date} • Categoria: ${t.category}</div>
                        </div>
                        <div style="font-weight: 700; color: ${t.type === 'income' ? 'var(--text-emerald)' : 'var(--text-rose)'};">
                            ${t.type === 'income' ? '+' : '-'}${this.formatCurrency(t.amount)}
                        </div>
                    </div>
                `;
            });
            if (txList.length > 50) {
                html += `<div style="text-align: center; padding: 8px; color: var(--text-muted); font-size: 0.8rem;">... e mais ${txList.length - 50} transações</div>`;
            }
            listEl.innerHTML = html;
        }

        this.openModal('modalOFXPreview');
    }

    confirmOFXImport() {
        if (!this.pendingOFXTxs || this.pendingOFXTxs.length === 0) return;

        const targetAccount = document.getElementById('ofxTargetAccount')?.value || 'nubank';
        let importedCount = 0;

        this.pendingOFXTxs.forEach(t => {
            // Deduplication check by fitid
            const exists = t.fitid && this.transactions.some(existing => existing.fitid === t.fitid);
            if (!exists) {
                this.transactions.push({
                    id: 'tx_ofx_' + Date.now() + Math.random().toString(36).substr(2, 4),
                    ...t,
                    accountId: targetAccount
                });
                importedCount++;
            }
        });

        this.closeModal('modalOFXPreview');
        this.pendingOFXTxs = null;
        this.refreshAll();
        this.showToast(`✓ Sucesso! ${importedCount} lançamentos importados.`, 'success');
    }

    // ==========================================================================
    // BACKUP & RESTORE (JSON FULL DUMP)
    // ==========================================================================
    exportFullBackupJSON() {
        const fullBackup = {
            version: '2.0',
            exportedAt: new Date().toISOString(),
            transactions: this.transactions,
            accounts: this.accounts,
            cards: this.cards,
            goals: this.goals,
            settings: this.settings
        };

        const jsonStr = JSON.stringify(fullBackup, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `4u_finance_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        this.showToast('Backup completo em JSON exportado!');
    }

    handleJSONBackupRestore(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.transactions && Array.isArray(data.transactions)) {
                    this.transactions = data.transactions;
                    if (data.accounts) this.accounts = data.accounts;
                    if (data.cards) this.cards = data.cards;
                    if (data.goals) this.goals = data.goals;
                    if (data.settings) this.settings = data.settings;

                    this.refreshAll();
                    this.showToast('✓ Backup restaurado com 100% de sucesso!', 'success');
                } else {
                    this.showToast('Arquivo de backup inválido.', 'error');
                }
            } catch (err) {
                this.showToast('Erro ao ler arquivo de backup JSON.', 'error');
            }
        };
        reader.readAsText(file);
    }

    exportCSV() {
        if (this.transactions.length === 0) {
            this.showToast('Nenhum dado para exportar.', 'error');
            return;
        }

        const headers = ['Data', 'Tipo', 'Descrição', 'Categoria', 'MacroCategoria (50/30/20)', 'Valor', 'Conta', 'Status'];
        const rows = this.transactions.map(t => {
            const acc = this.accounts.find(a => a.id === t.accountId);
            return [
                t.date,
                t.type === 'income' ? 'Receita' : (t.type === 'transfer' ? 'Transferência' : 'Despesa'),
                `"${(t.description || '').replace(/"/g, '""')}"`,
                `"${(t.category || 'Geral').replace(/"/g, '""')}"`,
                t.macroCategory || 'necessidade',
                (Number(t.amount) || 0).toFixed(2).replace('.', ','),
                acc ? `"${acc.name}"` : 'Padrão',
                t.status === 'paid' ? 'Pago' : 'Agendado'
            ].join(';');
        });

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `financeiro_extrato_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        this.showToast('Extrato CSV exportado com sucesso!');
    }

    // ==========================================================================
    // EXECUTIVE PDF REPORT GENERATOR (jsPDF)
    // ==========================================================================
    exportExecutivePDF() {
        if (typeof window.jspdf === 'undefined') {
            this.showToast('Biblioteca de PDF carregando. Tente em instantes.', 'error');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const currentMonth = this.settings.selectedMonth;

        const [y, m] = currentMonth.split('-').map(Number);
        const monthName = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

        const monthTxs = this.transactions.filter(t => t.date.startsWith(currentMonth));
        const totalIncome = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const totalExpense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const balance = totalIncome - totalExpense;

        // Background Theme Cover
        doc.setFillColor(11, 15, 25); // #0b0f19
        doc.rect(0, 0, 210, 297, 'F');

        // Header Banner
        doc.setFillColor(17, 24, 39);
        doc.roundedRect(14, 14, 182, 30, 4, 4, 'F');

        // Logo text
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(16, 185, 129); // #10b981
        doc.text('4U FINANCE PRO', 22, 27);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.text(`Relatório Financeiro Executivo — ${monthName.toUpperCase()}`, 22, 36);

        // Date of export
        doc.setFontSize(8);
        doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 130, 27);

        // KPI Summary Cards
        // Card 1: Receitas
        doc.setFillColor(16, 185, 129, 0.1);
        doc.roundedRect(14, 50, 56, 24, 3, 3, 'F');
        doc.setFontSize(8);
        doc.setTextColor(52, 211, 153);
        doc.text('RECEITAS TOTAIS', 18, 57);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(this.formatCurrency(totalIncome), 18, 67);

        // Card 2: Despesas
        doc.setFillColor(244, 63, 94, 0.1);
        doc.roundedRect(77, 50, 56, 24, 3, 3, 'F');
        doc.setFontSize(8);
        doc.setTextColor(251, 113, 133);
        doc.text('DESPESAS TOTAIS', 81, 57);
        doc.setFontSize(13);
        doc.text(this.formatCurrency(totalExpense), 81, 67);

        // Card 3: Saldo
        doc.setFillColor(139, 92, 246, 0.1);
        doc.roundedRect(140, 50, 56, 24, 3, 3, 'F');
        doc.setFontSize(8);
        doc.setTextColor(167, 139, 250);
        doc.text('SALDO OPERACIONAL', 144, 57);
        doc.setFontSize(13);
        doc.text(this.formatCurrency(balance), 144, 67);

        // Section: 50 / 30 / 20 Rule Breakdown
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(248, 250, 252);
        doc.text('Distribuição do Orçamento (Regra 50 / 30 / 20)', 14, 85);

        let yPos = 94;
        const categoriesMap = {};
        monthTxs.filter(t => t.type === 'expense').forEach(t => {
            const cat = t.category || 'Geral';
            categoriesMap[cat] = (categoriesMap[cat] || 0) + Number(t.amount);
        });

        // Top 5 Categories Table Header
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text('Categoria', 18, yPos);
        doc.text('Valor Gasto', 120, yPos);
        doc.text('% do Total', 165, yPos);
        yPos += 3;
        doc.setDrawColor(255, 255, 255, 0.1);
        doc.line(14, yPos, 196, yPos);
        yPos += 6;

        const sortedCats = Object.entries(categoriesMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
        doc.setFont('helvetica', 'normal');
        sortedCats.forEach(([cat, val]) => {
            const pct = totalExpense > 0 ? (val / totalExpense) * 100 : 0;
            doc.setTextColor(248, 250, 252);
            doc.text(cat, 18, yPos);
            doc.text(this.formatCurrency(val), 120, yPos);
            doc.text(`${pct.toFixed(1)}%`, 165, yPos);
            yPos += 7;
        });

        // Itemized Transactions Header
        yPos += 6;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(248, 250, 252);
        doc.text('Extrato de Lançamentos do Período', 14, yPos);
        yPos += 8;

        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('Data', 18, yPos);
        doc.text('Descrição', 42, yPos);
        doc.text('Categoria', 110, yPos);
        doc.text('Valor', 165, yPos);
        yPos += 3;
        doc.line(14, yPos, 196, yPos);
        yPos += 5;

        doc.setFont('helvetica', 'normal');
        monthTxs.slice(0, 22).forEach(t => {
            const isInc = (t.type === 'income');
            doc.setTextColor(148, 163, 184);
            doc.text(t.date, 18, yPos);
            doc.setTextColor(248, 250, 252);
            doc.text(t.description.slice(0, 36), 42, yPos);
            doc.setTextColor(148, 163, 184);
            doc.text((t.category || 'Geral').slice(0, 20), 110, yPos);
            doc.setTextColor(isInc ? 52 : 251, isInc ? 211 : 113, isInc ? 153 : 133);
            doc.text(`${isInc ? '+' : '-'}${this.formatCurrency(t.amount)}`, 165, yPos);
            yPos += 6;
        });

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('4U.IA.BR // Engenharia e Pesquisa — Gestão Financeira Pessoal & Corporativa', 14, 290);

        doc.save(`relatorio_financeiro_${currentMonth}.pdf`);
        this.showToast('Relatório Executivo em PDF gerado!');
    }

    // ==========================================================================
    // CHARTS (CHART.JS INTEGRATION)
    // ==========================================================================
    renderCharts() {
        this.renderCashFlowChart();
        this.renderCategoryChart();
    }

    renderCashFlowChart() {
        const ctx = document.getElementById('cashFlowChartCanvas');
        if (!ctx || typeof Chart === 'undefined') return;

        if (this.charts.cashFlow) {
            this.charts.cashFlow.destroy();
        }

        // Build last 5 months + current month labels
        const months = [];
        const [curY, curM] = this.settings.selectedMonth.split('-').map(Number);
        for (let i = 5; i >= 0; i--) {
            const d = new Date(curY, curM - 1 - i, 1);
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            months.push({
                key: ym,
                label: d.toLocaleDateString('pt-BR', { month: 'short' })
            });
        }

        const incomeData = [];
        const expenseData = [];

        months.forEach(m => {
            const inc = this.transactions
                .filter(t => t.type === 'income' && t.date.startsWith(m.key))
                .reduce((s, t) => s + (Number(t.amount) || 0), 0);
            const exp = this.transactions
                .filter(t => t.type === 'expense' && t.date.startsWith(m.key))
                .reduce((s, t) => s + (Number(t.amount) || 0), 0);
            incomeData.push(inc);
            expenseData.push(exp);
        });

        this.charts.cashFlow = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: months.map(m => m.label.toUpperCase()),
                datasets: [
                    {
                        label: 'Receitas',
                        data: incomeData,
                        backgroundColor: 'rgba(16, 185, 129, 0.85)',
                        borderRadius: 6
                    },
                    {
                        label: 'Despesas',
                        data: expenseData,
                        backgroundColor: 'rgba(244, 63, 94, 0.85)',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', callback: (v) => 'R$ ' + v }
                    }
                }
            }
        });
    }

    renderCategoryChart() {
        const ctx = document.getElementById('categoryChartCanvas');
        if (!ctx || typeof Chart === 'undefined') return;

        if (this.charts.category) {
            this.charts.category.destroy();
        }

        const currentMonth = this.settings.selectedMonth;
        const categoryTotals = {};

        this.transactions
            .filter(t => t.type === 'expense' && t.date.startsWith(currentMonth))
            .forEach(t => {
                const cat = t.category || 'Geral';
                categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(t.amount) || 0);
            });

        const labels = Object.keys(categoryTotals);
        const data = Object.values(categoryTotals);

        if (labels.length === 0) {
            // Render empty placeholder
            labels.push('Sem despesas');
            data.push(1);
        }

        const colors = [
            '#06b6d4', '#8b5cf6', '#10b981', '#f43f5e', '#f59e0b',
            '#3b82f6', '#ec4899', '#14b8a6', '#6366f1', '#eab308'
        ];

        this.charts.category = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94a3b8', boxWidth: 12, padding: 10 }
                    }
                },
                cutout: '70%'
            }
        });
    }

    // ==========================================================================
    // FINANCIAL CALCULATORS ENGINE (JUROS COMPOSTOS & CLT X PJ)
    // ==========================================================================
    calculateCompoundInterest() {
        const initial = parseFloat(document.getElementById('calcInitial').value) || 0;
        const monthly = parseFloat(document.getElementById('calcMonthly').value) || 0;
        const annualRate = parseFloat(document.getElementById('calcAnnualRate').value) || 0;
        const years = parseInt(document.getElementById('calcYears').value) || 1;

        const months = years * 12;
        const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;

        let totalInvested = initial;
        let futureValue = initial;

        for (let i = 0; i < months; i++) {
            futureValue = futureValue * (1 + monthlyRate) + monthly;
            totalInvested += monthly;
        }

        const totalInterest = futureValue - totalInvested;

        document.getElementById('calcResInvested').textContent = this.formatCurrency(totalInvested);
        document.getElementById('calcResInterest').textContent = this.formatCurrency(totalInterest);
        document.getElementById('calcResTotal').textContent = this.formatCurrency(futureValue);
    }

    calculateCltVsPj() {
        const cltGross = parseFloat(document.getElementById('cltGross').value) || 0;
        const cltBenefits = parseFloat(document.getElementById('cltBenefits').value) || 0;
        const pjGross = parseFloat(document.getElementById('pjGross').value) || 0;

        // INSS Progressive (approx 2026 tiers)
        let inss = cltGross * 0.11;
        if (inss > 908.85) inss = 908.85;

        // IRRF Progressive (approx)
        let baseIR = cltGross - inss;
        let irrf = 0;
        if (baseIR > 4664.68) irrf = baseIR * 0.275 - 896;
        else if (baseIR > 3751.05) irrf = baseIR * 0.225 - 662.77;
        else if (baseIR > 2826.65) irrf = baseIR * 0.15 - 381.44;
        else if (baseIR > 2259.20) irrf = baseIR * 0.075 - 169.44;
        if (irrf < 0) irrf = 0;

        // CLT Net + monthly proportional 13th & Vacation bonus + FGTS
        const cltMonthlyNet = cltGross - inss - irrf + cltBenefits;
        const cltAnnualNet = (cltMonthlyNet * 12) + (cltGross - inss - irrf) + (cltGross / 3) + (cltGross * 0.08 * 12);
        const cltRealMonthlyEquivalent = cltAnnualNet / 12;

        // PJ: Simples Nacional Anexo III (avg 6%) + Accounting (R$ 200)
        const pjTax = pjGross * 0.06;
        const pjAccounting = 200;
        const pjNet = pjGross - pjTax - pjAccounting;

        document.getElementById('resCltNet').textContent = this.formatCurrency(cltRealMonthlyEquivalent);
        document.getElementById('resPjNet').textContent = this.formatCurrency(pjNet);

        const verdictEl = document.getElementById('resVerdict');
        if (pjNet > cltRealMonthlyEquivalent) {
            const diff = pjNet - cltRealMonthlyEquivalent;
            verdictEl.innerHTML = `<span style="color: var(--text-emerald);">✓ Proposta PJ compensa mais!</span> (+${this.formatCurrency(diff)}/mês líquido)`;
        } else {
            const diff = cltRealMonthlyEquivalent - pjNet;
            verdictEl.innerHTML = `<span style="color: var(--text-rose);">✓ Vaga CLT compensa mais!</span> (+${this.formatCurrency(diff)}/mês com benefícios/FGTS)`;
        }
    }

    // ==========================================================================
    // UTILS & HELPERS
    // ==========================================================================
    formatCurrency(val) {
        const num = Number(val) || 0;
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
    }

    formatDate(dateStr) {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    showToast(msg, type = 'info') {
        const stack = document.getElementById('toastStack');
        if (!stack) return;

        const item = document.createElement('div');
        item.className = `toast-item ${type}`;
        item.innerHTML = `<i class="fas fa-info-circle"></i> <span>${msg}</span>`;
        stack.appendChild(item);

        setTimeout(() => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(10px)';
            item.style.transition = 'all 0.3s ease';
            setTimeout(() => item.remove(), 300);
        }, 3000);
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modalId) {
        const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
        if (modal) {
            modal.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    loadData(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.error('Error loading data:', key, e);
            return null;
        }
    }

    saveData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            if (this.googleDrive) {
                this.googleDrive.scheduleAutoSync();
            }
        } catch (e) {
            console.error('Error saving data:', key, e);
        }
    }

    loadDemoData() {
        const now = new Date();
        const curY = now.getFullYear();
        const curM = String(now.getMonth() + 1).padStart(2, '0');
        const prevDate = new Date(curY, now.getMonth() - 1, 1);
        const prevM = String(prevDate.getMonth() + 1).padStart(2, '0');
        const prevY = prevDate.getFullYear();

        this.transactions = [
            { id: 'demo_1', type: 'income', description: 'Salário & Pró-labore', amount: 8500, category: 'Salário', macroCategory: 'necessidade', date: `${curY}-${curM}-05`, accountId: 'nubank', status: 'paid' },
            { id: 'demo_2', type: 'expense', description: 'Aluguel & Condomínio', amount: 2200, category: 'Moradia', macroCategory: 'necessidade', date: `${curY}-${curM}-10`, accountId: 'nubank', status: 'paid' },
            { id: 'demo_3', type: 'expense', description: 'Supermercado do Mês', amount: 1420, category: 'Alimentação', macroCategory: 'necessidade', date: `${curY}-${curM}-12`, accountId: 'itau', status: 'paid' },
            { id: 'demo_4', type: 'expense', description: 'Restaurante & Confraternização', amount: 380, category: 'Lazer', macroCategory: 'desejo', date: `${curY}-${curM}-18`, accountId: 'nubank', status: 'paid' },
            { id: 'demo_5', type: 'expense', description: 'Aporte Tesouro Selic & Ações', amount: 1700, category: 'Investimentos', macroCategory: 'investimento', date: `${curY}-${curM}-20`, accountId: 'investimentos', status: 'paid' },
            { id: 'demo_6', type: 'expense', description: 'Notebook Dell (1/10)', amount: 450, category: 'Compras', macroCategory: 'desejo', date: `${curY}-${curM}-25`, accountId: 'nubank', status: 'paid', isInstallment: true, installmentIndex: 1, installmentTotal: 10 },
            { id: 'demo_7', type: 'income', description: 'Salário Mês Anterior', amount: 8000, category: 'Salário', macroCategory: 'necessidade', date: `${prevY}-${prevM}-05`, accountId: 'nubank', status: 'paid' },
            { id: 'demo_8', type: 'expense', description: 'Contas Mês Anterior', amount: 4950, category: 'Contas', macroCategory: 'necessidade', date: `${prevY}-${prevM}-15`, accountId: 'itau', status: 'paid' }
        ];

        this.refreshAll();
        this.showToast('Dados de demonstração carregados com sucesso!', 'success');
    }

    clearTransactionsOnly() {
        if (confirm('Deseja apagar todos os lançamentos para começar o seu controle financeiro do zero? Suas contas e saldos base serão mantidos.')) {
            this.transactions = [];
            this.saveData(this.STORAGE_TX, this.transactions);
            localStorage.setItem('financial_seeded', 'true');
            this.refreshAll();
            this.showToast('Lançamentos apagados! Pronto para registrar suas movimentações.', 'success');
        }
    }

    resetAllData() {
        if (confirm('ATENÇÃO: Deseja apagar TODOS os lançamentos, contas e configurações? Esta ação é irreversível.')) {
            localStorage.removeItem(this.STORAGE_TX);
            localStorage.removeItem(this.STORAGE_ACCOUNTS);
            localStorage.removeItem(this.STORAGE_CARDS);
            localStorage.removeItem(this.STORAGE_GOALS);
            localStorage.removeItem(this.STORAGE_SETTINGS);
            location.reload();
        }
    }

    // ==========================================================================
    // DOM EVENT LISTENERS BINDING
    // ==========================================================================
    setupEventListeners() {
        // Form Submit
        const form = document.getElementById('transactionForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleTransactionSubmit(e));
        }

        // Installment Toggle
        const chkInst = document.getElementById('chkInstallment');
        if (chkInst) {
            chkInst.addEventListener('change', (e) => {
                document.getElementById('subgroupInstallments').classList.toggle('open', e.target.checked);
            });
        }

        // Search Input
        const searchInput = document.getElementById('txSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.renderTransactionsLedger());
        }

        // Global Keyboards
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.open').forEach(m => this.closeModal(m));
                document.querySelectorAll('.dropdown-menu.show').forEach(d => d.classList.remove('show'));
            }
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown-container')) {
                document.querySelectorAll('.dropdown-menu.show').forEach(d => d.classList.remove('show'));
            }
        });
    }

    toggleDropdown(id) {
        const menu = document.getElementById(id);
        if (menu) {
            const isShown = menu.classList.contains('show');
            document.querySelectorAll('.dropdown-menu.show').forEach(d => d.classList.remove('show'));
            if (!isShown) menu.classList.add('show');
        }
    }
}

// Global App Instance
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new FinanceProApp();
});