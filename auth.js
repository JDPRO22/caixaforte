const supabaseUrl = 'https://vxccqevjaijjextigxbsb.supabase.co';
const supabaseKey = 'COLE_AQUI_A_CHAVE_JWT_QUE_VOCÊ_COPIOU_NO_PASSO_2';

const supabaseClient = window.supabase.createClient(
    supabaseUrl,
    supabaseKey
);

// Cadastro de novos usuários
async function cadastrar(email, senha, nome) {
    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: senha,
        options: {
            data: {
                nome: nome
            }
        }
    });

    if (error) throw error;
    return data;
}

// Login de usuários existentes com Validação de Bloqueio
async function login(email, senha) {
    // 1. Tenta autenticar no Supabase Auth
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: senha
    });

    if (authError) throw authError;

    // 2. Busca o perfil do usuário na tabela 'usuarios'
    const { data: perfil, error: perfilError } = await supabaseClient
        .from('usuarios')
        .select('ativo')
        .eq('id', authData.user.id)
        .single();

    // 3. Validação de bloqueio
    if (perfilError || !perfil.ativo) {
        await supabaseClient.auth.signOut();
        throw new Error("Sua conta está desativada ou bloqueada. Contate o administrador.");
    }

    return authData;
}

// Logout
async function logout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) console.error("Erro ao deslogar:", error.message);
    window.location.href = "login.html";
}

// Proteção de Páginas
async function verificarAcesso() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = "login.html";
        return;
    }

    // Verifica se o usuário ainda está ativo
    const { data: perfil } = await supabaseClient
        .from('usuarios')
        .select('ativo')
        .eq('id', session.user.id)
        .single();

    if (!perfil || !perfil.ativo) {
        await logout();
    }
}

// Garante a visibilidade das funções para o HTML em escopos isolados
window.cadastrar = cadastrar;
window.login = login;
window.logout = logout;
window.verificarAcesso = verificarAcesso;
