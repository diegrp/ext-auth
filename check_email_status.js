
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://rxrfdupqbczfhsykuubm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4cmZkdXBxYmN6ZmhzeWt1dWJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxMjgwMTQsImV4cCI6MjA2ODcwNDAxNH0.uTxUUNs6pe5FRBB13xjXeataqz46c9-_e9jtH4ibqno";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkEmailStatus(email, isRegisteredExpected) {
    console.log(`Verificando status do e-mail: ${email} (Esperado: ${isRegisteredExpected ? 'Registrado' : 'Não Registrado'})`);
    try {
        if (isRegisteredExpected) {
            // Para e-mails que deveriam estar registrados, tentar signInWithPassword com senha incorreta
            const { error } = await supabase.auth.signInWithPassword({
                email: email,
                password: 'incorrect_password_123',
            });

            if (error) {
                if (error.message.includes('Invalid login credentials')) {
                    console.log(`E-mail ${email}: Registrado (Credenciais inválidas, mas usuário existe).`);
                    return { status: 'registered', message: 'E-mail registrado.' };
                } else if (error.message.includes('Email not confirmed')) {
                    console.log(`E-mail ${email}: Registrado mas não confirmado.`);
                    return { status: 'registered_not_confirmed', message: 'E-mail registrado mas não confirmado.' };
                } else if (error.message.includes('User not found')) {
                    console.log(`E-mail ${email}: Não registrado (User not found).`);
                    return { status: 'not_registered', message: 'E-mail não registrado.' };
                } else if (error.message.includes('For security purposes, you can only request this after')) {
                    console.log(`E-mail ${email}: Registrado (Rate limit ao tentar login).`);
                    return { status: 'registered', message: 'E-mail registrado (Rate limit ao tentar login).' };
                } else {
                    console.log(`E-mail ${email}: Erro inesperado ao tentar signInWithPassword: ${error.message}`);
                    return { status: 'error', message: `Erro inesperado: ${error.message}` };
                }
            } else {
                // Se não houver erro, significa que o login foi bem-sucedido (o que não deveria acontecer com senha incorreta)
                console.log(`E-mail ${email}: Login bem-sucedido inesperado. Pode estar registrado.`);
                return { status: 'registered', message: 'E-mail registrado (login inesperado).' };
            }
        } else {
            // Para e-mails que não deveriam estar registrados, tentar signUp
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: 'TempPassword123!', // Senha temporária, precisa ser forte o suficiente
            });

            if (error) {
                if (error.message.includes('User already registered') || error.message.includes('Email already registered')) {
                    console.log(`E-mail ${email}: Registrado (User already registered via signUp).`);
                    return { status: 'registered', message: 'E-mail já registrado.' };
                } else if (error.message.includes('Email not confirmed')) {
                    console.log(`E-mail ${email}: Registrado mas não confirmado (via signUp).`);
                    return { status: 'registered_not_confirmed', message: 'E-mail registrado mas não confirmado.' };
                } else if (error.message.includes('For security purposes, you can only request this after')) {
                    console.log(`E-mail ${email}: Registrado (Rate limit via signUp).`);
                    return { status: 'registered', message: 'E-mail registrado (rate limit via signUp).', isRateLimited: true };
                } else if (error.message.includes('Password should be at least 6 characters')) {
                    console.log(`E-mail ${email}: Não registrado (SignUp falhou por erro de senha).`);
                    return { status: 'not_registered', message: 'E-mail não registrado (erro de senha no signUp).' };
                } else {
                    console.log(`E-mail ${email}: Erro inesperado ao tentar signUp: ${error.message}`);
                    return { status: 'error', message: `Erro inesperado no signUp: ${error.message}` };
                }
            } else {
                console.log(`E-mail ${email}: Não registrado (SignUp bem-sucedido).`);
                // Se o signUp for bem-sucedido, o usuário foi criado. Idealmente, você o removeria aqui.
                // await supabase.auth.admin.deleteUser(data.user.id);
                return { status: 'not_registered', message: 'E-mail não registrado.' };
            }
        }
    } catch (err) {
        console.error(`Erro ao verificar e-mail ${email}:`, err);
        return { status: 'error', message: `Erro na execução: ${err.message}` };
    }
}

async function runTests() {
    const registeredEmail = 'dkxever@gmail.com';
    const newEmail = 'dropsoftbr@gmail.com';

    console.log('\n--- Testando e-mail já registrado (dkxever@gmail.com) ---\n');
    const resultRegistered = await checkEmailStatus(registeredEmail, true);
    console.log(resultRegistered);

    console.log('\n--- Testando e-mail novo não registrado (dropsoftbr@gmail.com) ---\n');
    const resultNew = await checkEmailStatus(newEmail, false);
    console.log(resultNew);
}

runTests();


