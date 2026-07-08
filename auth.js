// ============================================================
// CAIXA FORTE — AUTENTICAÇÃO (Supabase)
// ============================================================
// URL confirmada e testada (retornou resposta válida da API):
const supabaseUrl = 'https://vxccqevjaijjextigxbsb.supabase.co';

// ATENÇÃO: troque a linha abaixo colando a chave "anon public"
// copiada DIRETO do painel do Supabase (botão "Cópia"), nunca digitada
// ou copiada de um print. Painel: Configurações > Chaves de API.
const supabaseKey = 'COLE_AQUI_A_CHAVE_ANON_PUBLIC';

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ---- Cadastro de novos usuários ----
async function cadastrar(email, senha, nome) {
    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: senha,
        options: { data: { nome: nome } }
    });
    if (error) throw error;
    return data;
}

// ---- Login de usuários existentes, com validação de bloqueio ----
async function login(email, senha) {
    // 1. Tenta autenticar no Supabase Auth
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: senha,
    });
    if (authError) throw authError;

    // 2. Busca o perfil do usuário no banco
    const { data: perfil, error: perfilError } = await supabaseClient
        .from('usuarios')
        .select('ativo, data_fim')
        .eq('id', authData.user.id)
        .single();

    // 3. Trava de segurança: usuário inexistente ou inativo
    if (perfilError || !perfil.ativo) {
        await supabaseClient.auth.signOut();
        window.location.href = "pagamento_pendente.html";
        return;
    }

    // 4. Trava de segurança: data de vencimento
    const agora = new Date();
    const dataFim = perfil.data_fim ? new Date(perfil.data_fim) : null;
    if (dataFim && agora > dataFim) {
        await supabaseClient.auth.signOut();
        alert("Sua assinatura venceu. Entre em contato para renovar.");
        window.location.href = "pagamento_pendente.html";
        return;
    }

    // 5. Sucesso: acesso liberado
    window.location.href = "dashboard.html";
    return authData;
}

window.cadastrar = cadastrar;
window.login = login;
