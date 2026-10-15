#!/usr/bin/env bash
# Arranca o MongoDB e o Redis do job de testes de backend.
#
# Porque não `services:` no workflow: o GitHub só tenta puxar a imagem de um
# serviço três vezes, sempre ao mesmo registo, e falha o job inteiro antes de
# correr um único teste. Já caímos assim no Docker Hub (timeouts) e no ECR
# Public (`toomanyrequests` — o limite anónimo é por IP e os runners partilham
# IPs). Aqui cada imagem é procurada em vários espelhos das mesmas Docker
# Official Images, por ordem, até um responder.
#
# Uso: start-ci-services.sh            (mongo:6 em :27017, redis:7-alpine em :6379)
# Variáveis opcionais: CI_REGISTRIES (lista separada por espaços), CI_READY_TIMEOUT (s)
set -euo pipefail

REGISTRIES=${CI_REGISTRIES:-"mirror.gcr.io/library public.ecr.aws/docker/library docker.io/library"}
READY_TIMEOUT=${CI_READY_TIMEOUT:-90}

# pull_from_mirrors <imagem:tag> → escreve no stdout a referência que foi puxada
pull_from_mirrors() {
  local image=$1 registry ref attempt
  for registry in $REGISTRIES; do
    ref="$registry/$image"
    for attempt in 1 2; do
      echo "::group::docker pull $ref (tentativa $attempt)" >&2
      if docker pull --quiet "$ref" >&2; then
        echo "::endgroup::" >&2
        echo "$ref"
        return 0
      fi
      echo "::endgroup::" >&2
      sleep $((attempt * 3))
    done
    echo "::warning::Falhou o pull de $ref; a tentar o próximo registo." >&2
  done
  echo "::error::Não foi possível puxar $image de nenhum registo ($REGISTRIES)." >&2
  return 1
}

# wait_ready <nome> <comando de verificação...>
wait_ready() {
  local name=$1; shift
  local deadline=$((SECONDS + READY_TIMEOUT))
  until docker exec "$name" "$@" >/dev/null 2>&1; do
    if ((SECONDS >= deadline)); then
      echo "::error::$name não ficou pronto em ${READY_TIMEOUT}s." >&2
      docker logs --tail 50 "$name" >&2 || true
      return 1
    fi
    sleep 2
  done
  echo "$name pronto."
}

mongo_ref=$(pull_from_mirrors mongo:6)
redis_ref=$(pull_from_mirrors redis:7-alpine)

docker run -d --name mongodb -p 27017:27017 "$mongo_ref" >/dev/null
docker run -d --name redis -p 6379:6379 "$redis_ref" >/dev/null

wait_ready mongodb mongosh --quiet --eval "db.adminCommand('ping')"
wait_ready redis redis-cli ping
