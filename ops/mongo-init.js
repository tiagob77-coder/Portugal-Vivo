// Script de inicialização MongoDB para produção
// Cria a base de dados e utilizador de aplicação com permissões mínimas
// Requer MONGO_APP_PASSWORD definido no ambiente do container MongoDB

const appPassword = process.env.MONGO_APP_PASSWORD;
if (!appPassword) {
  print('ERRO: MONGO_APP_PASSWORD não está definido. Abortando inicialização.');
  quit(1);
}

db = db.getSiblingDB('portugal_vivo');

// Criar utilizador da aplicação (readWrite apenas na DB da app)
db.createUser({
  user: 'pv_app',
  pwd: appPassword,
  roles: [{ role: 'readWrite', db: 'portugal_vivo' }]
});

print('MongoDB: utilizador pv_app criado na DB portugal_vivo');
