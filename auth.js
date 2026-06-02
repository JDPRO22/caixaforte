const supabaseUrl = 'https://vxccqevjaijextigxbsb.supabase.co';

const supabaseKey = 'sb_publishable_hsrzDSF7xQuKI6OtQ_IumA_bInehxZM';

const supabase = window.supabase.createClient(
  supabaseUrl,
  supabaseKey
);
// Cadastro de novos usuários
async function cadastrar(email, senha, nome) {
    const { data, error } = await supabase.auth.signUp({
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
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: senha
    });
    if (error) throw error;

    // Verificar se o usuário está ativo na nossa tabela customizada
    const { data: perfil, error: perfilError } = await supabase
        .from('usuarios')
        .select('ativo')
        .eq('id', data.user.id)
        .single();

    if (perfilError || !perfil.ativo) {
        await logout();
        throw new Error("Sua conta está desativada ou bloqueada. Contate o administrador.");
    }
    return data;
}

// Logout
async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Erro ao deslogar:", error.message);
    window.location.href = "login.html";
}

// Proteção de Páginas
async function verificarAcesso() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        window.location.href = "login.html";
        return;
    }

    const { data: perfil } = await supabase
        .from('usuarios')
        .select('ativo')
        .eq('id', session.user.id)
        .single();

    if (!perfil || !perfil.ativo) {
        await supabase.auth.signOut();
        window.location.href = "login.html";
    }
}// Garante a visibilidade das funções para o HTML em escopos isolados
window.cadastrar = cadastrar;
window.login = login;