const supabaseUrl = 'https://vxccqevjaijextigxbsb.supabase.co';
// Cole a chave ANON PUBLIC aqui abaixo entre as aspas:
const supabaseKey = 'sb_publishable_hsrzDSF7xQuKI6OtQ_IumA_bInehxZM'; 
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
async function cadastrar(email, senha, nome) {
    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: senha,
        options: { data: { nome: nome } }
    });
    if (error) throw error;
    return data;
}

async function login(email, senha) {
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: senha
    });
    if (authError) throw authError;

    const { data: perfil, error: perfilError } = await supabaseClient
        .from('usuarios')
        .select('ativo')
        .eq('id', authData.user.id)
        .single();

    if (perfilError || !perfil.ativo) {
        await supabaseClient.auth.signOut();
        throw new Error("Sua conta está desativada ou bloqueada.");
    }
    return authData;
}

window.cadastrar = cadastrar;
window.login = login;