// Validador de Senha Avançado
const passwordValidator = {
    // Configurações de validação
    config: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        maxLength: 128,
        commonPasswords: [
            'password', '123456', '123456789', 'qwerty', 'abc123', 
            'password123', 'admin', 'letmein', 'welcome', 'monkey',
            '1234567890', 'senha', 'senha123', '12345678', 'password1'
        ]
    },

    // Função principal de validação
    validate: function(password) {
        const errors = [];
        const warnings = [];
        let score = 0;

        // Verificar comprimento mínimo
        if (password.length < this.config.minLength) {
            errors.push(`A senha deve ter no mínimo ${this.config.minLength} caracteres.`);
        } else {
            score += 1;
        }

        // Verificar comprimento máximo
        if (password.length > this.config.maxLength) {
            errors.push(`A senha deve ter no máximo ${this.config.maxLength} caracteres.`);
        }

        // Verificar letra maiúscula
        if (this.config.requireUppercase && !/[A-Z]/.test(password)) {
            errors.push('A senha deve conter pelo menos uma letra maiúscula (A-Z).');
        } else if (/[A-Z]/.test(password)) {
            score += 1;
        }

        // Verificar letra minúscula
        if (this.config.requireLowercase && !/[a-z]/.test(password)) {
            errors.push('A senha deve conter pelo menos uma letra minúscula (a-z).');
        } else if (/[a-z]/.test(password)) {
            score += 1;
        }

        // Verificar números
        if (this.config.requireNumbers && !/[0-9]/.test(password)) {
            errors.push('A senha deve conter pelo menos um número (0-9).');
        } else if (/[0-9]/.test(password)) {
            score += 1;
        }

        // Verificar caracteres especiais
        if (this.config.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
            errors.push('A senha deve conter pelo menos um caractere especial (!@#$%^&*()_+-=[]{}|;:,.<>?).');
        } else if (/[^A-Za-z0-9]/.test(password)) {
            score += 1;
        }

        // Verificar senhas comuns
        if (this.config.commonPasswords.includes(password.toLowerCase())) {
            errors.push('Esta senha é muito comum. Escolha uma senha mais segura.');
        }

        // Verificar padrões sequenciais
        if (this.hasSequentialPattern(password)) {
            warnings.push('Evite sequências como "123" ou "abc" na sua senha.');
            score -= 1;
        }

        // Verificar repetições
        if (this.hasRepeatedChars(password)) {
            warnings.push('Evite repetir muitos caracteres iguais.');
            score -= 1;
        }

        // Calcular força da senha
        const strength = this.calculateStrength(password, score);

        return {
            isValid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            strength: strength,
            score: Math.max(0, score)
        };
    },

    // Verificar padrões sequenciais
    hasSequentialPattern: function(password) {
        const sequences = [
            '123456789', 'abcdefghijklmnopqrstuvwxyz', 
            'qwertyuiop', 'asdfghjkl', 'zxcvbnm'
        ];
        
        for (let seq of sequences) {
            for (let i = 0; i <= seq.length - 3; i++) {
                if (password.toLowerCase().includes(seq.substring(i, i + 3))) {
                    return true;
                }
            }
        }
        return false;
    },

    // Verificar caracteres repetidos
    hasRepeatedChars: function(password) {
        let repeatCount = 0;
        for (let i = 0; i < password.length - 1; i++) {
            if (password[i] === password[i + 1]) {
                repeatCount++;
            }
        }
        return repeatCount > password.length * 0.3; // Mais de 30% de repetições
    },

    // Calcular força da senha
    calculateStrength: function(password, baseScore) {
        let score = baseScore;

        // Bônus por comprimento
        if (password.length >= 12) score += 2;
        else if (password.length >= 10) score += 1;

        // Bônus por variedade de caracteres
        const charTypes = [
            /[a-z]/.test(password), // minúsculas
            /[A-Z]/.test(password), // maiúsculas
            /[0-9]/.test(password), // números
            /[^A-Za-z0-9]/.test(password) // especiais
        ].filter(Boolean).length;

        score += charTypes;

        // Bônus por caracteres únicos
        const uniqueChars = new Set(password).size;
        if (uniqueChars >= password.length * 0.8) score += 1;

        // Determinar nível de força
        if (score <= 2) return { level: 'muito-fraca', text: 'Muito Fraca', color: '#ff4444' };
        if (score <= 4) return { level: 'fraca', text: 'Fraca', color: '#ff8800' };
        if (score <= 6) return { level: 'media', text: 'Média', color: '#ffaa00' };
        if (score <= 8) return { level: 'forte', text: 'Forte', color: '#88cc00' };
        return { level: 'muito-forte', text: 'Muito Forte', color: '#00cc44' };
    },

    // Gerar sugestões de melhoria
    generateSuggestions: function(password) {
        const suggestions = [];
        
        if (password.length < 12) {
            suggestions.push('Considere usar uma senha mais longa (12+ caracteres).');
        }
        
        if (!/[A-Z]/.test(password)) {
            suggestions.push('Adicione letras maiúsculas.');
        }
        
        if (!/[a-z]/.test(password)) {
            suggestions.push('Adicione letras minúsculas.');
        }
        
        if (!/[0-9]/.test(password)) {
            suggestions.push('Adicione números.');
        }
        
        if (!/[^A-Za-z0-9]/.test(password)) {
            suggestions.push('Adicione caracteres especiais (!@#$%^&*).');
        }
        
        if (this.hasSequentialPattern(password)) {
            suggestions.push('Evite sequências como "123" ou "abc".');
        }
        
        if (this.hasRepeatedChars(password)) {
            suggestions.push('Evite repetir muitos caracteres iguais.');
        }

        return suggestions;
    }
};

// Função para atualizar indicador visual de força da senha
function updatePasswordStrength(password, strengthElement, progressElement) {
    if (!password) {
        strengthElement.textContent = '';
        progressElement.style.width = '0%';
        progressElement.style.backgroundColor = '#ddd';
        return;
    }

    const validation = passwordValidator.validate(password);
    const strength = validation.strength;
    
    strengthElement.textContent = strength.text;
    strengthElement.style.color = strength.color;
    
    const progressWidth = Math.min(100, (validation.score / 8) * 100);
    progressElement.style.width = progressWidth + '%';
    progressElement.style.backgroundColor = strength.color;
    
    // Adicionar classe CSS para animação
    progressElement.className = `password-strength-bar ${strength.level}`;
}

