// Lista de provedores de e-mail confiáveis
const trustedProviders = [
    // Principais provedores
    'gmail.com', 'googlemail.com',
    'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
    'yahoo.com', 'yahoo.com.br', 'ymail.com',
    'aol.com',
    'icloud.com', 'me.com', 'mac.com',
    
    // Provedores brasileiros
    'uol.com.br', 'bol.com.br', 'terra.com.br',
    'ig.com.br', 'r7.com', 'globo.com', 'globomail.com',
    
    // Provedores corporativos comuns
    'zoho.com', 'protonmail.com', 'tutanota.com',
    'fastmail.com', 'yandex.com', 'mail.com',
    
    // Provedores educacionais comuns
    'edu', 'edu.br', 'ac.uk', 'edu.au'
];

// Lista de domínios de e-mail temporário/descartável (amostra)
const disposableEmailDomains = [
    '10minutemail.com', '10minutemail.net', '10minutemail.org',
    'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org',
    'mailinator.com', 'mailinator.net', 'mailinator.org',
    'tempmail.org', 'temp-mail.org', 'temporary-mail.net',
    'throwaway.email', 'maildrop.cc', 'mailnesia.com',
    'yopmail.com', 'yopmail.fr', 'yopmail.net',
    'getnada.com', 'mohmal.com', 'sharklasers.com',
    'grr.la', 'guerrillamailblock.com', 'pokemail.net',
    'spam4.me', 'tempail.com', 'tempemail.com',
    'tempinbox.com', '20minutemail.com', '33mail.com',
    'dispostable.com', 'fakeinbox.com', 'getairmail.com',
    'harakirimail.com', 'jetable.org', 'mytrashmail.com',
    'noclickemail.com', 'sogetthis.com', 'spamgourmet.com',
    'tempemail.net', 'trashmail.com', 'wegwerfmail.de',
    'emailondeck.com', 'mailcatch.com', 'mailexpire.com',
    'mailtothis.com', 'mintemail.com', 'mt2014.com',
    'mytempemail.com', 'no-spam.ws', 'nowmymail.com',
    'put2.net', 'quickinbox.com', 'rcpt.at',
    'recode.me', 'recursor.net', 'safe-mail.net',
    'selfdestructingmail.com', 'sendspamhere.com', 'shieldedmail.com',
    'smellfear.com', 'snakemail.com', 'sneakemail.com',
    'sofort-mail.de', 'solvemail.info', 'spambog.com',
    'spambog.de', 'spambog.ru', 'spambox.us',
    'spamcannon.com', 'spamcannon.net', 'spamcero.com',
    'spamcon.org', 'spamcorptastic.com', 'spamcowboy.com',
    'spamcowboy.net', 'spamcowboy.org', 'spamday.com',
    'spamex.com', 'spamfree24.com', 'spamfree24.de',
    'spamfree24.eu', 'spamfree24.net', 'spamfree24.org',
    'spamgoes.com', 'spamherelots.com', 'spamhereplease.com',
    'spamhole.com', 'spami.spam.co.za', 'spaml.com',
    'spaml.de', 'spammotel.com', 'spamobox.com',
    'spamspot.com', 'spamthis.co.uk', 'spamthisplease.com',
    'spamtrail.com', 'spamtroll.net', 'temp-mail.ru',
    'tempalias.com', 'tempe-mail.com', 'tempemail.biz',
    'tempemail.com', 'tempinbox.co.uk', 'tempinbox.com',
    'tempmail.eu', 'tempmail2.com', 'tempmaildemo.com',
    'tempmailer.com', 'tempmailer.de', 'tempmailaddress.com',
    'tempthe.net', 'thanksnospam.info', 'thankyou2010.com',
    'thisisnotmyrealemail.com', 'throam.com', 'tilien.com',
    'tmail.ws', 'tmailinator.com', 'toiea.com',
    'tradermail.info', 'trash-amil.com', 'trash-mail.at',
    'trash-mail.com', 'trash-mail.de', 'trash2009.com',
    'trashdevil.com', 'trashemail.de', 'trashymail.com',
    'tyldd.com', 'uggsrock.com', 'wegwerfmail.de',
    'wegwerfmail.net', 'wegwerfmail.org', 'wh4f.org',
    'whyspam.me', 'willselfdestruct.com', 'winemaven.info',
    'wronghead.com', 'wuzup.net', 'wuzupmail.net',
    'xents.com', 'xmaily.com', 'xoxy.net',
    'yapped.net', 'yeah.net', 'yep.it',
    'yogamaven.com', 'yopmail.com', 'yopmail.fr',
    'yopmail.net', 'yourdomain.com', 'ypmail.webredirect.org',
    'zippymail.info', 'zoemail.org'
];

class EmailValidator {
    constructor() {
        this.emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    }

    // Validação básica de formato
    isValidFormat(email) {
        return this.emailRegex.test(email);
    }

    // Extrai o domínio do e-mail
    getDomain(email) {
        return email.split('@')[1]?.toLowerCase();
    }

    // Verifica se é um provedor confiável
    isTrustedProvider(email) {
        const domain = this.getDomain(email);
        if (!domain) return false;

        // Verifica domínios exatos
        if (trustedProviders.includes(domain)) return true;

        // Verifica domínios educacionais
        if (domain.endsWith('.edu') || domain.endsWith('.edu.br') || 
            domain.endsWith('.ac.uk') || domain.endsWith('.edu.au')) {
            return true;
        }

        // Verifica domínios corporativos (heurística simples)
        if (domain.includes('.com.') || domain.includes('.org.') || 
            domain.includes('.gov.') || domain.includes('.mil.')) {
            return true;
        }

        return false;
    }

    // Verifica se é um e-mail temporário/descartável
    isDisposableEmail(email) {
        const domain = this.getDomain(email);
        if (!domain) return false;

        return disposableEmailDomains.includes(domain);
    }

    // Validação completa
    validate(email) {
        const result = {
            isValid: false,
            isTrusted: false,
            isDisposable: false,
            errors: []
        };

        // Verifica formato básico
        if (!this.isValidFormat(email)) {
            result.errors.push('Formato de e-mail inválido');
            return result;
        }

        // Verifica se é descartável
        if (this.isDisposableEmail(email)) {
            result.isDisposable = true;
            result.errors.push('E-mails temporários ou descartáveis não são permitidos');
            return result;
        }

        // Verifica se é de provedor confiável
        if (!this.isTrustedProvider(email)) {
            result.errors.push('Por favor, use um e-mail de provedor confiável (Gmail, Outlook, Yahoo, etc.)');
            return result;
        }

        result.isValid = true;
        result.isTrusted = true;
        return result;
    }

    // Método público para validação simples
    isValid(email) {
        const validation = this.validate(email);
        return validation.isValid;
    }

    // Método para obter mensagem de erro
    getErrorMessage(email) {
        const validation = this.validate(email);
        return validation.errors.join('. ');
    }
}

// Instância global do validador
const emailValidator = new EmailValidator();

// Função para configurar validação personalizada em inputs de email
function setupCustomEmailValidation(inputElement, errorContainer) {
    if (!inputElement || inputElement.type !== 'email') return;
    
    // Desabilitar validação nativa do HTML5
    inputElement.setAttribute('novalidate', 'true');
    inputElement.form?.setAttribute('novalidate', 'true');
    
    // Função para mostrar erro personalizado
    function showCustomError(message) {
        if (errorContainer) {
            errorContainer.textContent = message;
            errorContainer.style.display = 'block';
            errorContainer.className = 'custom-email-error';
        }
        
        // Adicionar classe de erro ao input
        inputElement.classList.add('invalid');
        inputElement.style.borderColor = 'var(--error-500)';
    }
    
    // Função para limpar erro
    function clearCustomError() {
        if (errorContainer) {
            errorContainer.textContent = '';
            errorContainer.style.display = 'none';
        }
        
        // Remover classe de erro do input
        inputElement.classList.remove('invalid');
        inputElement.style.borderColor = '';
    }
    
    // Validação em tempo real
    function validateEmail() {
        const email = inputElement.value.trim();
        
        if (!email) {
            clearCustomError();
            return true;
        }
        
        const validation = emailValidator.validate(email);
        
        if (!validation.isValid) {
            showCustomError(validation.errors[0] || 'E-mail inválido');
            return false;
        }
        
        clearCustomError();
        return true;
    }
    
    // Event listeners
    inputElement.addEventListener('input', validateEmail);
    inputElement.addEventListener('blur', validateEmail);
    
    // Prevenir submissão do formulário com erro
    inputElement.form?.addEventListener('submit', function(e) {
        if (!validateEmail()) {
            e.preventDefault();
            inputElement.focus();
        }
    });
    
    return {
        validate: validateEmail,
        clearError: clearCustomError,
        showError: showCustomError
    };
}

// Exportar para uso no popup.js
if (typeof window !== 'undefined') {
    window.EmailValidator = EmailValidator;
    window.emailValidator = emailValidator;
    window.setupCustomEmailValidation = setupCustomEmailValidation;
}

