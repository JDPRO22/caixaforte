const supabaseUrl = 'https://vxccqevjaijextigxbsb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4Y2NxZXZqYWlqZXh0aWd4YnNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNzAzMDcsImV4cCI6MjA5NTk0NjMwN30.dY4qw3fTGWfRV2N2cxXHN93Po7BljHC337YwCG6Xzf0';
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