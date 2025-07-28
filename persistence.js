// Funções de persistência da interface
const PERSISTENCE_KEYS = {
    CURRENT_SCREEN: 'supabase_current_screen',
    LOGIN_EMAIL: 'supabase_login_email',
    REGISTER_EMAIL: 'supabase_register_email'
};

function saveCurrentScreen(screenName) {
    try {
        localStorage.setItem(PERSISTENCE_KEYS.CURRENT_SCREEN, screenName);
    } catch (error) {
        console.warn('Erro ao salvar tela atual:', error);
    }
}

function loadCurrentScreen() {
    try {
        return localStorage.getItem(PERSISTENCE_KEYS.CURRENT_SCREEN);
    } catch (error) {
        console.warn('Erro ao carregar tela atual:', error);
        return null;
    }
}

function saveFormEmail(formType, email) {
    try {
        const key = formType === 'login' ? PERSISTENCE_KEYS.LOGIN_EMAIL : PERSISTENCE_KEYS.REGISTER_EMAIL;
        if (email && email.trim()) {
            localStorage.setItem(key, email.trim());
        }
    } catch (error) {
        console.warn('Erro ao salvar e-mail do formulário:', error);
    }
}

function loadFormEmail(formType) {
    try {
        const key = formType === 'login' ? PERSISTENCE_KEYS.LOGIN_EMAIL : PERSISTENCE_KEYS.REGISTER_EMAIL;
        return localStorage.getItem(key);
    } catch (error) {
        console.warn('Erro ao carregar e-mail do formulário:', error);
        return null;
    }
}

function clearInterfaceState() {
    try {
        localStorage.removeItem(PERSISTENCE_KEYS.CURRENT_SCREEN);
        localStorage.removeItem(PERSISTENCE_KEYS.LOGIN_EMAIL);
        localStorage.removeItem(PERSISTENCE_KEYS.REGISTER_EMAIL);
    } catch (error) {
        console.warn('Erro ao limpar estado da interface:', error);
    }
}

function restoreInterfaceState() {
    const savedScreen = loadCurrentScreen();
    
    if (savedScreen && savedScreen !== 'loading') {
        // Restaurar a tela salva
        switch (savedScreen) {
            case 'register':
                showScreen(elements.registerScreen);
                // Restaurar e-mail do formulário de cadastro
                const savedRegisterEmail = loadFormEmail('register');
                if (savedRegisterEmail) {
                    setTimeout(() => {
                        const registerEmail = document.getElementById('registerEmail');
                        if (registerEmail) {
                            registerEmail.value = savedRegisterEmail;
                        }
                    }, 100);
                }
                break;
            case 'verification':
                if (pendingVerificationEmail) {
                    showVerificationScreen(pendingVerificationEmail);
                } else {
                    // Se não há e-mail pendente, voltar para login
                    showScreen(elements.loginScreen);
                    const savedLoginEmail = loadFormEmail('login');
                    if (savedLoginEmail) {
                        setTimeout(() => {
                            const loginEmail = document.getElementById('loginEmail');
                            if (loginEmail) {
                                loginEmail.value = savedLoginEmail;
                            }
                        }, 100);
                    }
                }
                break;
            case 'dashboard':
                if (currentUser) {
                    showDashboard();
                } else {
                    showScreen(elements.loginScreen);
                    const savedLoginEmail = loadFormEmail('login');
                    if (savedLoginEmail) {
                        setTimeout(() => {
                            const loginEmail = document.getElementById('loginEmail');
                            if (loginEmail) {
                                loginEmail.value = savedLoginEmail;
                            }
                        }, 100);
                    }
                }
                break;
            default:
                showScreen(elements.loginScreen);
                // Restaurar e-mail do formulário de login
                const savedLoginEmail = loadFormEmail('login');
                if (savedLoginEmail) {
                    setTimeout(() => {
                        const loginEmail = document.getElementById('loginEmail');
                        if (loginEmail) {
                            loginEmail.value = savedLoginEmail;
                        }
                    }, 100);
                }
        }
    } else {
        showScreen(elements.loginScreen);
        // Restaurar e-mail do formulário de login
        const savedLoginEmail = loadFormEmail('login');
        if (savedLoginEmail) {
            setTimeout(() => {
                const loginEmail = document.getElementById('loginEmail');
                if (loginEmail) {
                    loginEmail.value = savedLoginEmail;
                }
            }, 100);
        }
    }
}

