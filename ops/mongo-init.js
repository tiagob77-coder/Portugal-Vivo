// Script de inicialização MongoDB para produção
// Cria a base de dados e utilizador de aplicação com permissões mínimas

db = db.getSiblingDB('portugal_vivo');

// Criar utilizador da aplicação (readWrite apenas na DB da app)
db.createUser({
  user: 'pv_app',
  pwd: process.env.MONGO_APP_PASSWORD || 'change-this-password',
  roles: [{ role: 'readWrite', db: 'portugal_vivo' }]
});

print('MongoDB: utilizador pv_app criado na DB portugal_vivo');
