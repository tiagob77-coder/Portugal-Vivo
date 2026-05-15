# Backups operacionais

Este documento descreve como activar, monitorizar e restaurar os backups
automáticos da base de dados MongoDB em produção.

## Activar

O serviço `backup` está atrás de um Docker Compose profile chamado `backup`
(omitido nos arranques normais para que um host sem espaço em disco não fique
preso a montar volumes vazios).

```bash
docker compose -f docker-compose.prod.yml --profile backup up -d backup
```

Verificar:

```bash
docker compose -f docker-compose.prod.yml ps backup
docker compose -f docker-compose.prod.yml logs -f backup
```

## O que faz

- Corre `mongodump` uma vez por dia (UTC), com compressão gzip.
- Escreve para o volume `backup_data` montado em `/backups`.
- Política de retenção interna: **7 cópias diárias + 4 semanais + 3 mensais**
  (definida em `backend/backup_mongodb.py`).
- Quando `S3_BACKUP_BUCKET`, `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY`
  estão definidos, faz também upload para S3 e aplica retenção remota.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `MONGO_APP_PASSWORD` | sim | password do utilizador `pv_app` no Mongo |
| `S3_BACKUP_BUCKET` | não | bucket S3 destino; sem este valor o backup é só local |
| `S3_BACKUP_PREFIX` | não | prefixo de chaves S3 (default `mongodb-backups/`) |
| `AWS_ACCESS_KEY_ID` | só com S3 | |
| `AWS_SECRET_ACCESS_KEY` | só com S3 | |
| `AWS_REGION` | não | default `eu-west-1` |

## Restaurar

> **AVISO** — restaurar substitui o conteúdo actual da base de dados. Faça
> sempre um snapshot manual antes (`docker compose exec mongodb mongodump …`).

```bash
# Listar cópias disponíveis
docker compose -f docker-compose.prod.yml exec backup ls -lh /backups

# Copiar a cópia escolhida para o host
docker cp $(docker compose -f docker-compose.prod.yml ps -q backup):/backups/portugal_vivo_20260514.gz ./

# Restaurar
docker compose -f docker-compose.prod.yml exec -T mongodb \
  mongorestore --gzip --archive=- --nsInclude='portugal_vivo.*' \
  --drop < ./portugal_vivo_20260514.gz
```

Para restauros a partir de S3 use `backend/restore_mongodb.py` (corre com a
mesma imagem, montando o bucket via env vars AWS).

## Smoke test mensal

Recomenda-se correr o script de restauro contra uma base efémera (por
exemplo `portugal_vivo_restore_test`) uma vez por mês e verificar contagens
de POIs. Sem este passo, "temos backups" é uma fé, não uma certeza.
