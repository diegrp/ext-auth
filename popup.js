// Configuração do Supabase
const SUPABASE_URL = "https://rxrfdupqbczfhsykuubm.supabase.co"
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4cmZkdXBxYmN6ZmhzeWt1dWJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxMjgwMTQsImV4cCI6MjA2ODcwNDAxNH0.uTxUUNs6pe5FRBB13xjXeataqz46c9-_e9jtH4ibqno"

// Inicializar cliente Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
})

// Cache de elementos DOM
const elements = {}

// Estado da aplicação
let currentUser = null
let pendingVerificationEmail = null
let pendingPassword = null
let pendingResetEmail = null // Para recuperação de senha
let resendCooldown = false
let emailSendAttempts = 0
let codeTimer = null
let codeTimeLeft = 55
let codeStartTime = null
let verificationMode = "signup" // 'signup' ou 'password_reset'

// Chaves para localStorage
const STORAGE_KEYS = {
  PENDING_EMAIL: "supabase_pending_email",
  PENDING_PASSWORD: "supabase_pending_password",
  PENDING_RESET_EMAIL: "supabase_pending_reset_email",
  VERIFICATION_MODE: "supabase_verification_mode",
  EMAIL_ATTEMPTS: "supabase_email_attempts",
  CODE_START_TIME: "supabase_code_start_time",
  FORM_DATA: "supabase_form_data",
  CURRENT_SCREEN: "supabase_current_screen",
  RESEND_COOLDOWN_END: "supabase_resend_cooldown_end",
  CODE_EXPIRED_STATE: "supabase_code_expired_state",
}

// Funções utilitárias
function isCodeExpired() {
  if (!codeStartTime) return false
  const elapsed = (Date.now() - codeStartTime) / 1000
  return elapsed > 55
}

// Inicialização de elementos DOM
function initializeElements() {
  // Telas
  elements.loginScreen = document.getElementById("loginScreen")
  elements.registerScreen = document.getElementById("registerScreen")
  elements.verificationScreen = document.getElementById("verificationScreen")
  elements.dashboardScreen = document.getElementById("dashboardScreen")
  elements.loadingScreen = document.getElementById("loadingScreen")
  elements.forgotPasswordScreen = document.getElementById("forgotPasswordScreen")
  elements.resetPasswordScreen = document.getElementById("resetPasswordScreen")
  elements.messageContainer = document.getElementById("messageContainer")
  elements.termsModal = document.getElementById("termsModal")
  elements.termsContent = document.getElementById("termsContent")
  elements.postResetModal = document.getElementById("postResetModal")
  elements.continueLoggedBtn = document.getElementById("continueLoggedBtn")
  elements.backToLoginFromModalBtn = document.getElementById("backToLoginFromModal")
  elements.postResetUserEmail = document.getElementById("postResetUserEmail")

  // Formulários
  elements.loginForm = document.getElementById("loginForm")
  elements.registerForm = document.getElementById("registerForm")
  elements.verificationForm = document.getElementById("verificationForm")
  elements.forgotPasswordForm = document.getElementById("forgotPasswordForm")
  elements.resetPasswordForm = document.getElementById("resetPasswordForm")

  // Botões
  elements.showRegisterBtn = document.getElementById("showRegister")
  elements.showLoginBtn = document.getElementById("showLogin")
  elements.showForgotPasswordBtn = document.getElementById("showForgotPassword")
  elements.backToLoginBtn = document.getElementById("backToLogin")
  // elements.backToLoginFromResetBtn = document.getElementById("backToLoginFromReset")
  elements.logoutBtn = document.getElementById("logoutBtn")
  elements.resendCodeBtn = document.getElementById("resendCodeBtn")
  elements.backToRegisterBtn = document.getElementById("backToRegister")
  elements.showTermsBtn = document.getElementById("showTerms")
  elements.closeModalBtn = document.getElementById("closeModal")
  elements.acceptTermsFromModalBtn = document.getElementById("acceptTermsFromModal")

  // Campos
  elements.userEmailSpan = document.getElementById("userEmail")
  elements.verificationEmailSpan = document.getElementById("verificationEmail")
  elements.acceptTermsCheckbox = document.getElementById("acceptTerms")
  elements.newsletterCheckbox = document.getElementById("newsletter")
  elements.passwordInput = document.getElementById("registerPassword")
  elements.confirmPasswordInput = document.getElementById("confirmPassword")
  elements.passwordStrengthBar = document.getElementById("passwordStrengthBar")
  elements.passwordStrengthText = document.getElementById("passwordStrengthText")

  // Campos de reset de senha
  elements.resetPasswordInput = document.getElementById("resetPassword")
  elements.resetConfirmPasswordInput = document.getElementById("resetConfirmPassword")
  elements.resetPasswordStrengthBar = document.getElementById("resetPasswordStrengthBar")
  elements.resetPasswordStrengthText = document.getElementById("resetPasswordStrengthText")
}

// Funções de persistência
function saveVerificationState(email, password, mode = "signup") {
  try {
    localStorage.setItem(STORAGE_KEYS.PENDING_EMAIL, email)
    localStorage.setItem(STORAGE_KEYS.PENDING_PASSWORD, password || "")
    localStorage.setItem(STORAGE_KEYS.VERIFICATION_MODE, mode)
    localStorage.setItem(STORAGE_KEYS.EMAIL_ATTEMPTS, emailSendAttempts.toString())

    if (mode === "password_reset") {
      localStorage.setItem(STORAGE_KEYS.PENDING_RESET_EMAIL, email)
    }

    // Salvar tempo de início do código se existir E não estiver expirado
    if (codeStartTime && !localStorage.getItem(STORAGE_KEYS.CODE_EXPIRED_STATE)) {
      localStorage.setItem(STORAGE_KEYS.CODE_START_TIME, codeStartTime.toString())
    }

    // NUNCA salvar estado expirado quando salvando novo estado
    localStorage.removeItem(STORAGE_KEYS.CODE_EXPIRED_STATE)
  } catch (error) {
    console.warn("Erro ao salvar estado de verificação:", error)
  }
}

function saveFormData() {
  try {
    const formData = {
      loginEmail: document.getElementById("loginEmail")?.value || "",
      registerEmail: document.getElementById("registerEmail")?.value || "",
      forgotPasswordEmail: document.getElementById("forgotPasswordEmail")?.value || "",
      newsletter: document.getElementById("newsletter")?.checked || false,
      // Salvar estados de validação
      validationStates: {
        loginEmail: getFieldValidationState("loginEmail"),
        registerEmail: getFieldValidationState("registerEmail"),
        forgotPasswordEmail: getFieldValidationState("forgotPasswordEmail"),
        loginPassword: getFieldValidationState("loginPassword"),
        registerPassword: getFieldValidationState("registerPassword"),
        confirmPassword: getFieldValidationState("confirmPassword"),
      },
    }
    localStorage.setItem(STORAGE_KEYS.FORM_DATA, JSON.stringify(formData))
  } catch (error) {
    console.warn("Erro ao salvar dados do formulário:", error)
  }
}

function restoreFormData() {
  try {
    const savedData = localStorage.getItem(STORAGE_KEYS.FORM_DATA)
    if (savedData) {
      const formData = JSON.parse(savedData)

      const loginEmail = document.getElementById("loginEmail")
      if (loginEmail && formData.loginEmail) {
        loginEmail.value = formData.loginEmail
        // Restaurar validação após um pequeno delay
        setTimeout(() => validateEmailField(loginEmail), 100)
      }

      const registerEmail = document.getElementById("registerEmail")
      if (registerEmail && formData.registerEmail) {
        registerEmail.value = formData.registerEmail
        setTimeout(() => validateEmailField(registerEmail), 100)
      }

      const forgotPasswordEmail = document.getElementById("forgotPasswordEmail")
      if (forgotPasswordEmail && formData.forgotPasswordEmail) {
        forgotPasswordEmail.value = formData.forgotPasswordEmail
        setTimeout(() => validateEmailField(forgotPasswordEmail), 100)
      }

      const newsletter = document.getElementById("newsletter")
      if (newsletter && formData.newsletter !== undefined) {
        newsletter.checked = formData.newsletter
      }

      // Restaurar estados de validação
      if (formData.validationStates) {
        setTimeout(() => {
          restoreFieldValidationStates(formData.validationStates)
        }, 150)
      }
    }
  } catch (error) {
    console.warn("Erro ao restaurar dados do formulário:", error)
  }
}

function saveCurrentScreen(screenName) {
  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_SCREEN, screenName)
  } catch (error) {
    console.warn("Erro ao salvar tela atual:", error)
  }
}

function restoreCurrentScreen() {
  try {
    const savedScreen = localStorage.getItem(STORAGE_KEYS.CURRENT_SCREEN)
    if (savedScreen && savedScreen !== "verification") {
      switch (savedScreen) {
        case "register":
          showScreen(elements.registerScreen)
          break
        case "forgot-password":
          showScreen(elements.forgotPasswordScreen)
          break
        case "reset-password":
          showScreen(elements.resetPasswordScreen)
          break
        case "dashboard":
          // Será tratado pela verificação de autenticação
          break
        default:
          showScreen(elements.loginScreen)
      }
    }
  } catch (error) {
    console.warn("Erro ao restaurar tela atual:", error)
  }
}

function loadVerificationState() {
  try {
    const email = localStorage.getItem(STORAGE_KEYS.PENDING_EMAIL)
    const password = localStorage.getItem(STORAGE_KEYS.PENDING_PASSWORD)
    const resetEmail = localStorage.getItem(STORAGE_KEYS.PENDING_RESET_EMAIL)
    const mode = localStorage.getItem(STORAGE_KEYS.VERIFICATION_MODE) || "signup"
    const isInVerification = localStorage.getItem(STORAGE_KEYS.VERIFICATION_MODE)
    const attempts = Number.parseInt(localStorage.getItem(STORAGE_KEYS.EMAIL_ATTEMPTS) || "0")
    const savedCodeStartTime = localStorage.getItem(STORAGE_KEYS.CODE_START_TIME)
    const isCodeExpiredState = localStorage.getItem(STORAGE_KEYS.CODE_EXPIRED_STATE) === "true"

    if (email && isInVerification) {
      pendingVerificationEmail = email
      pendingPassword = password || ""
      pendingResetEmail = resetEmail
      verificationMode = mode
      emailSendAttempts = attempts

      // Se o código estava expirado, manter esse estado
      if (isCodeExpiredState) {
        codeStartTime = null
        return true
      }

      // Restaurar cronômetro se ainda válido
      if (savedCodeStartTime) {
        const startTime = Number.parseInt(savedCodeStartTime)
        const elapsed = (Date.now() - startTime) / 1000

        if (elapsed < 55) {
          // Cronômetro ainda válido
          codeStartTime = startTime
          codeTimeLeft = Math.max(0, 55 - Math.floor(elapsed))
        } else {
          // Cronômetro expirado, salvar estado
          localStorage.setItem(STORAGE_KEYS.CODE_EXPIRED_STATE, "true")
          localStorage.removeItem(STORAGE_KEYS.CODE_START_TIME)
          codeStartTime = null
        }
      }

      return true
    }
    return false
  } catch (error) {
    console.warn("Erro ao carregar estado de verificação:", error)
    return false
  }
}

function clearVerificationState() {
  try {
    localStorage.removeItem(STORAGE_KEYS.PENDING_EMAIL)
    localStorage.removeItem(STORAGE_KEYS.PENDING_PASSWORD)
    localStorage.removeItem(STORAGE_KEYS.PENDING_RESET_EMAIL)
    localStorage.removeItem(STORAGE_KEYS.VERIFICATION_MODE)
    localStorage.removeItem(STORAGE_KEYS.EMAIL_ATTEMPTS)
    localStorage.removeItem(STORAGE_KEYS.CODE_START_TIME)
    localStorage.removeItem(STORAGE_KEYS.CODE_EXPIRED_STATE)

    // Limpar também o estado da interface
    if (typeof clearInterfaceState === "function") {
      clearInterfaceState()
    }

    pendingVerificationEmail = null
    pendingPassword = null
    pendingResetEmail = null
    verificationMode = "signup"
    emailSendAttempts = 0
    codeStartTime = null
    codeTimeLeft = 55

    // Parar cronômetro se estiver rodando
    stopCodeTimer()
  } catch (error) {
    console.warn("Erro ao limpar estado de verificação:", error)
  }
}

// Funções utilitárias
function showScreen(screenToShow) {
  const screens = [
    elements.loginScreen,
    elements.registerScreen,
    elements.verificationScreen,
    elements.dashboardScreen,
    elements.loadingScreen,
    elements.forgotPasswordScreen,
    elements.resetPasswordScreen,
  ]

  screens.forEach((screen) => {
    if (screen) screen.classList.remove("active")
  })

  if (screenToShow) {
    screenToShow.classList.add("active")

    // Salvar o estado da tela atual
    let screenName = "login"
    if (screenToShow === elements.registerScreen) screenName = "register"
    else if (screenToShow === elements.verificationScreen) screenName = "verification"
    else if (screenToShow === elements.dashboardScreen) screenName = "dashboard"
    else if (screenToShow === elements.loadingScreen) screenName = "loading"
    else if (screenToShow === elements.forgotPasswordScreen) screenName = "forgot-password"
    else if (screenToShow === elements.resetPasswordScreen) screenName = "reset-password"

    if (typeof saveCurrentScreen === "function") {
      saveCurrentScreen(screenName)
    }
  }
}

function showModal(modal) {
  if (modal) modal.classList.add("active")
}

function hideModal(modal) {
  if (modal) modal.classList.remove("active")
}

function createMessageCloseHandler(messageDiv) {
  return () => {
    if (messageDiv && messageDiv.parentElement) {
      messageDiv.remove()
    }
  }
}

function showMessage(message, type = "success") {
  if (!elements.messageContainer) return

  const messageDiv = document.createElement("div")
  messageDiv.className = `message ${type}`

  const messageContent = document.createElement("div")
  messageContent.className = "message-content"

  const messageText = document.createElement("span")
  messageText.className = "message-text"
  messageText.textContent = message

  const closeButton = document.createElement("button")
  closeButton.className = "message-close"
  closeButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `

  // Usar addEventListener em vez de onclick inline
  closeButton.addEventListener("click", createMessageCloseHandler(messageDiv))

  messageContent.appendChild(messageText)
  messageContent.appendChild(closeButton)
  messageDiv.appendChild(messageContent)
  elements.messageContainer.appendChild(messageDiv)

  // Auto-remover após 5 segundos
  setTimeout(() => {
    if (messageDiv && messageDiv.parentElement) {
      messageDiv.remove()
    }
  }, 5000)
}

function showLoading(message = "Carregando...") {
  const loadingScreen = elements.loadingScreen
  if (loadingScreen) {
    const loadingText = loadingScreen.querySelector(".loading-spinner p")
    if (loadingText) {
      loadingText.textContent = message
    }
    showScreen(loadingScreen)
  }
}

function hideLoading(showLoginScreen = false) {
  if (currentUser) {
    showDashboard()
  } else if (showLoginScreen) {
    showScreen(elements.loginScreen)
  }
}

function showDashboard() {
  if (elements.userEmailSpan && currentUser) {
    elements.userEmailSpan.textContent = currentUser.email
  }
  clearVerificationState()
  showScreen(elements.dashboardScreen)
}

function showVerificationScreen(email, mode = "signup") {
  pendingVerificationEmail = email
  verificationMode = mode

  if (elements.verificationEmailSpan) {
    elements.verificationEmailSpan.textContent = email
  }

  // Atualizar texto baseado no modo
  const infoText = document.querySelector(".verification-info p:last-child")
  if (infoText) {
    if (mode === "password_reset") {
      infoText.textContent = "Digite o código de 6 dígitos para confirmar a redefinição de senha:"
    } else {
      if (emailSendAttempts <= 1) {
        infoText.textContent = "Digite o código de 6 dígitos que será enviado para seu e-mail:"
      } else {
        infoText.textContent = `Digite o código de 6 dígitos (tentativa ${emailSendAttempts}):`
      }
    }
  }

  showScreen(elements.verificationScreen)

  // Configurar botão "Voltar" baseado no modo
  if (elements.backToRegisterBtn) {
    if (mode === "password_reset") {
      elements.backToRegisterBtn.textContent = "Voltar à Recuperação"
      elements.backToRegisterBtn.style.display = "none" // Inicialmente oculto
    } else {
      elements.backToRegisterBtn.textContent = "Voltar ao Cadastro"
      elements.backToRegisterBtn.style.display = "none" // Inicialmente oculto
    }
  }

  // Verificar se o código estava expirado (apenas se não foi limpo)
  const isCodeExpiredState = localStorage.getItem(STORAGE_KEYS.CODE_EXPIRED_STATE) === "true"

  // Remover qualquer timer expirado existente SEMPRE
  const existingTimer = document.getElementById("codeTimer")
  if (existingTimer) {
    existingTimer.remove()
  }

  if (isCodeExpiredState) {
    // Restaurar estado expirado APENAS se realmente expirado
    const timerElement = document.createElement("div")
    timerElement.id = "codeTimer"
    timerElement.className = "code-timer expired"
    timerElement.innerHTML = `
            <div class="timer-expired">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                    <polyline points="12,6 12,12 16,14" stroke="currentColor" stroke-width="2"/>
                </svg>
                <span>Tempo esgotado! Solicite um novo código.</span>
            </div>
        `

    const verificationForm = document.getElementById("verificationForm")
    if (verificationForm) {
      verificationForm.insertBefore(timerElement, verificationForm.firstChild)
    }

    // Desabilitar campos
    const codeInput = document.getElementById("verificationCode")
    if (codeInput) {
      codeInput.disabled = true
      codeInput.placeholder = "Código expirado"
      codeInput.value = ""
    }

    const submitBtn = document.querySelector('#verificationForm button[type="submit"]')
    if (submitBtn) {
      submitBtn.disabled = true
      submitBtn.innerHTML = "<span>Código Expirado</span>"
    }

    // Mostrar botão 'Voltar' quando o código expirar
    if (elements.backToRegisterBtn) {
      elements.backToRegisterBtn.style.display = "block"
    }
  } else {
    // Estado normal - garantir que campos estejam habilitados
    const codeInput = document.getElementById("verificationCode")
    if (codeInput) {
      codeInput.disabled = false
      codeInput.placeholder = "000000"
      codeInput.classList.remove("invalid")
      codeInput.style.color = ""
      codeInput.style.borderColor = ""
      codeInput.value = ""
    }

    const submitBtn = document.querySelector('#verificationForm button[type="submit"]')
    if (submitBtn) {
      submitBtn.disabled = false
      submitBtn.innerHTML = `
                <span>Verificar Código</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 12L11 14L15 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `
    }

    // Iniciar cronômetro normal
    startCodeTimer()
  }

  // Restaurar cooldown de reenvio se existir
  restoreResendCooldown()

  // Se é a primeira tentativa, iniciar com bloqueio de segurança
  if (emailSendAttempts === 1 && !localStorage.getItem(STORAGE_KEYS.RESEND_COOLDOWN_END)) {
    startResendCooldown()
  }

  // Focar no campo de código após um pequeno delay (se não estiver expirado)
  if (!isCodeExpiredState) {
    setTimeout(() => {
      const codeInput = document.getElementById("verificationCode")
      if (codeInput && !codeInput.disabled) codeInput.focus()
    }, 100)
  }
}

function startResendCooldown() {
  if (!elements.resendCodeBtn) return

  resendCooldown = true
  elements.resendCodeBtn.disabled = true
  elements.resendCodeBtn.classList.add("loading")

  // O cooldown do botão deve ser o mesmo do timer do código, se o timer estiver ativo
  let countdown = codeTimeLeft > 0 ? codeTimeLeft : 55 // Usa o tempo restante do código ou 55s padrão
  const endTime = Date.now() + countdown * 1000

  // Salvar o tempo de fim do cooldown no localStorage
  localStorage.setItem(STORAGE_KEYS.RESEND_COOLDOWN_END, endTime.toString())

  function updateButton() {
    if (elements.resendCodeBtn) {
      elements.resendCodeBtn.innerHTML = `<span>Aguarde ${countdown}s...</span>`
    }
  }

  updateButton()

  const interval = setInterval(() => {
    countdown--
    updateButton()

    if (countdown <= 0) {
      clearInterval(interval)
      resendCooldown = false

      // Remover do localStorage quando terminar
      localStorage.removeItem(STORAGE_KEYS.RESEND_COOLDOWN_END)

      if (elements.resendCodeBtn) {
        elements.resendCodeBtn.disabled = false
        elements.resendCodeBtn.classList.remove("loading")
        elements.resendCodeBtn.innerHTML = `
                    <span>Reenviar Código</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polyline points="23,4 23,10 17,10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M20.49 15A9 9 0 1 1 5.64 5.64L23 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `
      }
    }
  }, 1000)
}

function restoreResendCooldown() {
  const savedEndTime = localStorage.getItem(STORAGE_KEYS.RESEND_COOLDOWN_END)
  if (!savedEndTime || !elements.resendCodeBtn) return

  const endTime = Number.parseInt(savedEndTime)
  const now = Date.now()
  const timeLeft = Math.max(0, Math.ceil((endTime - now) / 1000))

  if (timeLeft > 0) {
    resendCooldown = true
    elements.resendCodeBtn.disabled = true
    elements.resendCodeBtn.classList.add("loading")

    let countdown = timeLeft

    function updateButton() {
      if (elements.resendCodeBtn) {
        elements.resendCodeBtn.innerHTML = `<span>Aguarde ${countdown}s...</span>`
      }
    }

    const interval = setInterval(() => {
      countdown--
      updateButton()

      if (countdown <= 0) {
        clearInterval(interval)
        resendCooldown = false

        // Remover do localStorage quando terminar
        localStorage.removeItem(STORAGE_KEYS.RESEND_COOLDOWN_END)

        if (elements.resendCodeBtn) {
          elements.resendCodeBtn.disabled = false
          elements.resendCodeBtn.classList.remove("loading")
          elements.resendCodeBtn.innerHTML = `
                        <span>Reenviar Código</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <polyline points="23,4 23,10 17,10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M20.49 15A9 9 0 1 1 5.64 5.64L23 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    `
        }
      }
    }, 1000)
  } else {
    // Cooldown já expirou, remover do localStorage
    localStorage.removeItem(STORAGE_KEYS.RESEND_COOLDOWN_END)
    // Habilitar o botão se o código também expirou
    if (localStorage.getItem(STORAGE_KEYS.CODE_EXPIRED_STATE) === "true") {
      if (elements.resendCodeBtn) {
        elements.resendCodeBtn.disabled = false
        elements.resendCodeBtn.classList.remove("loading")
        elements.resendCodeBtn.innerHTML = `
                    <span>Reenviar Código</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polyline points="23,4 23,10 17,10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M20.49 15A9 9 0 1 1 5.64 5.64L23 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `
      }
    }
  }
}

function startCodeTimer() {
  // Parar qualquer timer existente primeiro
  if (codeTimer) {
    clearInterval(codeTimer)
    codeTimer = null
  }

  // Se não existe um cronômetro válido ou foi resetado, iniciar novo
  if (!codeStartTime) {
    codeStartTime = Date.now()
    codeTimeLeft = 55
  }

  // Salvar no localStorage
  localStorage.setItem(STORAGE_KEYS.CODE_START_TIME, codeStartTime.toString())
  // Remover estado de expiração ao iniciar novo timer
  localStorage.removeItem(STORAGE_KEYS.CODE_EXPIRED_STATE)

  // Remover qualquer timer expirado da interface
  let timerElement = document.getElementById("codeTimer")
  if (timerElement) {
    timerElement.remove()
  }

  // Criar novo elemento do timer
  timerElement = document.createElement("div")
  timerElement.id = "codeTimer"
  timerElement.className = "code-timer"

  const verificationForm = document.getElementById("verificationForm")
  if (verificationForm) {
    verificationForm.insertBefore(timerElement, verificationForm.firstChild)
  }

  function updateTimer() {
    // Calcular tempo restante baseado no tempo real
    const elapsed = (Date.now() - codeStartTime) / 1000
    const timeLeft = Math.max(0, 55 - Math.floor(elapsed))

    if (timeLeft <= 0) {
      clearInterval(codeTimer)

      // Salvar estado de expiração
      localStorage.setItem(STORAGE_KEYS.CODE_EXPIRED_STATE, "true")

      timerElement.innerHTML = `
                <div class="timer-expired">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <polyline points="12,6 12,12 16,14" stroke="currentColor" stroke-width="2"/>
                </svg>
                    <span>Tempo esgotado! Solicite um novo código.</span>
                </div>
            `
      timerElement.classList.add("expired")

      // Desabilitar o campo de código
      const codeInput = document.getElementById("verificationCode")
      if (codeInput) {
        codeInput.disabled = true
        codeInput.placeholder = "Código expirado"
      }

      // Desabilitar botão de verificar
      const submitBtn = document.querySelector('#verificationForm button[type="submit"]')
      if (submitBtn) {
        submitBtn.disabled = true
        submitBtn.innerHTML = "<span>Código Expirado</span>"
      }

      return
    }

    const minutes = Math.floor(timeLeft / 60)
    const seconds = timeLeft % 60
    const timeString = `${minutes}:${seconds.toString().padStart(2, "0")}`

    timerElement.innerHTML = `
            <div class="timer-active">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                    <polyline points="12,6 12,12 16,14" stroke="currentColor" stroke-width="2"/>
                </svg>
                    <span>Digite o código em: <strong>${timeString}</strong></span>
            </div>
        `

    // Adicionar classe de aviso quando restam 10 segundos
    if (timeLeft <= 10) {
      timerElement.classList.add("warning")
    }
  }

  updateTimer()
  codeTimer = setInterval(updateTimer, 1000)
}

function stopCodeTimer() {
  if (codeTimer) {
    clearInterval(codeTimer)
    codeTimer = null
  }

  const timerElement = document.getElementById("codeTimer")
  if (timerElement) {
    timerElement.remove()
  }

  // Reabilitar elementos completamente
  const codeInput = document.getElementById("verificationCode")
  if (codeInput) {
    codeInput.disabled = false
    codeInput.placeholder = "000000"
    codeInput.classList.remove("invalid")
    codeInput.style.color = ""
    codeInput.style.borderColor = ""
  }

  const submitBtn = document.querySelector('#verificationForm button[type="submit"]')
  if (submitBtn) {
    submitBtn.disabled = false
    submitBtn.innerHTML = `
            <span>Verificar Código</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 12L11 14L15 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `
  }

  // Limpar estado do cronômetro
  codeStartTime = null
  codeTimeLeft = 55
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Função para controlar visibilidade do ícone de toggle de senha
function togglePasswordIconVisibility(inputId, toggleId) {
  const input = document.getElementById(inputId)
  const toggle = document.getElementById(toggleId)

  if (!input || !toggle) return

  if (input.value.length > 0) {
    toggle.style.display = "flex"
  } else {
    toggle.style.display = "none"
    // Resetar para tipo password quando ocultar o ícone
    input.type = "password"
    const eyeOpen = toggle.querySelector(".eye-open")
    const eyeClosed = toggle.querySelector(".eye-closed")
    if (eyeOpen && eyeClosed) {
      eyeOpen.style.display = "block"
      eyeClosed.style.display = "none"
    }
  }
}

// Função para toggle de visibilidade da senha
function togglePasswordVisibility(inputId, toggleId) {
  const input = document.getElementById(inputId)
  const toggle = document.getElementById(toggleId)

  if (!input || !toggle) return

  const eyeOpen = toggle.querySelector(".eye-open")
  const eyeClosed = toggle.querySelector(".eye-closed")

  if (input.type === "password") {
    input.type = "text"
    eyeOpen.style.display = "none"
    eyeClosed.style.display = "block"
  } else {
    input.type = "password"
    eyeOpen.style.display = "block"
    eyeClosed.style.display = "none"
  }
}

// Atualizar indicadores de requisitos de senha
function updatePasswordRequirements(password, prefix = "") {
  const requirements = {
    [`${prefix}req-length`]: password.length >= 8,
    [`${prefix}req-uppercase`]: /[A-Z]/.test(password),
    [`${prefix}req-lowercase`]: /[a-z]/.test(password),
    [`${prefix}req-number`]: /[0-9]/.test(password),
    [`${prefix}req-special`]: /[^A-Za-z0-9]/.test(password),
  }

  Object.entries(requirements).forEach(([id, met]) => {
    const element = document.getElementById(id)
    if (element) {
      element.className = met ? "req-met" : "req-not-met"
    }
  })
}

function updatePasswordMatch(passwordId = "registerPassword", confirmPasswordId = "confirmPassword") {
  const passwordInput = document.getElementById(passwordId)
  const confirmPasswordInput = document.getElementById(confirmPasswordId)

  if (!passwordInput || !confirmPasswordInput) {
    return
  }

  const password = passwordInput.value
  const confirmPassword = confirmPasswordInput.value

  if (!confirmPassword) {
    // Remover classes quando campo está vazio
    passwordInput.classList.remove("invalid", "password-match")
    confirmPasswordInput.classList.remove("invalid", "password-match")
    return
  }

  if (password === confirmPassword) {
    // Adicionar bordas verdes quando senhas coincidem
    passwordInput.classList.remove("invalid")
    confirmPasswordInput.classList.remove("invalid")
    passwordInput.classList.add("password-match")
    confirmPasswordInput.classList.add("password-match")
  } else {
    // Adicionar bordas vermelhas quando senhas não coincidem
    passwordInput.classList.remove("password-match")
    confirmPasswordInput.classList.remove("password-match")
    passwordInput.classList.add("invalid")
    confirmPasswordInput.classList.add("invalid")
  }
}

// Função para verificar se e-mail existe no Supabase - CORRIGIDA
async function checkEmailExists(email) {
  try {
    console.log("Verificando se e-mail existe:", email)

    // Consultar diretamente a tabela public.users
    const { data, error } = await supabase.from("users").select("email").eq("email", email).limit(1)

    if (error) {
      console.error("Erro ao consultar tabela users:", error)
      // Em caso de erro na consulta, assumir que o e-mail não existe
      return false
    }

    // Se encontrou dados, o e-mail existe
    const exists = data && data.length > 0
    console.log("E-mail existe na tabela users:", exists)

    return exists
  } catch (error) {
    console.error("Erro ao verificar e-mail:", error)
    // Em caso de erro, assumir que o e-mail não existe para não bloquear o fluxo
    return false
  }
}

// Funções de autenticação
async function signUp(email, password) {
  try {
    showLoading("Carregando, aguarde...")

    // 1. Verificar se o e-mail já existe na tabela public.users
    const emailExists = await checkEmailExists(email)

    if (emailExists) {
      showMessage("Este e-mail já está cadastrado. Por favor, faça login ou use outro e-mail.", "error")
      hideLoading(true)
      return // Interrompe o fluxo de cadastro
    }

    // 2. Se o e-mail não existe em public.users, prosseguir com o signUp
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          newsletter: elements.newsletterCheckbox ? elements.newsletterCheckbox.checked : false,
        },
      },
    })

    if (error) {
      console.error("Erro retornado pelo Supabase:", error)
      if (error.message.includes("User already registered")) {
        // Se o usuário já existe, tentar reenviar o código de verificação
        showMessage("Este e-mail já está cadastrado. Verificando status...", "info")
        await resendVerificationCode(email)
        showVerificationScreen(email, "signup")
        return // Interrompe o fluxo de cadastro
      }
      throw error
    }

    // Atraso para garantir que o e-mail seja enviado
    await delay(1500)

    if (data.user && !data.user.email_confirmed_at) {
      emailSendAttempts = 1
      saveVerificationState(email, password, "signup")
      showMessage("Código de verificação enviado! Se não receber em alguns minutos, use 'Reenviar Código'.", "success")
      showVerificationScreen(email, "signup")
    } else if (data.user && data.user.email_confirmed_at) {
      currentUser = data.user
      clearVerificationState()
      showMessage("Cadastro realizado com sucesso!", "success")
      showDashboard()
    } else {
      emailSendAttempts = 1
      saveVerificationState(email, password, "signup")
      showMessage("Cadastro realizado! Aguarde o código de verificação por e-mail.", "success")
      showVerificationScreen(email, "signup")
    }
  } catch (error) {
    console.error("Erro no cadastro:", error)
    clearVerificationState()

    // Tratamento mais específico de erros
    let errorMessage = "Erro ao realizar cadastro"

    if (error.message.includes("Invalid email")) {
      errorMessage = "E-mail inválido. Verifique o formato do e-mail."
    } else if (error.message.includes("Password")) {
      errorMessage = "Erro na senha. Verifique se atende aos requisitos."
    } else if (error.message.includes("network") || error.message.includes("fetch")) {
      errorMessage = "Erro de conexão. Verifique sua internet e tente novamente."
    } else if (error.message.includes("signup is disabled")) {
      errorMessage = "Cadastro temporariamente desabilitado. Tente novamente mais tarde."
    } else if (error.message) {
      errorMessage = error.message
    }

    showMessage(errorMessage, "error")
    showScreen(elements.registerScreen)
  }
}

async function forgotPassword(email) {
  try {
    showLoading("Carregando, aguarde...")

    console.log("Iniciando recuperação de senha para:", email)

    // 1. Verificar se o e-mail existe na tabela public.users
    const emailExists = await checkEmailExists(email)

    if (!emailExists) {
      console.log("E-mail não encontrado na tabela users")
      showMessage("E-mail não encontrado. Verifique o endereço digitado ou cadastre-se.", "error")
      showScreen(elements.forgotPasswordScreen)
      return
    }

    console.log("E-mail encontrado, enviando código de recuperação")

    // 2. Enviar e-mail de recuperação usando resetPasswordForEmail
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })

    if (error) {
      console.error("Erro ao enviar e-mail de recuperação:", error)
      throw error
    }

    // 3. Configurar estado para verificação de recuperação de senha
    emailSendAttempts = 1
    pendingResetEmail = email
    saveVerificationState(email, "", "password_reset")

    showMessage("Código de verificação enviado para seu e-mail!", "success")
    showVerificationScreen(email, "password_reset")
  } catch (error) {
    console.error("Erro na recuperação de senha:", error)

    let errorMessage = "Erro ao enviar código de recuperação"

    if (error.message.includes("Invalid email")) {
      errorMessage = "E-mail inválido. Verifique o formato do e-mail."
    } else if (error.message.includes("network") || error.message.includes("fetch")) {
      errorMessage = "Erro de conexão. Verifique sua internet e tente novamente."
    } else if (error.message) {
      errorMessage = error.message
    }

    showMessage(errorMessage, "error")
    showScreen(elements.forgotPasswordScreen)
  }
}

async function resetPassword(newPassword) {
  try {
    // Usar updateUser para alterar a senha
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      console.error("Erro ao redefinir senha:", error)
      throw error
    }

    if (data.user) {
      currentUser = data.user
      clearVerificationState()

      // Mostrar modal de escolha em vez de ir direto para dashboard
      showPostResetModal(data.user.email)
    } else {
      throw new Error("Falha ao redefinir senha. Tente novamente.")
    }
  } catch (error) {
    console.error("Erro ao redefinir senha:", error)

    let errorMessage = "Erro ao redefinir senha"

    if (error.message.includes("Password")) {
      errorMessage = "Erro na nova senha. Verifique se atende aos requisitos."
    } else if (error.message.includes("network") || error.message.includes("fetch")) {
      errorMessage = "Erro de conexão. Verifique sua internet e tente novamente."
    } else if (error.message) {
      errorMessage = error.message
    }

    showMessage(errorMessage, "error")
    showScreen(elements.resetPasswordScreen)
  }
}

function showPostResetModal(userEmail) {
  if (elements.postResetUserEmail) {
    elements.postResetUserEmail.textContent = userEmail
  }
  showModal(elements.postResetModal)
}

async function verifyEmailCode(email, code) {
  try {
    showLoading()

    if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
      throw new Error("Código deve ter exatamente 6 dígitos numéricos")
    }

    // Verificar se o código expirou localmente
    if (isCodeExpired()) {
      throw new Error("EXPIRED_CODE")
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email: email,
      token: code,
      type: verificationMode === "password_reset" ? "recovery" : "email",
    })

    if (error) {
      console.error("Erro retornado pelo Supabase:", error)
      throw error
    }

    if (data.user) {
      if (verificationMode === "password_reset") {
        // Para recuperação de senha, ir para tela de redefinir senha
        stopCodeTimer()
        showMessage("Código verificado! Agora defina sua nova senha.", "success")
        showScreen(elements.resetPasswordScreen)
      } else {
        // Para cadastro normal, fazer login
        currentUser = data.user
        stopCodeTimer()
        clearVerificationState()
        showMessage("E-mail verificado com sucesso! Bem-vindo!", "success")
        showDashboard()
      }
    } else {
      throw new Error("Falha na verificação. Tente novamente.")
    }
  } catch (error) {
    console.error("Erro na verificação:", error)

    if (error.message === "EXPIRED_CODE") {
      showMessage("Tempo esgotado! O código deve ser inserido em até 55 segundos. Solicite um novo código.", "error")
    } else if (error.message.includes("Token has expired")) {
      // Verificar se ainda está dentro do prazo local de 55 segundos
      if (!isCodeExpired()) {
        // Se ainda está no prazo local, é código incorreto
        showMessage("Insira o código de confirmação correto!", "error")
        showCodeInputError()
        if (elements.backToRegisterBtn) {
          elements.backToRegisterBtn.style.display = "block"
        }
      } else {
        // Se expirou localmente, mostrar mensagem de expiração
        showMessage("Código expirado no servidor. Solicite um novo código.", "error")
        if (elements.backToRegisterBtn) {
          elements.backToRegisterBtn.style.display = "block"
        }
      }
    } else if (error.message.includes("Invalid token")) {
      // Verificar se ainda está dentro do prazo local de 55 segundos
      if (!isCodeExpired()) {
        // Se ainda está no prazo local, é código incorreto
        showMessage("Insira o código de confirmação correto!", "error")
        showCodeInputError()
        if (elements.backToRegisterBtn) {
          elements.backToRegisterBtn.style.display = "block"
        }
      } else {
        // Se expirou localmente, mostrar mensagem de expiração
        showMessage("Código expirado no servidor. Solicite um novo código.", "error")
        if (elements.backToRegisterBtn) {
          elements.backToRegisterBtn.style.display = "block"
        }
      }
    } else {
      showMessage("Insira o código de confirmação correto!", "error")
      showCodeInputError()
    }
    showScreen(elements.verificationScreen)
  }
}

async function resendVerificationCode(email) {
  try {
    if (resendCooldown) {
      showMessage("Aguarde antes de solicitar um novo código", "error")
      return
    }

    // Parar o timer atual e limpar estado ANTES de fazer a requisição
    stopCodeTimer()

    // Resetar completamente o estado do cronômetro
    codeStartTime = null
    codeTimeLeft = 55

    // IMPORTANTE: Limpar estado de expiração ANTES de tudo
    localStorage.removeItem(STORAGE_KEYS.CODE_START_TIME)
    localStorage.removeItem(STORAGE_KEYS.CODE_EXPIRED_STATE)

    let data, error

    if (verificationMode === "password_reset") {
      // Para recuperação de senha, usar resetPasswordForEmail
      const result = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      data = result.data
      error = result.error
    } else {
      // Para cadastro, usar signInWithOtp
      const result = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin,
        },
      })
      data = result.data
      error = result.error
    }

    if (error) {
      // Se for erro de segurança, manter campos bloqueados
      if (error.message.includes("For security purposes")) {
        showMessage(
          "Por questões de segurança, aguarde antes de solicitar um novo código. Mantenha o campo bloqueado até a confirmação do envio.",
          "error",
        )

        // Manter campos bloqueados
        const codeInput = document.getElementById("verificationCode")
        if (codeInput) {
          codeInput.disabled = true
          codeInput.placeholder = "Aguarde confirmação"
        }

        const submitBtn = document.querySelector('#verificationForm button[type="submit"]')
        if (submitBtn) {
          submitBtn.disabled = true
          submitBtn.innerHTML = "<span>Aguarde Confirmação</span>"
        }

        // Não reiniciar cronômetro, manter estado bloqueado
        return
      }
      throw error
    }

    // Só incrementar tentativas após sucesso no reenvio
    emailSendAttempts++

    // Salvar estado SEM o código expirado
    saveVerificationState(email, pendingPassword, verificationMode)

    // Remover qualquer timer expirado da interface ANTES de mostrar nova tela
    const timerElement = document.getElementById("codeTimer")
    if (timerElement) {
      timerElement.remove()
    }

    const modeText = verificationMode === "password_reset" ? "recuperação" : "cadastro"
    showMessage(
      `Novo código de ${modeText} enviado (tentativa ${emailSendAttempts})! Verifique sua caixa de entrada e spam.`,
      "success",
    )
    startResendCooldown()

    // Mostrar tela de verificação com estado limpo
    showVerificationScreen(email, verificationMode)

    // Esconder o botão 'Voltar' ao reenviar o código
    if (elements.backToRegisterBtn) {
      elements.backToRegisterBtn.style.display = "none"
    }
  } catch (error) {
    console.error("Erro ao reenviar:", error)
    showMessage(error.message || "Erro ao reenviar código", "error")

    // Reiniciar o timer mesmo se houve erro, mas com estado limpo
    codeStartTime = null
    localStorage.removeItem(STORAGE_KEYS.CODE_EXPIRED_STATE)
    startCodeTimer()
  }
}

async function signIn(email, password) {
  try {
    showLoading()

    // Limpar qualquer sessão existente
    await supabase.auth.signOut()
    await delay(300)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })

    if (error) {
      console.error("Erro retornado pelo Supabase:", error)
      throw error
    }

    if (data.user && data.user.email_confirmed_at) {
      currentUser = data.user
      clearVerificationState()
      showMessage("Login realizado com sucesso!", "success")
      await delay(500)
      showDashboard()
    } else if (data.user && !data.user.email_confirmed_at) {
      saveVerificationState(email, password, "signup")
      showMessage("E-mail não verificado. Enviando código de verificação...", "info")
      await resendVerificationCode(email)
      showVerificationScreen(email, "signup")
    } else {
      throw new Error("Falha no login. Tente novamente.")
    }
  } catch (error) {
    console.warn("Erro de login detectado:", error.message)

    if (error.message.includes("Invalid login credentials")) {
      showMessage("E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.", "error")
    } else if (error.message.includes("Email not confirmed")) {
      saveVerificationState(email, password, "signup")
      showMessage("E-mail não verificado. Enviando código de verificação...", "info")
      await resendVerificationCode(email)
      showVerificationScreen(email, "signup")
    } else if (error.message.includes("Too many requests")) {
      showMessage("Muitas tentativas de login. Aguarde alguns minutos antes de tentar novamente.", "error")
    } else if (error.message.includes("User not found")) {
      showMessage("Usuário não encontrado. Verifique o e-mail ou cadastre-se.", "error")
    } else {
      showMessage(error.message || "Erro ao fazer login. Verifique sua conexão e tente novamente.", "error")
    }
    await delay(500)
    hideLoading(true)
  }
}

async function signOut() {
  try {
    showLoading()

    currentUser = null
    clearVerificationState()

    const { error } = await supabase.auth.signOut()

    if (error) {
      console.warn("Erro no logout (ignorado):", error)
    }

    showMessage("Logout realizado com sucesso!", "success")
    showScreen(elements.loginScreen)
  } catch (error) {
    console.error("Erro no logout:", error)
    currentUser = null
    clearVerificationState()
    showMessage("Logout realizado!", "success")
    showScreen(elements.loginScreen)
  }
}

async function checkAuthState() {
  try {
    // Verificar estado de verificação pendente
    if (loadVerificationState()) {
      const modeText = verificationMode === "password_reset" ? "recuperação de senha" : "verificação de e-mail"
      showMessage(`${modeText.charAt(0).toUpperCase() + modeText.slice(1)} pendente. Complete a verificação.`, "info")
      showVerificationScreen(pendingVerificationEmail, verificationMode)
      return
    }

    // Obter sessão atual
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) {
      console.error("Erro ao obter sessão:", sessionError)
      showScreen(elements.loginScreen)
      return
    }

    if (session && session.user) {
      if (session.user.email_confirmed_at) {
        currentUser = session.user
        showDashboard()
      } else {
        saveVerificationState(session.user.email, "", "signup")
        showMessage("E-mail ainda não verificado. Enviando código...", "info")
        await resendVerificationCode(session.user.email)
        showVerificationScreen(session.user.email, "signup")
      }
    } else {
      showScreen(elements.loginScreen)
    }
  } catch (error) {
    console.error("Erro ao verificar autenticação:", error)
    clearVerificationState()
    showScreen(elements.loginScreen)
  }
}

// Event Handlers
function handleLoginSubmit(e) {
  e.preventDefault()

  // Limpar validações anteriores
  clearFormValidations("loginForm")

  const emailInput = document.getElementById("loginEmail")
  const passwordInput = document.getElementById("loginPassword")
  const submitButton = e.target.querySelector('button[type="submit"]')

  if (submitButton && submitButton.disabled) {
    return
  }

  let hasErrors = false

  // Validação de e-mail vazio
  if (!emailInput.value.trim()) {
    showMessage("Por favor, insira seu e-mail.", "error")
    emailInput.classList.add("invalid")
    const errorElement = getEmailErrorElement(emailInput)
    showEmailError(errorElement, "Este campo é obrigatório.")
    hasErrors = true
  } else {
    emailInput.classList.remove("invalid")
    // Validar formato do e-mail
    validateEmailField(emailInput)
    if (emailInput.classList.contains("invalid")) {
      hasErrors = true
    }
  }

  // Validação de senha vazia
  if (!passwordInput.value.trim()) {
    showMessage("Por favor, insira sua senha.", "error")
    passwordInput.classList.add("invalid")
    hasErrors = true
  } else {
    passwordInput.classList.remove("invalid")
  }

  // Salvar estado atual dos campos
  saveFormData()

  if (hasErrors) {
    return
  }

  if (submitButton) {
    submitButton.disabled = true
    submitButton.classList.add("loading")
    const originalContent = submitButton.innerHTML
    submitButton.innerHTML = "<span>Entrando...</span>"

    const restoreButton = () => {
      submitButton.disabled = false
      submitButton.classList.remove("loading")
      submitButton.innerHTML = originalContent
    }

    setTimeout(restoreButton, 10000)
    signIn(emailInput.value.trim(), passwordInput.value).finally(restoreButton)
  } else {
    signIn(emailInput.value.trim(), passwordInput.value)
  }
}

function handleForgotPasswordSubmit(e) {
  e.preventDefault()

  const emailInput = document.getElementById("forgotPasswordEmail")
  const submitButton = e.target.querySelector('button[type="submit"]')

  // Proteção contra cliques repetidos
  if (submitButton && submitButton.disabled) {
    return
  }

  let hasErrors = false

  // Validação de e-mail vazio
  if (!emailInput.value.trim()) {
    showMessage("Por favor, insira seu e-mail.", "error")
    emailInput.classList.add("invalid")
    const errorElement = getEmailErrorElement(emailInput)
    showEmailError(errorElement, "Este campo é obrigatório.")
    hasErrors = true
  } else {
    emailInput.classList.remove("invalid")

    // Validação de formato de e-mail
    if (window.emailValidator) {
      const emailValidation = window.emailValidator.validate(emailInput.value.trim())
      if (!emailValidation.isValid) {
        emailInput.classList.add("invalid")
        const errorElement = getEmailErrorElement(emailInput)
        if (emailValidation.isDisposable) {
          showEmailError(errorElement, "E-mails temporários não são permitidos. Use um e-mail de provedor confiável.")
        } else {
          showEmailError(errorElement, "Por favor, use um e-mail de provedor confiável (Gmail, Outlook, Yahoo, etc.)")
        }
        hasErrors = true
      } else {
        emailInput.classList.remove("invalid")
        emailInput.classList.add("email-valid")
      }
    }
  }

  // Salvar estado atual dos campos
  saveFormData()

  if (hasErrors) {
    return
  }

  // Aplicar proteção de loading
  if (submitButton) {
    submitButton.disabled = true
    submitButton.classList.add("loading")
    const originalContent = submitButton.innerHTML
    submitButton.innerHTML = "<span>Enviando...</span>"

    const restoreButton = () => {
      submitButton.disabled = false
      submitButton.classList.remove("loading")
      submitButton.innerHTML = originalContent
    }

    // Timeout de segurança de 10 segundos
    setTimeout(restoreButton, 10000)

    forgotPassword(emailInput.value.trim()).finally(restoreButton)
  } else {
    forgotPassword(emailInput.value.trim())
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault()

  // Limpar validações anteriores
  clearFormValidations("registerForm")

  const emailInput = document.getElementById("registerEmail")
  const passwordInput = elements.passwordInput
  const confirmPasswordInput = elements.confirmPasswordInput
  const submitButton = e.target.querySelector('button[type="submit"]')

  if (submitButton && submitButton.disabled) {
    return
  }

  let hasErrors = false

  // 1. Verificar se o checkbox de termos está marcado
  if (!elements.acceptTermsCheckbox) {
    showMessage("Erro: elemento de termos não encontrado.", "error")
    console.error("Elemento acceptTermsCheckbox não encontrado")
    return
  }

  if (!elements.acceptTermsCheckbox.checked) {
    showMessage("Você deve aceitar os Termos de Uso para se cadastrar.", "error")
    elements.acceptTermsCheckbox.focus()
    return
  }

  // 2. Validação de e-mail vazio
  if (!emailInput.value.trim()) {
    showMessage("Por favor, insira seu e-mail.", "error")
    emailInput.classList.add("invalid")
    const errorElement = getEmailErrorElement(emailInput)
    showEmailError(errorElement, "Este campo é obrigatório.")
    hasErrors = true
  } else {
    emailInput.classList.remove("invalid")

    // 3. Validação de e-mails temporários/descartáveis
    if (window.emailValidator) {
      const emailValidation = window.emailValidator.validate(emailInput.value.trim())
      if (!emailValidation.isValid) {
        emailInput.classList.add("invalid")
        const errorElement = getEmailErrorElement(emailInput)
        if (emailValidation.isDisposable) {
          showEmailError(
            errorElement,
            "E-mails temporários ou descartáveis não são permitidos. Use um e-mail de provedor confiável como Gmail, Outlook ou Yahoo.",
          )
        } else {
          showEmailError(errorElement, "Por favor, use um e-mail de provedor confiável (Gmail, Outlook, Yahoo, etc.)")
        }
        hasErrors = true
      } else {
        emailInput.classList.remove("invalid")
        emailInput.classList.add("email-valid")
      }
    }
  }

  // 4. Validação de senhas vazias
  if (!passwordInput.value.trim()) {
    showMessage("Por favor, insira sua senha.", "error")
    passwordInput.classList.add("invalid")
    hasErrors = true
  } else {
    passwordInput.classList.remove("invalid")
  }

  if (!confirmPasswordInput.value.trim()) {
    showMessage("Por favor, confirme sua senha.", "error")
    confirmPasswordInput.classList.add("invalid")
    hasErrors = true
  } else {
    confirmPasswordInput.classList.remove("invalid")
  }

  // 5. Validação de senhas que não coincidem
  if (passwordInput.value && confirmPasswordInput.value && passwordInput.value !== confirmPasswordInput.value) {
    showMessage("As senhas não coincidem", "error")
    passwordInput.classList.add("invalid")
    confirmPasswordInput.classList.add("invalid")
    hasErrors = true
  } else if (passwordInput.value && confirmPasswordInput.value) {
    passwordInput.classList.remove("invalid")
    confirmPasswordInput.classList.remove("invalid")
  }

  // 6. Validação de força da senha
  if (passwordInput.value && window.passwordValidator) {
    const passwordValidation = window.passwordValidator.validate(passwordInput.value)
    if (!passwordValidation.isValid) {
      showMessage("Sua senha precisa ser forte, cumpre os requisitos necessários para continuar.", "error")
      passwordInput.classList.add("invalid")
      confirmPasswordInput.classList.add("invalid")
      hasErrors = true
    } else {
      passwordInput.classList.remove("invalid")
      confirmPasswordInput.classList.remove("invalid")
    }
  }

  // Salvar estado atual dos campos
  saveFormData()

  if (hasErrors) {
    return
  }

  if (submitButton) {
    submitButton.disabled = true
    const originalContent = submitButton.innerHTML
    submitButton.innerHTML = "<span>Criando conta...</span>"

    const reEnableButton = () => {
      submitButton.disabled = false
      submitButton.innerHTML = originalContent
    }

    setTimeout(reEnableButton, 15000)

    try {
      await signUp(emailInput.value.trim(), passwordInput.value)
    } finally {
      reEnableButton()
    }
  } else {
    signUp(emailInput.value.trim(), passwordInput.value)
  }
}

function handleVerificationSubmit(e) {
  e.preventDefault()

  const code = document.getElementById("verificationCode").value.trim()

  if (!code) {
    showMessage("Por favor, digite o código de verificação", "error")
    return
  }

  if (!pendingVerificationEmail) {
    showMessage("Erro: e-mail não encontrado", "error")
    if (verificationMode === "password_reset") {
      showScreen(elements.forgotPasswordScreen)
    } else {
      showScreen(elements.registerScreen)
    }
    return
  }

  verifyEmailCode(pendingVerificationEmail, code)
}

function handlePasswordInput(e, prefix = "") {
  const password = e.target.value
  const passwordRequirements = document.querySelector(".password-requirements")

  if (password.length > 0) {
    passwordRequirements.classList.add("active")
  } else {
    passwordRequirements.classList.remove("active")
  }

  if (window.updatePasswordStrength) {
    const strengthText = prefix ? elements.resetPasswordStrengthText : elements.passwordStrengthText
    const strengthBar = prefix ? elements.resetPasswordStrengthBar : elements.passwordStrengthBar
    window.updatePasswordStrength(password, strengthText, strengthBar)
  }
  updatePasswordRequirements(password, prefix)

  if (prefix === "reset-") {
    updatePasswordMatch("resetPassword", "resetConfirmPassword")
  } else {
    updatePasswordMatch()
  }
}

function handleVerificationCodeInput(e) {
  let value = e.target.value.replace(/\D/g, "")
  if (value.length > 6) {
    value = value.substring(0, 6)
  }
  e.target.value = value

  // Remover classe de erro se existir
  e.target.classList.remove("invalid")

  // Adicionar efeito visual quando completo
  if (value.length === 6) {
    e.target.style.color = "var(--success-600)"
    e.target.style.borderColor = "var(--success-500)"
  } else {
    e.target.style.color = ""
    e.target.style.borderColor = ""
  }
}

// Função para mostrar erro visual no campo de código
function showCodeInputError() {
  const codeInput = document.getElementById("verificationCode")
  if (codeInput) {
    codeInput.classList.add("invalid")
    codeInput.value = ""
    codeInput.focus()

    setTimeout(() => {
      if (codeInput.value === "") {
        codeInput.classList.remove("invalid")
      }
    }, 3000)
  }
}

function showTermsContent() {
  if (elements.termsContent) {
    elements.termsContent.innerHTML = `
            <h2>Termos de Uso</h2>
            <p>Bem-vindo à nossa plataforma! Ao se cadastrar, você concorda com os seguintes termos e condições:</p>
            
            <h3>1. Aceitação dos Termos</h3>
            <p>Ao acessar e usar nossos serviços, você aceita e concorda em estar vinculado a estes Termos de Uso e a todas as políticas e diretrizes incorporadas por referência. Se você não concorda com esses termos, não use nossos serviços.</p>
            
            <h3>2. Modificações dos Termos</h3>
            <p>Reservamo-nos o direito de modificar ou revisar estes Termos de Uso a qualquer momento, a nosso exclusivo critério. Quaisquer alterações entrarão em vigor imediatamente após a publicação dos termos revisados em nosso site.</p>
            
            <h3>3. Elegibilidade</h3>
            <p>Você declara e garante que tem pelo menos 18 anos de idade e que tem capacidade legal para celebrar este contrato. Se você for menor de 18 anos, você só poderá usar os serviços com o consentimento e supervisão de um pai ou responsável legal.</p>
            
            <h3>4. Registro de Conta</h3>
            <p>Para acessar certas funcionalidades dos serviços, você pode ser obrigado a se registrar para uma conta. Você concorda em fornecer informações precisas, completas e atualizadas durante o processo de registro e em manter essas informações atualizadas.</p>
            
            <h3>5. Conduta do Usuário</h3>
            <p>Você concorda em usar os serviços apenas para fins lícitos e de maneira que não infrinja os direitos de, restrinja ou iniba o uso e o desfrute dos serviços por terceiros. A conduta proibida inclui assediar ou causar angústia ou inconveniência a qualquer pessoa.</p>
            
            <h3>6. Propriedade Intelectual</h3>
            <p>Todo o conteúdo e materiais disponíveis nos serviços, incluindo, mas não se limitando a texto, gráficos, logotipos, ícones, imagens, clipes de áudio, downloads digitais, compilações de dados e software, são de nossa propriedade ou de nossos licenciadores.</p>
            
            <h3>7. Isenção de Garantias</h3>
            <p>Os serviços são fornecidos "como estão" e "conforme disponíveis", sem garantias de qualquer tipo, expressas ou implícitas, incluindo, mas não se limitando a garantias implícitas de comercialização, adequação a uma finalidade específica e não infração.</p>
            
            <h3>8. Limitação de Responsabilidade</h3>
            <p>Em nenhuma circunstância seremos responsáveis por quaisquer danos diretos, indiretos, incidentais, especiais, consequenciais ou exemplares, incluindo, mas não se limitando a danos por perda de lucros, boa vontade, uso, dados ou outras perdas intangíveis.</p>
            
            <h3>9. Indenização</h3>
            <p>Você concorda em indenizar, defender e isentar-nos de e contra todas e quaisquer reivindicações, responsabilidades, danos, perdas, custos, despesas ou fees (incluindo honorários advocatícios razoáveis) que surgirem de sua violação destes Termos de Uso.</p>
            
            <h3>10. Lei Aplicável</h3>
            <p>Estes Termos de Uso serão regidos e interpretados de acordo com as leis do Brasil, sem levar em consideração seus princípios de conflito de leis.</p>
            
            <h3>11. Contato</h3>
            <p>Se você tiver alguma dúvida sobre estes Termos de Uso, entre em contato conosco através dos canais oficiais de suporte.</p>
        `
  }
  showModal(elements.termsModal)
}

// Inicialização de Event Listeners
function initializeEventListeners() {
  // Formulários
  if (elements.loginForm) {
    elements.loginForm.addEventListener("submit", handleLoginSubmit)
  }

  if (elements.registerForm) {
    elements.registerForm.addEventListener("submit", handleRegisterSubmit)
  }

  if (elements.verificationForm) {
    elements.verificationForm.addEventListener("submit", handleVerificationSubmit)
  }

  if (elements.forgotPasswordForm) {
    elements.forgotPasswordForm.addEventListener("submit", handleForgotPasswordSubmit)
  }

  if (elements.resetPasswordForm) {
    elements.resetPasswordForm.addEventListener("submit", handleResetPasswordSubmit)
  }

  // Navegação
  if (elements.showRegisterBtn) {
    elements.showRegisterBtn.addEventListener("click", (e) => {
      e.preventDefault()
      // Resetar formulário de cadastro ao navegar para ele
      resetRegisterForm(true)
      showScreen(elements.registerScreen)
    })
  }

  if (elements.showLoginBtn) {
    elements.showLoginBtn.addEventListener("click", (e) => {
      e.preventDefault()
      // Resetar formulário de login ao navegar para ele
      resetLoginForm(true)
      showScreen(elements.loginScreen)
    })
  }

  if (elements.showForgotPasswordBtn) {
    elements.showForgotPasswordBtn.addEventListener("click", (e) => {
      e.preventDefault()
      // Transferir email do login para recuperação, mas limpar validações
      const loginEmail = document.getElementById("loginEmail")
      const forgotPasswordEmail = document.getElementById("forgotPasswordEmail")

      // Resetar formulário de recuperação primeiro
      resetForgotPasswordForm(true)

      // Depois transferir o email se existir
      if (loginEmail && loginEmail.value.trim() && forgotPasswordEmail) {
        forgotPasswordEmail.value = loginEmail.value.trim()
        // Aplicar validação no email transferido
        validateEmailField(forgotPasswordEmail)
      }
      showScreen(elements.forgotPasswordScreen)
    })
  }

  if (elements.backToLoginBtn) {
    elements.backToLoginBtn.addEventListener("click", (e) => {
      e.preventDefault()
      // Resetar formulário de login ao voltar para ele
      resetLoginForm(true)
      showScreen(elements.loginScreen)
    })
  }

  // if (elements.backToLoginFromResetBtn) {
  //   elements.backToLoginFromResetBtn.addEventListener("click", (e) => {
  //     e.preventDefault()
  //     clearVerificationState()
  //     showScreen(elements.loginScreen)
  //   })
  // }

  if (elements.backToRegisterBtn) {
    elements.backToRegisterBtn.style.display = "none"
    elements.backToRegisterBtn.addEventListener("click", (e) => {
      e.preventDefault()
      clearVerificationState()
      if (verificationMode === "password_reset") {
        showScreen(elements.forgotPasswordScreen)
      } else {
        showScreen(elements.registerScreen)
      }
    })
  }

  if (elements.resendCodeBtn) {
    elements.resendCodeBtn.addEventListener("click", async (e) => {
      e.preventDefault()

      if (!pendingVerificationEmail) {
        showMessage("Erro: e-mail não encontrado", "error")
        return
      }

      await resendVerificationCode(pendingVerificationEmail)
    })
  }

  if (elements.logoutBtn) {
    elements.logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault()
      await signOut()
    })
  }

  // Modal
  if (elements.showTermsBtn) {
    elements.showTermsBtn.addEventListener("click", (e) => {
      e.preventDefault()
      showTermsContent()
    })
  }

  if (elements.closeModalBtn) {
    elements.closeModalBtn.addEventListener("click", () => {
      hideModal(elements.termsModal)
    })
  }

  if (elements.acceptTermsFromModalBtn) {
    elements.acceptTermsFromModalBtn.addEventListener("click", () => {
      if (elements.acceptTermsCheckbox) {
        elements.acceptTermsCheckbox.checked = true
      }
      hideModal(elements.termsModal)
      showMessage("Termos de Uso aceitos com sucesso!", "success")
    })
  }

  // Fechar modal clicando fora
  if (elements.termsModal) {
    elements.termsModal.addEventListener("click", (e) => {
      if (e.target === elements.termsModal) {
        hideModal(elements.termsModal)
      }
    })
  }

  // Modal pós-reset
  if (elements.continueLoggedBtn) {
    elements.continueLoggedBtn.addEventListener("click", () => {
      hideModal(elements.postResetModal)
      showMessage("Bem-vindo de volta! Senha redefinida com sucesso.", "success")
      showDashboard()
    })
  }

  if (elements.backToLoginFromModalBtn) {
    elements.backToLoginFromModalBtn.addEventListener("click", async () => {
      hideModal(elements.postResetModal)

      // Fazer logout para limpar a sessão
      await supabase.auth.signOut()
      currentUser = null
      clearVerificationState()

      showMessage("Sessão encerrada. Faça login com sua nova senha.", "info")
      showScreen(elements.loginScreen)
    })
  }

  if (elements.postResetModal) {
    elements.postResetModal.addEventListener("click", (e) => {
      if (e.target === elements.postResetModal) {
        // Por padrão, continuar logado se clicar fora
        hideModal(elements.postResetModal)
        showMessage("Bem-vindo de volta! Senha redefinida com sucesso.", "success")
        showDashboard()
      }
    })
  }

  // Validação de senha
  if (elements.passwordInput) {
    elements.passwordInput.addEventListener("input", (e) => handlePasswordInput(e))
  }

  if (elements.confirmPasswordInput) {
    elements.confirmPasswordInput.addEventListener("input", () => {
      updatePasswordMatch()
    })
  }

  // Validação de senha para reset
  if (elements.resetPasswordInput) {
    elements.resetPasswordInput.addEventListener("input", (e) => handlePasswordInput(e, "reset-"))
  }

  if (elements.resetConfirmPasswordInput) {
    elements.resetConfirmPasswordInput.addEventListener("input", () => {
      updatePasswordMatch("resetPassword", "resetConfirmPassword")
    })
  }

  // Formatação do código de verificação
  const verificationCodeInput = document.getElementById("verificationCode")
  if (verificationCodeInput) {
    verificationCodeInput.addEventListener("input", handleVerificationCodeInput)
  }

  // Controle de visibilidade dos ícones de senha
  const loginPasswordInput = document.getElementById("loginPassword")
  if (loginPasswordInput) {
    loginPasswordInput.addEventListener("input", () => {
      togglePasswordIconVisibility("loginPassword", "loginPasswordToggle")
    })
    loginPasswordInput.addEventListener("blur", () => {
      saveFormData()
    })
    togglePasswordIconVisibility("loginPassword", "loginPasswordToggle")
  }

  const registerPasswordInput = document.getElementById("registerPassword")
  if (registerPasswordInput) {
    registerPasswordInput.addEventListener("input", () => {
      togglePasswordIconVisibility("registerPassword", "registerPasswordToggle")
    })
    registerPasswordInput.addEventListener("blur", () => {
      saveFormData()
    })
    togglePasswordIconVisibility("registerPassword", "registerPasswordToggle")
  }

  const confirmPasswordInputField = document.getElementById("confirmPassword")
  if (confirmPasswordInputField) {
    confirmPasswordInputField.addEventListener("input", () => {
      togglePasswordIconVisibility("confirmPassword", "confirmPasswordToggle")
    })
    confirmPasswordInputField.addEventListener("blur", () => {
      saveFormData()
    })
    togglePasswordIconVisibility("confirmPassword", "confirmPasswordToggle")
  }

  // Controle de visibilidade para campos de reset
  const resetPasswordInput = document.getElementById("resetPassword")
  if (resetPasswordInput) {
    resetPasswordInput.addEventListener("input", () => {
      togglePasswordIconVisibility("resetPassword", "resetPasswordToggle")
    })
    togglePasswordIconVisibility("resetPassword", "resetPasswordToggle")
  }

  const resetConfirmPasswordInput = document.getElementById("resetConfirmPassword")
  if (resetConfirmPasswordInput) {
    resetConfirmPasswordInput.addEventListener("input", () => {
      togglePasswordIconVisibility("resetConfirmPassword", "resetConfirmPasswordToggle")
    })
    togglePasswordIconVisibility("resetConfirmPassword", "resetConfirmPasswordToggle")
  }

  // Toggle de visibilidade das senhas
  const loginPasswordToggle = document.getElementById("loginPasswordToggle")
  if (loginPasswordToggle) {
    loginPasswordToggle.addEventListener("click", () => {
      togglePasswordVisibility("loginPassword", "loginPasswordToggle")
    })
  }

  const registerPasswordToggle = document.getElementById("registerPasswordToggle")
  if (registerPasswordToggle) {
    registerPasswordToggle.addEventListener("click", () => {
      togglePasswordVisibility("registerPassword", "registerPasswordToggle")
    })
  }

  const confirmPasswordToggle = document.getElementById("confirmPasswordToggle")
  if (confirmPasswordToggle) {
    confirmPasswordToggle.addEventListener("click", () => {
      togglePasswordVisibility("confirmPassword", "confirmPasswordToggle")
    })
  }

  const resetPasswordToggle = document.getElementById("resetPasswordToggle")
  if (resetPasswordToggle) {
    resetPasswordToggle.addEventListener("click", () => {
      togglePasswordVisibility("resetPassword", "resetPasswordToggle")
    })
  }

  const resetConfirmPasswordToggle = document.getElementById("resetConfirmPasswordToggle")
  if (resetConfirmPasswordToggle) {
    resetConfirmPasswordToggle.addEventListener("click", () => {
      togglePasswordVisibility("resetConfirmPassword", "resetConfirmPasswordToggle")
    })
  }

  // Validação de e-mail em tempo real
  const loginEmail = document.getElementById("loginEmail")
  if (loginEmail) {
    loginEmail.addEventListener("input", () => {
      validateEmailField(loginEmail)
      saveFormData()
    })
    loginEmail.addEventListener("blur", () => {
      saveFormData()
    })

    // Remover validação nativa do HTML5
    loginEmail.removeAttribute("required")
    loginEmail.setAttribute("novalidate", "true")
  }

  const registerEmail = document.getElementById("registerEmail")
  if (registerEmail) {
    registerEmail.addEventListener("focus", () => {
      const errorElement = getEmailErrorElement(registerEmail)
      hideEmailError(errorElement)
    })
    registerEmail.addEventListener("input", () => {
      validateEmailField(registerEmail)
      saveFormData()
    })
    registerEmail.addEventListener("blur", () => {
      saveFormData()
    })

    // Remover validação nativa do HTML5
    registerEmail.removeAttribute("required")
    registerEmail.setAttribute("novalidate", "true")
  }

  const forgotPasswordEmail = document.getElementById("forgotPasswordEmail")
  if (forgotPasswordEmail) {
    forgotPasswordEmail.addEventListener("focus", () => {
      const errorElement = getEmailErrorElement(forgotPasswordEmail)
      hideEmailError(errorElement)
    })
    forgotPasswordEmail.addEventListener("input", () => {
      validateEmailField(forgotPasswordEmail)
      saveFormData()
    })
    forgotPasswordEmail.addEventListener("blur", () => {
      saveFormData()
    })

    // Remover validação nativa do HTML5
    forgotPasswordEmail.removeAttribute("required")
    forgotPasswordEmail.setAttribute("novalidate", "true")
  }

  const newsletter = document.getElementById("newsletter")
  if (newsletter) {
    newsletter.addEventListener("change", saveFormData)
  }
}

// Função para validar campo de e-mail
function validateEmailField(emailInput) {
  const emailValue = emailInput.value.trim()
  const errorElement = getEmailErrorElement(emailInput)

  // Limpar validações anteriores
  emailInput.classList.remove("invalid", "email-valid")
  hideEmailError(errorElement)

  if (!emailValue) {
    return
  }

  // Validação básica de formato
  const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  // Verificar se falta o @
  if (!emailValue.includes("@")) {
    emailInput.classList.add("invalid")
    showEmailError(errorElement, `Inclua um @ no endereço de e-mail. Está faltando "@" em "${emailValue}".`)
    return
  }

  // Verificar se tem @ mas formato inválido
  if (!basicEmailRegex.test(emailValue)) {
    emailInput.classList.add("invalid")

    // Mensagens específicas para diferentes problemas
    if (emailValue.indexOf("@") === 0) {
      showEmailError(errorElement, "Digite uma parte antes do @ no endereço de e-mail.")
    } else if (emailValue.indexOf("@") === emailValue.length - 1) {
      showEmailError(errorElement, "Digite uma parte depois do @ no endereço de e-mail.")
    } else if (!emailValue.includes(".", emailValue.indexOf("@"))) {
      showEmailError(errorElement, "Digite um ponto (.) após o @ no endereço de e-mail.")
    } else {
      showEmailError(errorElement, "Digite um endereço de e-mail válido.")
    }
    return
  }

  // Validação avançada com emailValidator se disponível
  if (window.emailValidator) {
    const emailValidation = window.emailValidator.validate(emailValue)
    if (!emailValidation.isValid) {
      emailInput.classList.add("invalid")
      if (emailValidation.isDisposable) {
        showEmailError(errorElement, "E-mails temporários não são permitidos. Use um e-mail de provedor confiável.")
      } else {
        showEmailError(errorElement, "Use um e-mail de provedor confiável (Gmail, Outlook, Yahoo, etc.)")
      }
      return
    }
  }

  // E-mail válido
  emailInput.classList.add("email-valid")
}

// Função para obter o elemento de erro do e-mail
function getEmailErrorElement(emailInput) {
  const inputId = emailInput.id
  let errorId = ""

  if (inputId === "loginEmail") {
    errorId = "loginEmailError"
  } else if (inputId === "registerEmail") {
    errorId = "registerEmailError"
  } else if (inputId === "forgotPasswordEmail") {
    errorId = "forgotPasswordEmailError"
  }

  let errorElement = document.getElementById(errorId)

  // Criar elemento de erro se não existir
  if (!errorElement) {
    errorElement = document.createElement("div")
    errorElement.id = errorId
    errorElement.className = "custom-email-error"
    errorElement.style.display = "none"

    // Inserir após o input wrapper
    const inputWrapper = emailInput.closest(".input-wrapper")
    if (inputWrapper && inputWrapper.parentNode) {
      inputWrapper.parentNode.insertBefore(errorElement, inputWrapper.nextSibling)
    }
  }

  return errorElement
}

// Função para mostrar erro de e-mail
function showEmailError(errorElement, message) {
  if (errorElement) {
    errorElement.textContent = message
    errorElement.style.display = "block"
  }
}

// Função para ocultar erro de e-mail
function hideEmailError(errorElement) {
  if (errorElement) {
    errorElement.textContent = ""
    errorElement.style.display = "none"
  }
}

// Função para resetar formulário de login (apenas em casos específicos)
function resetLoginForm(clearValues = false) {
  const loginForm = document.getElementById("loginForm")
  if (loginForm) {
    if (clearValues) {
      loginForm.reset()
    }

    const inputs = loginForm.querySelectorAll("input")
    inputs.forEach((input) => {
      input.classList.remove("invalid", "email-valid")
      input.style.borderColor = ""
    })

    const emailError = document.getElementById("loginEmailError")
    if (emailError) {
      emailError.textContent = ""
      emailError.style.display = "none"
    }
  }
}

// Função para resetar formulário de cadastro (apenas em casos específicos)
function resetRegisterForm(clearValues = false) {
  const registerForm = document.getElementById("registerForm")
  if (registerForm) {
    if (clearValues) {
      registerForm.reset()
    }

    const inputs = registerForm.querySelectorAll("input")
    inputs.forEach((input) => {
      input.classList.remove("invalid", "email-valid", "password-match")
      input.style.borderColor = ""
    })

    const emailError = document.getElementById("registerEmailError")
    if (emailError) {
      emailError.textContent = ""
      emailError.style.display = "none"
    }

    // Resetar indicadores de força da senha apenas se limpar valores
    if (clearValues) {
      const passwordStrengthBar = document.getElementById("passwordStrengthBar")
      const passwordStrengthText = document.getElementById("passwordStrengthText")
      if (passwordStrengthBar) {
        passwordStrengthBar.className = "password-strength-bar"
        passwordStrengthBar.style.width = "0%"
      }
      if (passwordStrengthText) {
        passwordStrengthText.textContent = ""
      }

      const passwordRequirements = document.querySelector(".password-requirements")
      if (passwordRequirements) {
        passwordRequirements.classList.remove("active")
      }

      const passwordToggles = registerForm.querySelectorAll(".password-toggle")
      passwordToggles.forEach((toggle) => {
        const eyeOpen = toggle.querySelector(".eye-open")
        const eyeClosed = toggle.querySelector(".eye-closed")
        if (eyeOpen) eyeOpen.style.display = "block"
        if (eyeClosed) eyeClosed.style.display = "none"
        toggle.style.display = "none"
      })

      const passwordFields = registerForm.querySelectorAll('input[type="text"][id*="assword"]')
      passwordFields.forEach((field) => {
        field.type = "password"
      })
    }
  }
}

// Função para resetar formulário de recuperação de senha
function resetForgotPasswordForm(clearValues = false) {
  const forgotPasswordForm = document.getElementById("forgotPasswordForm")
  if (forgotPasswordForm) {
    if (clearValues) {
      forgotPasswordForm.reset()
    }

    const inputs = forgotPasswordForm.querySelectorAll("input")
    inputs.forEach((input) => {
      input.classList.remove("invalid", "email-valid")
      input.style.borderColor = ""
    })

    const emailError = document.getElementById("forgotPasswordEmailError")
    if (emailError) {
      emailError.textContent = ""
      emailError.style.display = "none"
    }
  }
}

// Função para limpar apenas validações visuais
function clearFormValidations(formId) {
  const form = document.getElementById(formId)
  if (!form) return

  const inputs = form.querySelectorAll("input")
  inputs.forEach((input) => {
    input.classList.remove("invalid", "email-valid", "password-match")
    input.style.borderColor = ""

    // Limpar erros de e-mail se for um campo de e-mail
    if (input.type === "email" || input.id.includes("Email")) {
      const errorElement = getEmailErrorElement(input)
      hideEmailError(errorElement)
    }
  })

  // Limpar mensagens de erro específicas
  const errorElements = form.querySelectorAll(".custom-email-error")
  errorElements.forEach((error) => {
    error.textContent = ""
    error.style.display = "none"
  })
}

// Listener para mudanças de autenticação
function initializeAuthListener() {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log("Auth state changed:", event, session)

    if (event === "SIGNED_IN" && session && session.user && session.user.email_confirmed_at) {
      currentUser = session.user
      clearVerificationState()
      showDashboard()
    } else if (event === "SIGNED_OUT") {
      currentUser = null
      clearVerificationState()
      showScreen(elements.loginScreen)
    }
  })
}

// Login como convidado
function initializeGuestLogin() {
  const guestLoginBtn = document.getElementById("guestLogin")
  if (guestLoginBtn) {
    guestLoginBtn.addEventListener("click", async (e) => {
      e.preventDefault()
      showLoading()
      try {
        currentUser = {
          email: "convidado@async.acc",
          id: "guest-user",
          user_metadata: {
            isGuest: true,
          },
        }

        showMessage("Login como convidado realizado com sucesso!", "success")
        showDashboard()
      } catch (error) {
        console.error("Erro ao fazer login como convidado:", error)
        showMessage(`Erro ao entrar como convidado: ${error.message}`, "error")
        hideLoading(true)
      }
    })
  }
}

// Inicialização principal
function initialize() {
  // Declaração das funções clearInterfaceState e saveFormEmail
  window.clearInterfaceState = () => {
    // Lógica para limpar o estado da interface, se necessário
    console.log("Função clearInterfaceState chamada")
  }

  window.saveFormEmail = (formType, email) => {
    // Lógica para salvar o e-mail do formulário, se necessário
    console.log(`Função saveFormEmail chamada com formType: ${formType} e email: ${email}`)
  }

  initializeElements()
  initializeEventListeners()
  initializeAuthListener()
  initializeGuestLogin()

  // Restaurar dados dos formulários
  restoreFormData()

  // Verificar estado de verificação pendente
  const hasActiveSession = loadVerificationState()
  if (hasActiveSession) {
    // Se há verificação pendente, mostrar tela de verificação
    showVerificationScreen(pendingVerificationEmail, verificationMode)
  } else {
    // Restaurar tela anterior ou mostrar login
    restoreCurrentScreen()

    // Se não há tela salva, verificar autenticação
    if (!localStorage.getItem(STORAGE_KEYS.CURRENT_SCREEN)) {
      checkAuthState()
    }
  }
}

// Aguardar carregamento do DOM
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize)
} else {
  initialize()
}

// Função para obter estado de validação de um campo
function getFieldValidationState(fieldId) {
  const field = document.getElementById(fieldId)
  if (!field) return null

  return {
    value: field.value,
    hasInvalid: field.classList.contains("invalid"),
    hasValid: field.classList.contains("email-valid") || field.classList.contains("password-match"),
    errorMessage: getFieldErrorMessage(fieldId),
  }
}

// Função para obter mensagem de erro de um campo
function getFieldErrorMessage(fieldId) {
  let errorId = ""
  if (fieldId.includes("Email")) {
    errorId = fieldId + "Error"
  }

  const errorElement = document.getElementById(errorId)
  if (errorElement && errorElement.style.display !== "none") {
    return errorElement.textContent
  }
  return null
}

// Função para restaurar estados de validação
function restoreFieldValidationStates(validationStates) {
  Object.entries(validationStates).forEach(([fieldId, state]) => {
    if (!state) return

    const field = document.getElementById(fieldId)
    if (!field || field.value !== state.value) return

    // Restaurar classes de validação
    if (state.hasInvalid) {
      field.classList.add("invalid")
    }
    if (state.hasValid) {
      if (fieldId.includes("Email")) {
        field.classList.add("email-valid")
      } else if (fieldId.includes("Password")) {
        field.classList.add("password-match")
      }
    }

    // Restaurar mensagem de erro para campos de e-mail
    if (state.errorMessage && fieldId.includes("Email")) {
      const errorElement = getEmailErrorElement(field)
      showEmailError(errorElement, state.errorMessage)
    }
  })
}

async function handleResetPasswordSubmit(e) {
  e.preventDefault()

  // Limpar validações anteriores
  clearFormValidations("resetPasswordForm")

  const newPasswordInput = document.getElementById("resetPassword")
  const confirmNewPasswordInput = document.getElementById("resetConfirmPassword")
  const submitButton = e.target.querySelector('button[type="submit"]')

  if (submitButton && submitButton.disabled) {
    return
  }

  let hasErrors = false

  // 1. Validação de senhas vazias
  if (!newPasswordInput.value.trim()) {
    showMessage("Por favor, insira sua nova senha.", "error")
    newPasswordInput.classList.add("invalid")
    hasErrors = true
  } else {
    newPasswordInput.classList.remove("invalid")
  }

  if (!confirmNewPasswordInput.value.trim()) {
    showMessage("Por favor, confirme sua nova senha.", "error")
    confirmNewPasswordInput.classList.add("invalid")
    hasErrors = true
  } else {
    confirmNewPasswordInput.classList.remove("invalid")
  }

  // 2. Validação de senhas que não coincidem
  if (
    newPasswordInput.value &&
    confirmNewPasswordInput.value &&
    newPasswordInput.value !== confirmNewPasswordInput.value
  ) {
    showMessage("As senhas não coincidem", "error")
    newPasswordInput.classList.add("invalid")
    confirmNewPasswordInput.classList.add("invalid")
    hasErrors = true
  } else if (newPasswordInput.value && confirmNewPasswordInput.value) {
    newPasswordInput.classList.remove("invalid")
    confirmNewPasswordInput.classList.remove("invalid")
  }

  // 3. Validação de força da senha
  if (newPasswordInput.value && window.passwordValidator) {
    const passwordValidation = window.passwordValidator.validate(newPasswordInput.value)
    if (!passwordValidation.isValid) {
      showMessage("Sua nova senha precisa ser forte, cumpra os requisitos necessários para continuar.", "error")
      newPasswordInput.classList.add("invalid")
      confirmNewPasswordInput.classList.add("invalid")
      hasErrors = true
    } else {
      newPasswordInput.classList.remove("invalid")
      confirmNewPasswordInput.classList.remove("invalid")
    }
  }

  if (hasErrors) {
    return
  }

  if (submitButton) {
    submitButton.disabled = true
    const originalContent = submitButton.innerHTML
    submitButton.innerHTML = "<span>Redefinindo senha...</span>"

    const reEnableButton = () => {
      submitButton.disabled = false
      submitButton.innerHTML = originalContent
    }

    setTimeout(reEnableButton, 15000)

    try {
      await resetPassword(newPasswordInput.value)
    } finally {
      reEnableButton()
    }
  } else {
    resetPassword(newPasswordInput.value)
  }
}
