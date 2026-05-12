.PHONY: up down build logs test migrate seed shell ps ollama-pull

up:
	docker compose up -d --build

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

ps:
	docker compose ps

migrate:
	docker compose run --rm migrations

seed:
	docker compose run --rm seed

test:
	docker compose run --rm backend pytest -v

shell:
	docker compose exec backend bash

ollama-pull:
	docker compose exec ollama ollama pull llama3.1:8b
